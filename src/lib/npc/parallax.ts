const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 v;

void main() {
  v = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 v;
uniform sampler2D uC;
uniform sampler2D uD;
uniform vec2 uO;
uniform vec2 uF;
uniform vec2 uDRange;

float H(vec2 q) {
  float raw = texture2D(uD, q).r;
  return clamp((raw - uDRange.x) / max(0.0001, uDRange.y - uDRange.x), 0.0, 1.0);
}

void main() {
  vec2 p = (v - 0.5) * uF + 0.5;
  const float h0 = 0.5;
  vec2 qA = p + uO * (1.0 - h0);
  float dA = H(qA) - 1.0;
  vec2 hit = qA;

  for (int i = 1; i <= 40; i++) {
    float z = 1.0 - float(i) / 40.0;
    vec2 qB = p + uO * (z - h0);
    float dB = H(qB) - z;
    hit = qB;

    if (dB >= 0.0) {
      float t = clamp(dA / (dA - dB - 1e-6), 0.0, 1.0);
      hit = mix(qA, qB, t);
      break;
    }

    qA = qB;
    dA = dB;
  }

  gl_FragColor = vec4(texture2D(uC, clamp(hit, 0.0, 1.0)).rgb, 1.0);
}
`;

export interface ParallaxCallbacks {
  onLoading: () => void;
  onReady: () => void;
  onFallback: () => void;
}

export interface ParallaxController {
  setImages: (colorUrl: string, depthUrl: string, depthRange?: [number, number]) => void;
  resize: (width: number, height: number, frameX: number, frameY: number) => void;
  destroy: () => void;
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create WebGL shader.');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader error';
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();

  if (!program) throw new Error('Unable to create WebGL program.');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown program link error';
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

function requireUniform(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (!location) throw new Error(`Missing WebGL uniform: ${name}`);
  return location;
}

/**
 * Dependency-free WebGL implementation of the mockup's depth parallax pass.
 * The color image stays visible as a CSS background whenever WebGL is not
 * usable, so the dialogue experience never depends on GPU support.
 */
export function createNpcParallax(
  canvas: HTMLCanvasElement,
  callbacks: ParallaxCallbacks,
): ParallaxController | null {
  const context = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
  });

  if (!context) {
    callbacks.onFallback();
    return null;
  }

  const gl: WebGLRenderingContext = context;

  let program: WebGLProgram;
  let buffer: WebGLBuffer;
  let uColor: WebGLUniformLocation;
  let uDepth: WebGLUniformLocation;
  let uOffset: WebGLUniformLocation;
  let uFrame: WebGLUniformLocation;
  let uDepthRange: WebGLUniformLocation;

  try {
    program = createProgram(gl);
    const vertexArray = gl.createBuffer();
    if (!vertexArray) throw new Error('Unable to create WebGL vertex buffer.');

    buffer = vertexArray;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    uColor = requireUniform(gl, program, 'uC');
    uDepth = requireUniform(gl, program, 'uD');
    uOffset = requireUniform(gl, program, 'uO');
    uFrame = requireUniform(gl, program, 'uF');
    uDepthRange = requireUniform(gl, program, 'uDRange');
    gl.uniform1i(uColor, 0);
    gl.uniform1i(uDepth, 1);
  } catch (error) {
    console.warn('NPC parallax disabled:', error);
    callbacks.onFallback();
    return null;
  }

  let colorTexture: WebGLTexture | null = null;
  let depthTexture: WebGLTexture | null = null;
  let readyCount = 0;
  let loadToken = 0;
  let activePair = '';
  let animationFrame = 0;
  let destroyed = false;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const parallaxAmount = () => (motionQuery.matches ? 0 : 0.036);

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let lastPointerMove = performance.now();

  function createTexture(): WebGLTexture {
    const texture = gl.createTexture();
    if (!texture) throw new Error('Unable to create WebGL texture.');

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  }

  function uploadTexture(texture: WebGLTexture, url: string, unit: number, token: number) {
    const image = new Image();
    image.decoding = 'async';

    image.onload = () => {
      if (destroyed || token !== loadToken) return;

      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

      readyCount += 1;
      if (readyCount === 2) callbacks.onReady();
    };

    image.onerror = () => {
      if (destroyed || token !== loadToken) return;
      callbacks.onFallback();
    };

    image.src = url;
  }

  function setImages(colorUrl: string, depthUrl: string, depthRange: [number, number] = [0, 1]) {
    const nextPair = `${colorUrl}|${depthUrl}`;
    if (nextPair === activePair) return;
    activePair = nextPair;
    gl.uniform2f(uDepthRange, depthRange[0], depthRange[1]);

    const token = ++loadToken;
    readyCount = 0;
    callbacks.onLoading();

    if (colorTexture) gl.deleteTexture(colorTexture);
    if (depthTexture) gl.deleteTexture(depthTexture);

    colorTexture = createTexture();
    depthTexture = createTexture();
    uploadTexture(colorTexture, colorUrl, 0, token);
    uploadTexture(depthTexture, depthUrl, 1, token);
  }

  function resize(width: number, height: number, frameX: number, frameY: number) {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const widthPx = Math.max(1, Math.round(width * pixelRatio));
    const heightPx = Math.max(1, Math.round(height * pixelRatio));

    if (canvas.width !== widthPx) canvas.width = widthPx;
    if (canvas.height !== heightPx) canvas.height = heightPx;

    gl.viewport(0, 0, widthPx, heightPx);
    gl.uniform2f(uFrame, frameX, frameY);
  }

  function handlePointerMove(event: PointerEvent) {
    lastPointerMove = performance.now();
    targetX = (event.clientX / window.innerWidth) * 2 - 1;
    targetY = (event.clientY / window.innerHeight) * 2 - 1;
  }

  function render(now: number) {
    if (destroyed) return;
    animationFrame = window.requestAnimationFrame(render);

    const still = motionQuery.matches;
    if (!still && now - lastPointerMove > 3000) {
      targetX = Math.sin(now * 0.0004) * 0.5;
      targetY = Math.cos(now * 0.0003) * 0.3;
    }

    currentX += (targetX - currentX) * 0.06;
    currentY += (targetY - currentY) * 0.06;

    if (readyCount === 2) {
      const amount = parallaxAmount();
      gl.uniform2f(uOffset, currentX * amount, -currentY * amount * 0.6);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  function handleContextLost(event: Event) {
    event.preventDefault();
    window.cancelAnimationFrame(animationFrame);
    callbacks.onFallback();
  }

  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  canvas.addEventListener('webglcontextlost', handleContextLost);
  animationFrame = window.requestAnimationFrame(render);

  return {
    setImages,
    resize,
    destroy() {
      destroyed = true;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      if (colorTexture) gl.deleteTexture(colorTexture);
      if (depthTexture) gl.deleteTexture(depthTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}
