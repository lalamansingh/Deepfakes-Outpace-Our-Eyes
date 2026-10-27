/** Media previews for library items. Media URLs are same-origin paths, so a plain <img> is used. */
import clsx from "clsx";
import { AudioLines, Film } from "lucide-react";
import type { MediaType } from "@/lib/contracts";

export function MediaThumb({ mediaType, mediaUrl, alt, className }: { mediaType: MediaType; mediaUrl: string; alt: string; className?: string }) {
  if (mediaType === "image" && mediaUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded media of unknown size
      <img src={mediaUrl} alt={alt} loading="lazy" className={clsx("rounded-lg border border-line bg-tint object-cover", className)} />
    );
  }
  const Icon = mediaType === "audio" ? AudioLines : Film;
  return (
    <span className={clsx("grid place-items-center rounded-lg border border-line bg-tint text-wine", className)} role="img" aria-label={alt}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}
