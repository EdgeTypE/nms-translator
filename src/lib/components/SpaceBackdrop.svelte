<script lang="ts">
  // Decorative, non-interactive scene layer.
</script>

<div class="space-backdrop" aria-hidden="true">
  <div class="star-field star-field-a"></div>
  <div class="star-field star-field-b"></div>
  <div class="nebula nebula-left"></div>
  <div class="nebula nebula-right"></div>

  <svg class="geometry-lines" viewBox="0 0 1920 1080" preserveAspectRatio="none">
    <path d="M0 78h606l26 28h112" />
    <path d="M0 0v78M61 0v78M0 25h86M0 52h42" />
    <path d="M1920 0v226M1780 0v226M1920 52h-87M1920 145h-140" />
    <path d="M154 1080 0 926M459 1080 0 804M0 1015h204" />
    <path d="M1920 915 1654 1080M1920 730l-436 350M1920 1005h-270" />
    <path d="M1068 0v1080M1694 0v1080" opacity=".22" />
    <path d="m963 0-38 48h76ZM963 1080l-38-48h76Z" opacity=".28" />
    <circle cx="1450" cy="650" r="78" opacity=".12" />
    <circle cx="1450" cy="650" r="98" opacity=".07" />
  </svg>

  <div class="dot-field dot-field-left"></div>
  <div class="dot-field dot-field-right"></div>

  <div class="planet-system">
    <div class="system-glow"></div>
    <div class="system-core"></div>
    <div class="orbit orbit-one"><i></i></div>
    <div class="orbit orbit-two"><i></i></div>
    <div class="orbit orbit-three"><i></i></div>
    <div class="system-horizon"></div>
  </div>

  <div class="scanlines"></div>
  <div class="vignette"></div>
</div>

<style>
  .space-backdrop {
    position: fixed;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
    background:
      radial-gradient(circle at 52% 116%, rgba(255, 48, 81, .22), transparent 28%),
      radial-gradient(circle at 16% 18%, rgba(0, 136, 181, .08), transparent 30%),
      linear-gradient(154deg, #101728 0%, #050812 45%, #02050d 100%);
  }

  .star-field {
    position: absolute;
    inset: 0;
    opacity: .58;
    background-image:
      radial-gradient(circle, rgba(210, 240, 255, .7) 0 1px, transparent 1.4px),
      radial-gradient(circle, rgba(255, 255, 255, .28) 0 1px, transparent 1.3px);
    background-position: 0 0, 43px 67px;
    background-size: 117px 117px, 173px 173px;
    mask-image: linear-gradient(to bottom, #000, transparent 82%);
  }

  .star-field-b {
    opacity: .28;
    transform: rotate(11deg) scale(1.12);
    background-size: 211px 211px, 271px 271px;
  }

  .nebula {
    position: absolute;
    width: 46vw;
    height: 62vh;
    filter: blur(80px);
    opacity: .11;
  }

  .nebula-left {
    left: -24vw;
    top: -28vh;
    background: #007f9e;
    transform: rotate(22deg);
  }

  .nebula-right {
    right: -25vw;
    top: 14vh;
    background: #a11358;
  }

  .geometry-lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: none;
    stroke: #6eb6c8;
    stroke-width: 1;
    opacity: .16;
  }

  .dot-field {
    position: absolute;
    width: 270px;
    height: 160px;
    opacity: .14;
    background-image: radial-gradient(circle, #5ad6e6 1px, transparent 1.5px);
    background-size: 9px 9px;
    mask-image: radial-gradient(ellipse, #000, transparent 72%);
  }

  .dot-field-left {
    left: 2vw;
    bottom: 10vh;
  }

  .dot-field-right {
    right: 3vw;
    top: 15vh;
    transform: rotate(90deg);
  }

  .planet-system {
    position: absolute;
    left: 52%;
    bottom: -230px;
    width: 760px;
    height: 760px;
    transform: translateX(-50%);
  }

  .system-glow {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 228, 235, .82) 0 6%, rgba(255, 77, 112, .58) 19%, rgba(204, 15, 67, .25) 43%, transparent 70%);
    filter: blur(7px);
  }

  .system-core {
    position: absolute;
    left: 50%;
    top: 46%;
    width: 190px;
    height: 190px;
    border: 1px solid rgba(255, 218, 225, .88);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle at 50% 44%, #fff 0 2%, #ffb3c5 4%, #c91453 34%, #3b0925 67%, transparent 69%);
    box-shadow: 0 0 25px #ff5b8b, 0 0 80px rgba(255, 37, 97, .7);
  }

  .orbit {
    position: absolute;
    left: 50%;
    top: 46%;
    border: 1px solid rgba(255, 163, 187, .32);
    border-radius: 50%;
    transform: translate(-50%, -50%) rotate(-9deg);
  }

  .orbit i {
    position: absolute;
    left: 50%;
    top: -3px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #ffdce5;
    box-shadow: 0 0 8px #ff5f8a;
  }

  .orbit-one {
    width: 430px;
    height: 430px;
  }

  .orbit-two {
    width: 585px;
    height: 270px;
    transform: translate(-50%, -50%) rotate(8deg);
  }

  .orbit-three {
    width: 690px;
    height: 330px;
    transform: translate(-50%, -50%) rotate(-4deg);
    opacity: .7;
  }

  .system-horizon {
    position: absolute;
    left: 5%;
    right: 5%;
    top: 46%;
    height: 1px;
    background: linear-gradient(90deg, transparent, #fff 18%, #ff416f 50%, #fff 82%, transparent);
    box-shadow: 0 0 10px 2px rgba(255, 91, 134, .7);
  }

  .scanlines {
    position: absolute;
    inset: 0;
    opacity: .075;
    background: repeating-linear-gradient(to bottom, transparent 0 3px, rgba(121, 208, 224, .22) 4px);
    mix-blend-mode: soft-light;
  }

  .vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 45%, rgba(0, 2, 9, .72) 100%);
  }

  @media (max-width: 800px) {
    .planet-system {
      left: 55%;
      bottom: -340px;
      transform: translateX(-50%) scale(.8);
    }

    .geometry-lines {
      opacity: .1;
    }
  }
</style>
