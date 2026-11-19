import { CheckIcon, PaletteIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ColorPicker } from "@/components/ui/color-picker";
import { cn } from "@/lib/utils";

const PRESETS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#78716c",
];

interface ColorFieldProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

export function ColorField({ value, onChange }: ColorFieldProps) {
  const { t } = useTranslation("characters", { keyPrefix: "color" });
  const isCustom = Boolean(value) && !PRESETS.includes(value!.toLowerCase());

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((color) => {
        const active = value?.toLowerCase() === color;
        return (
          <button
            key={color}
            type="button"
            aria-label={t("preset", { color })}
            aria-pressed={active}
            onClick={() => onChange(color)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full border transition",
              active ? "ring-ring ring-2 ring-offset-2" : "hover:scale-110",
            )}
            style={{ backgroundColor: color }}
          >
            {active && <CheckIcon className="size-4 text-white" />}
          </button>
        );
      })}

      <ColorPicker
        value={value ?? "#888888"}
        onChange={(hex) => onChange(hex)}
        tooltip={t("custom")}
      >
        <button
          type="button"
          aria-label={t("custom")}
          aria-pressed={isCustom}
          className={cn(
            "border-input flex size-7 items-center justify-center rounded-full border text-[10px] transition",
            isCustom ? "ring-ring ring-2 ring-offset-2" : "hover:scale-110",
          )}
          style={value ? { backgroundColor: value } : undefined}
        >
          <PaletteIcon aria-hidden className="size-3.5" />
        </button>
      </ColorPicker>

      {value && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <XIcon className="size-3" /> retirer
        </button>
      )}
    </div>
  );
}
