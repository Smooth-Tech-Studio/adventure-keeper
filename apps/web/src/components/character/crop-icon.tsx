import type { CSSProperties } from "react";
import type { ImageCrop } from "@adventure-keeper/schemas";

import { cn } from "@/lib/utils";

interface CropIconProps {
  imageUrl?: string;
  crop?: ImageCrop;
  color?: string;
  /** Fallback text (initials) when there is no image. */
  fallback: string;
  size?: number;
  className?: string;
}

/**
 * Renders the character icon: the cropped region of `imageUrl` (via absolute
 * positioning — no image processing) inside a square, or a coloured initials
 * chip when there is no image.
 */
export function CropIcon({ imageUrl, crop, color, fallback, size = 40, className }: CropIconProps) {
  const box: CSSProperties = {
    width: size,
    height: size,
    borderColor: color ?? "var(--border)",
  };

  if (!imageUrl) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
          className,
        )}
        style={{
          ...box,
          backgroundColor: color ? `${color}22` : "var(--muted)",
          color: color ?? "var(--muted-foreground)",
        }}
      >
        {fallback}
      </div>
    );
  }

  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const imgStyle: CSSProperties = {
    position: "absolute",
    width: size / c.w,
    height: size / c.h,
    left: -(c.x * size) / c.w,
    top: -(c.y * size) / c.h,
    maxWidth: "none",
  };

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-md border", className)}
      style={box}
    >
      <img src={imageUrl} alt="" style={imgStyle} draggable={false} />
    </div>
  );
}
