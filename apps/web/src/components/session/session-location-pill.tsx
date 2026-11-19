import { MapPinIcon } from "lucide-react";

/** Top-bar pill naming the location the GM is currently showing. */
export function SessionLocationPill({ name }: { name?: string }) {
  return (
    <div
      id="session-location-pill"
      className="bg-background/90 flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm shadow-sm backdrop-blur"
    >
      <MapPinIcon className="size-4 opacity-70" />
      <span className="max-w-[9rem] truncate font-medium">{name ?? "Aucun lieu"}</span>
    </div>
  );
}
