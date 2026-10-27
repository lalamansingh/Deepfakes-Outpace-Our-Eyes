import type { NextRequest } from "next/server";
import { notFound, route } from "@/lib/server/http";
import { readLocalMedia } from "@/lib/server/storage";

const headersFor = (mime: string, length: number) => ({
  "Content-Type": mime,
  "Content-Length": String(length),
  "Cache-Control": "public, max-age=31536000, immutable",
  "Accept-Ranges": "bytes",
  "X-Content-Type-Options": "nosniff",
});

/** Serves locally stored uploads, with byte ranges so audio and video can seek. */
export const GET = route<{ key: string }>(async (req: NextRequest, { key }) => {
  const file = await readLocalMedia(key);
  if (!file) throw notFound("Media");
  const size = file.body.length;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const chunk = file.body.subarray(start, end + 1);
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: { ...headersFor(file.mime, chunk.length), "Content-Range": `bytes ${start}-${end}/${size}` },
    });
  }
  return new Response(new Uint8Array(file.body), { headers: headersFor(file.mime, size) });
});
