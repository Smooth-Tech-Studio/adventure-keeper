import { useState } from "react";
import type { MapScale } from "@adventure-keeper/schemas";
import { RulerIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scaleFromPoints, squaresAcross } from "@/lib/map-scale";

type Point = MapScale["from"];

/**
 * Sets a map's scale: two clicks on the preview mark a known distance, then
 * its length in metres. A third click starts a new measure.
 */
export function MapScaleCalibrator({
  imageUrl,
  value,
  onChange,
}: {
  imageUrl: string;
  value: MapScale | undefined;
  onChange: (scale: MapScale | undefined) => void;
}) {
  const { t } = useTranslation("adventures");
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  // Points placed but not yet measured; the saved scale's otherwise.
  const [points, setPoints] = useState<Point[]>(value ? [value.from, value.to] : []);
  const [metres, setMetres] = useState(value ? String(value.metres) : "");

  function commit(next: Point[], distance: string) {
    const parsed = Number(distance.replace(",", "."));
    const [from, to] = next;
    onChange(
      natural && from && to
        ? (scaleFromPoints(from, to, parsed, natural.width, natural.height) ?? undefined)
        : undefined,
    );
  }

  function place(e: React.MouseEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const point = {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    };
    const next = points.length === 1 ? [points[0]!, point] : [point];
    setPoints(next);
    commit(next, metres);
  }

  function clear() {
    setPoints([]);
    setMetres("");
    onChange(undefined);
  }

  const [a, b] = points;
  const squares = value ? Math.max(1, Math.round(squaresAcross(value))) : null;
  const prompt = !a ? t("locations.scalePickA") : !b ? t("locations.scalePickB") : null;

  return (
    <div id="location-scale" className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1 text-xs">
          <RulerIcon className="size-3.5" /> {t("locations.scale")}
        </Label>
        {(points.length > 0 || value) && (
          <Button type="button" size="sm" variant="ghost" className="h-6 px-2" onClick={clear}>
            <XIcon className="size-3.5" /> {t("locations.scaleClear")}
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">{prompt ?? t("locations.scaleHint")}</p>
      <div
        id="location-scale-preview"
        className="relative cursor-crosshair overflow-hidden rounded-md border select-none"
        onClick={place}
      >
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          className="block w-full"
          onLoad={(e) =>
            setNatural({
              width: e.currentTarget.naturalWidth,
              height: e.currentTarget.naturalHeight,
            })
          }
        />
        {value && natural && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <ScaleGrid scale={value} natural={natural} />
          </div>
        )}
        <svg
          className="pointer-events-none absolute inset-0 size-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {a && b && (
            <line
              x1={a.x * 100}
              y1={a.y * 100}
              x2={b.x * 100}
              y2={b.y * 100}
              stroke="#e11d48"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {points.map((p, i) => (
          <span
            key={i}
            className="pointer-events-none absolute size-3 -translate-1/2 rounded-full border-2 border-white bg-rose-600 shadow"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          />
        ))}
      </div>
      {b && (
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="location-scale-metres" className="text-xs">
            {t("locations.scaleDistance")}
          </Label>
          <Input
            id="location-scale-metres"
            inputMode="decimal"
            className="h-8 w-24"
            value={metres}
            onChange={(e) => {
              setMetres(e.target.value);
              commit(points, e.target.value);
            }}
          />
          <span className="text-muted-foreground text-xs">m</span>
          {squares !== null && (
            <span id="location-scale-result" className="text-muted-foreground text-xs">
              {t("locations.scaleResult", { count: squares })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** The squares over the preview, cell by cell so they stay square. */
function ScaleGrid({
  scale,
  natural,
}: {
  scale: MapScale;
  natural: { width: number; height: number };
}) {
  const cell = 100 / squaresAcross(scale);
  const cellY = (cell * natural.width) / natural.height;
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(0,0,0,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.35) 1px, transparent 1px)",
        backgroundSize: `${cell}% ${cellY}%`,
      }}
    />
  );
}
