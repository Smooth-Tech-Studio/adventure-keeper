import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2Icon } from "lucide-react";
import type { ImageCrop } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CropIcon } from "@/components/character/crop-icon";
import { toDirectImageUrl } from "@/lib/image-url";

export interface CharacterImageValue {
  imageUrl?: string;
  imageCrop?: ImageCrop;
}

interface Dims {
  width: number;
  height: number;
}

function centeredCrop(dims: Dims): ImageCrop {
  const sidePx = Math.min(dims.width * 0.6, dims.height);
  const w = sidePx / dims.width;
  const h = sidePx / dims.height;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

interface Props {
  value: CharacterImageValue;
  onChange: (value: CharacterImageValue) => void;
}

/**
 * Character image = a link to an externally-hosted image (no upload). A square
 * region of it is picked as the icon (`imageCrop`, fractions of the natural
 * size) and rendered by CSS cropping — no image processing.
 */
export function CharacterImageField({ value, onChange }: Props) {
  const { t } = useTranslation(["characters", "common"]);
  const imgRef = useRef<HTMLImageElement>(null);
  const [dims, setDims] = useState<Dims | null>(null);
  const [broken, setBroken] = useState(false);
  const dragRef = useRef<{ dxFrac: number; dyFrac: number } | null>(null);

  const crop = value.imageCrop ?? { x: 0, y: 0, w: 1, h: 1 };

  const measure = useCallback(() => {
    const el = imgRef.current;
    if (el && el.clientWidth > 0) {
      setDims({ width: el.clientWidth, height: el.clientHeight });
    }
  }, []);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  function setUrl(raw: string) {
    const url = toDirectImageUrl(raw);
    setBroken(false);
    setDims(null);
    onChange(url ? { imageUrl: url, imageCrop: undefined } : {});
  }

  function onImageLoad() {
    setBroken(false);
    measure();
    if (!value.imageCrop && imgRef.current && imgRef.current.clientWidth > 0) {
      onChange({
        ...value,
        imageCrop: centeredCrop({
          width: imgRef.current.clientWidth,
          height: imgRef.current.clientHeight,
        }),
      });
    }
  }

  function setSizePct(pct: number) {
    if (!dims) return;
    const sidePx = Math.min((pct / 100) * dims.width, dims.height, dims.width);
    const w = sidePx / dims.width;
    const h = sidePx / dims.height;
    const cx = crop.x + crop.w / 2;
    const cy = crop.y + crop.h / 2;
    const x = Math.min(Math.max(cx - w / 2, 0), 1 - w);
    const y = Math.min(Math.max(cy - h / 2, 0), 1 - h);
    onChange({ ...value, imageCrop: { x, y, w, h } });
  }

  function onBoxPointerDown(event: React.PointerEvent) {
    if (!dims) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    dragRef.current = {
      dxFrac: (event.clientX - rect.left) / dims.width - crop.x,
      dyFrac: (event.clientY - rect.top) / dims.height - crop.y,
    };
  }

  function onBoxPointerMove(event: React.PointerEvent) {
    if (!dragRef.current || !dims) return;
    const rect = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const x = Math.min(
      Math.max((event.clientX - rect.left) / dims.width - dragRef.current.dxFrac, 0),
      1 - crop.w,
    );
    const y = Math.min(
      Math.max((event.clientY - rect.top) / dims.height - dragRef.current.dyFrac, 0),
      1 - crop.h,
    );
    onChange({ ...value, imageCrop: { ...crop, x, y } });
  }

  function onBoxPointerUp(event: React.PointerEvent) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  const sizePct = dims ? Math.round(crop.w * 100) : 60;

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="imageUrl">{t("imageField.label")}</Label>
        <Input
          id="imageUrl"
          type="url"
          inputMode="url"
          placeholder={t("imageField.placeholder")}
          value={value.imageUrl ?? ""}
          onChange={(event) => setUrl(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">{t("common:imageField.hint")}</p>
      </div>

      {value.imageUrl && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="relative w-full max-w-sm touch-none overflow-hidden rounded-md border select-none">
            <img
              ref={imgRef}
              src={value.imageUrl}
              alt=""
              className="block w-full"
              draggable={false}
              onLoad={onImageLoad}
              onError={() => setBroken(true)}
            />
            {dims && !broken && (
              <div
                role="slider"
                aria-label={t("common:imageField.cropZone")}
                aria-valuenow={sizePct}
                tabIndex={0}
                onPointerDown={onBoxPointerDown}
                onPointerMove={onBoxPointerMove}
                onPointerUp={onBoxPointerUp}
                className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                }}
              />
            )}
          </div>

          <div className="flex flex-col items-start gap-3">
            {broken ? (
              <p className="text-destructive text-sm">{t("common:imageField.broken")}</p>
            ) : (
              <>
                <div className="grid gap-1">
                  <span className="text-muted-foreground text-xs">
                    {t("common:imageField.iconPreview")}
                  </span>
                  <CropIcon
                    imageUrl={value.imageUrl}
                    crop={value.imageCrop}
                    fallback=""
                    size={72}
                  />
                </div>
                <label className="grid w-full gap-1">
                  <span className="text-muted-foreground text-xs">
                    {t("common:imageField.zoneSize")}
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={sizePct}
                    onChange={(event) => setSizePct(Number(event.target.value))}
                  />
                </label>
              </>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setUrl("")}>
              <Trash2Icon /> {t("common:imageField.remove")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
