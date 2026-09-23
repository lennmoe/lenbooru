"use client";

import type { Dict } from "./i18n/dict";
import { CHUNK_SIZE } from "./uploadLimits";

/**
 * Browser side of chunked uploads (see lib/chunks.ts), shared by the post
 * upload page and chat attachments.
 */

export function newUploadId(): string {
  // crypto.randomUUID only exists on https / localhost
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join("-");
}

/** One request with upload progress; resolves with status + parsed JSON. */
export function send<T = Record<string, unknown>>(
  method: string,
  url: string,
  body: Blob | string,
  contentType: string,
  onUpload?: (loaded: number) => void
): Promise<{ status: number; data: T & { error?: string } }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader("Content-Type", contentType);
    if (onUpload) xhr.upload.onprogress = (ev) => onUpload(ev.loaded);
    xhr.onload = () => {
      let data = {} as T & { error?: string };
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON (proxy error page) */
      }
      resolve({ status: xhr.status, data });
    };
    xhr.onerror = () => resolve({ status: 0, data: {} as T & { error?: string } });
    xhr.send(body);
  });
}

export function errorText(t: Dict, status: number, error?: string): string {
  return error || (status ? t.common.error(status) : t.common.networkError);
}

/**
 * Send a file as CHUNK_SIZE pieces to `chunkUrl(uploadId, index)`, each retried
 * a few times. Returns the upload id and piece count to finalize with, or an error.
 */
export async function uploadChunks(
  file: File,
  chunkUrl: (uploadId: string, index: number) => string,
  t: Dict,
  onProgress: (pct: number, note?: string) => void
): Promise<{ uploadId: string; chunks: number } | { error: string }> {
  const uploadId = newUploadId();
  const chunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  const pct = (bytes: number) => Math.min(99, Math.floor((bytes / Math.max(file.size, 1)) * 100));

  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE;
    const piece = file.slice(start, Math.min(file.size, start + CHUNK_SIZE));
    let attempt = 0;
    for (;;) {
      const r = await send("PUT", chunkUrl(uploadId, i), piece, "application/octet-stream", (loaded) =>
        onProgress(pct(start + loaded))
      );
      if (r.status >= 200 && r.status < 300) break;
      // 4xx other than timeouts / rate limits won't get better by retrying
      const retryable = r.status === 0 || r.status >= 500 || r.status === 408 || r.status === 429;
      if (!retryable || ++attempt > 3) return { error: errorText(t, r.status, r.data.error) };
      onProgress(pct(start), t.upload.retrying(attempt));
      await new Promise((res) => setTimeout(res, 1000 * 2 ** attempt));
    }
  }
  return { uploadId, chunks };
}
