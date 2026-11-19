import type { ImageCrop } from "@adventure-keeper/schemas";

import { CropIcon } from "@/components/character/crop-icon";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A user's avatar: the cropped part of their image, round, or their initials.
 * Same crop model as a character portrait (`CropIcon`).
 */
export function UserAvatar({
  name,
  photoURL,
  photoCrop,
  size = 32,
  className,
}: {
  name: string;
  photoURL?: string;
  photoCrop?: ImageCrop;
  size?: number;
  className?: string;
}) {
  return (
    <CropIcon
      imageUrl={photoURL}
      crop={photoCrop}
      fallback={initials(name || "?")}
      size={size}
      className={cn("rounded-full", className)}
    />
  );
}
