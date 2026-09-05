declare const Buffer: { from(input: string, encoding?: string): { toString(encoding: string): string } } | undefined;

export function encodeBase64Json(value: unknown): string {
  const json = JSON.stringify(value);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json, 'utf8').toString('base64');
  }
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function decodeBase64Json<T>(value: string): T {
  let json: string;
  if (typeof Buffer !== 'undefined') {
    json = Buffer.from(value, 'base64').toString('utf8');
  } else {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    json = new TextDecoder().decode(bytes);
  }
  return JSON.parse(json) as T;
}

export function randomHex32(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = '0x';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex as `0x${string}`;
}
