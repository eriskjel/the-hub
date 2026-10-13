import Image from "next/image";
import type { ReactElement } from "react";
import { posterUrl } from "@/lib/media/request";

/** A small TMDB poster, or a blank placeholder. Decorative: the title is always shown next to it. */
export function Poster({
    path,
    size = "w92",
}: {
    path: string | null;
    size?: "w92" | "w185";
}): ReactElement {
    const src = posterUrl(path, size);
    const dims = size === "w92" ? "h-[69px] w-[46px]" : "h-[138px] w-[92px]";
    if (!src) return <div aria-hidden className={`bg-surface-subtle shrink-0 rounded ${dims}`} />;
    return (
        <Image
            src={src}
            alt=""
            width={size === "w92" ? 46 : 92}
            height={size === "w92" ? 69 : 138}
            // TMDB already serves sized images; skip the optimizer.
            unoptimized
            className={`shrink-0 rounded object-cover ${dims}`}
        />
    );
}
