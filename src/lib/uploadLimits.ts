/**
 * Size of each piece of a chunked upload (shared by the browser and the server).
 * Must stay below the reverse proxy's body limit — Cloudflare Tunnel caps it at 100 MB.
 */
export const CHUNK_SIZE = 50 * 1024 * 1024;
