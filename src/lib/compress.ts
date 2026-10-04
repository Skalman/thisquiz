// Text packed for a URL: url-safe-base64(deflate(text)).

async function deflate(str: string): Promise<Uint8Array> {
  const compressed = new Blob([str]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<string> {
  const ds = new DecompressionStream("deflate-raw");
  const decompressed = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(ds);
  return new TextDecoder().decode(await new Response(decompressed).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padLength = (4 - (str.length % 4)) % 4;
  const padded = str
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(str.length + padLength, "=");
  const binary = atob(padded);
  return Uint8Array.from({ length: binary.length }, (_, i) => binary.charCodeAt(i));
}

export async function packText(text: string): Promise<string> {
  return toBase64Url(await deflate(text));
}

/** Rejects on anything `packText` didn't produce. */
export async function unpackText(packed: string): Promise<string> {
  return inflate(fromBase64Url(packed));
}
