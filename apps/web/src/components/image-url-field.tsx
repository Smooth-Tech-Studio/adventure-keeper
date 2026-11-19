import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUpIcon, InfoIcon, LoaderIcon, Trash2Icon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Trans, useTranslation } from "react-i18next";
import type { ImageCrop } from "@adventure-keeper/schemas";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CropIcon } from "@/components/character/crop-icon";
import { useImageStorage } from "@/hooks/use-image-storage";
import { imageFileProblem } from "@/lib/image-storage";
import { toDirectImageUrl } from "@/lib/image-url";

export interface ImageUrlValue {
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
  value: ImageUrlValue;
  onChange: (value: ImageUrlValue) => void;
  label?: string;
  placeholder?: string;
  /** Square-icon cropping (character portraits). When false, shows a plain rectangular preview. */
  crop?: boolean;
}

function HostingHelp() {
  const { t } = useTranslation();
  return (
    <div className="grid gap-1.5 text-left">
      <p className="font-medium">{t("imageField.helpTitle")}</p>
      <p>
        <Trans i18nKey="imageField.helpDrive" components={{ strong: <strong /> }} />
      </p>
      <p>
        <Trans i18nKey="imageField.helpDropbox" components={{ strong: <strong /> }} />
      </p>
      <p>{t("imageField.helpConverted")}</p>
    </div>
  );
}

/**
 * Image = a link to an externally-hosted image (no upload). With `crop` (the
 * default), a square region of it can be picked as an icon (`imageCrop`,
 * fractions of the natural size) and rendered by CSS cropping — no image
 * processing. Without it, the image is just previewed as-is.
 */
export function ImageUrlField({ value, onChange, label, placeholder, crop = true }: Props) {
  const { t } = useTranslation();
  const imgRef = useRef<HTMLImageElement>(null);
  const [dims, setDims] = useState<Dims | null>(null);
  const [broken, setBroken] = useState(false);
  const dragRef = useRef<{ dxFrac: number; dyFrac: number } | null>(null);

  const cropBox = value.imageCrop ?? { x: 0, y: 0, w: 1, h: 1 };
  const storage = useImageStorage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // An image from the device: up to the player's store, its link into the field.
  async function importFile(file: File) {
    const problem = imageFileProblem(file);
    if (problem) {
      toast.error(t(`imageField.${problem}`));
      return;
    }
    setUploading(true);
    try {
      setUrl(await storage.upload(file));
      toast.success(t("imageField.imported"));
    } catch (error) {
      console.error(error);
      toast.error(t("imageField.importFailed"));
    } finally {
      setUploading(false);
    }
  }

  const measure = useCallback(() => {
    const el = imgRef.current;
    if (el && el.clientWidth > 0) {
      setDims({ width: el.clientWidth, height: el.clientHeight });
    }
  }, []);

  useEffect(() => {
    if (!crop) return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [crop, measure]);

  function setUrl(raw: string) {
    const url = toDirectImageUrl(raw);
    setBroken(false);
    setDims(null);
    onChange(url ? { imageUrl: url, imageCrop: undefined } : {});
  }

  function onImageLoad() {
    setBroken(false);
    if (!crop) return;
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
    const cx = cropBox.x + cropBox.w / 2;
    const cy = cropBox.y + cropBox.h / 2;
    const x = Math.min(Math.max(cx - w / 2, 0), 1 - w);
    const y = Math.min(Math.max(cy - h / 2, 0), 1 - h);
    onChange({ ...value, imageCrop: { x, y, w, h } });
  }

  function onBoxPointerDown(event: React.PointerEvent) {
    if (!dims) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    dragRef.current = {
      dxFrac: (event.clientX - rect.left) / dims.width - cropBox.x,
      dyFrac: (event.clientY - rect.top) / dims.height - cropBox.y,
    };
  }

  function onBoxPointerMove(event: React.PointerEvent) {
    if (!dragRef.current || !dims) return;
    const rect = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const x = Math.min(
      Math.max((event.clientX - rect.left) / dims.width - dragRef.current.dxFrac, 0),
      1 - cropBox.w,
    );
    const y = Math.min(
      Math.max((event.clientY - rect.top) / dims.height - dragRef.current.dyFrac, 0),
      1 - cropBox.h,
    );
    onChange({ ...value, imageCrop: { ...cropBox, x, y } });
  }

  function onBoxPointerUp(event: React.PointerEvent) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }

  const sizePct = dims ? Math.round(cropBox.w * 100) : 60;

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="imageUrl">{label ?? t("imageField.label")}</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex"
                aria-label={t("imageField.helpLabel")}
              >
                <InfoIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <HostingHelp />
            </TooltipContent>
          </Tooltip>
        </div>
        <Input
          id="imageUrl"
          type="url"
          inputMode="url"
          placeholder={placeholder ?? t("imageField.placeholder")}
          value={value.imageUrl ?? ""}
          onChange={(event) => setUrl(event.target.value)}
        />
        {storage.connection ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? <LoaderIcon className="animate-spin" /> : <ImageUpIcon />}
              {uploading ? t("imageField.importing") : t("imageField.import")}
            </Button>
            <span className="text-muted-foreground text-xs">{t("imageField.importHint")}</span>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void importFile(file);
              }}
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            {t("imageField.hint")}
            {storage.available && storage.connection === null && (
              <>
                {" "}
                <Link to="/profil#image-storage" className="underline underline-offset-2">
                  {t("imageField.connectStorage")}
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      {value.imageUrl &&
        (crop ? (
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
                  aria-label={t("imageField.cropZone")}
                  aria-valuenow={sizePct}
                  tabIndex={0}
                  onPointerDown={onBoxPointerDown}
                  onPointerMove={onBoxPointerMove}
                  onPointerUp={onBoxPointerUp}
                  className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                  style={{
                    left: `${cropBox.x * 100}%`,
                    top: `${cropBox.y * 100}%`,
                    width: `${cropBox.w * 100}%`,
                    height: `${cropBox.h * 100}%`,
                  }}
                />
              )}
            </div>

            <div className="flex flex-col items-start gap-3">
              {broken ? (
                <p className="text-destructive text-sm">{t("imageField.broken")}</p>
              ) : (
                <>
                  <div className="grid gap-1">
                    <span className="text-muted-foreground text-xs">
                      {t("imageField.iconPreview")}
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
                      {t("imageField.zoneSize")}
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
                <Trash2Icon /> {t("imageField.remove")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <div className="w-full max-w-sm overflow-hidden rounded-md border">
              <img
                src={value.imageUrl}
                alt=""
                className="block max-h-64 w-full object-contain"
                onLoad={onImageLoad}
                onError={() => setBroken(true)}
              />
            </div>
            {broken && <p className="text-destructive text-sm">{t("imageField.broken")}</p>}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => setUrl("")}
            >
              <Trash2Icon /> {t("imageField.remove")}
            </Button>
          </div>
        ))}
    </div>
  );
}
