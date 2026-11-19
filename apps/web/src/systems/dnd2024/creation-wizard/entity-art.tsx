import { hueStyle } from "@/systems/dnd2024/creation-wizard/entity-facts";
import { cn } from "@/lib/utils";

/** A small square portrait: the tint and the initial. */
export function EntityPortrait({
  id,
  name,
  imageUrl,
  className,
}: {
  id: string;
  name: string;
  /** An illustration from the pack, in place of the tint. */
  imageUrl?: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className={cn("size-12 shrink-0 rounded-lg object-cover", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={hueStyle(id)}
      className={cn(
        "wizard-art text-foreground/30 grid size-12 shrink-0 place-items-center rounded-lg text-xl font-semibold",
        className,
      )}
    >
      {name.charAt(0)}
    </div>
  );
}
