/**
 * Resolves a file shipped in public/ at runtime, honouring the deployment
 * base path. Static CSS urls such as /fonts/*.woff2 cannot do this, so anything
 * referenced from JavaScript must go through here instead.
 */
export const publicAsset = (file: string) => `${import.meta.env.BASE_URL}${file}`;
