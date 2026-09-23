/**
 * Size of each piece of a chunked upload (shared by the browser and the server).
 * Must stay below the reverse proxy's body limit — Cloudflare Tunnel caps it at 100 MB.
 */
export const CHUNK_SIZE = 50 * 1024 * 1024;

/** Largest file accepted as a chat attachment (image, GIF or video). */
export const CHAT_MAX_BYTES = 250 * 1024 * 1024;
