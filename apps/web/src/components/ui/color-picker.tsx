import * as React from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { tr } from "@/i18n";

interface ColorPickerProps {
  /** Current colour as a `#rrggbb` string. */
  value: string;
  onChange: (value: string) => void;
  /** The element that opens the picker (rendered via `asChild`). */
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  /** Optional hover/focus tooltip on the trigger. */
  tooltip?: string;
}

/**
 * A saturation/hue picker (react-colorful) with a hex field, in a shadcn
 * {@link Popover}. Bring your own trigger as `children`.
 */
export function ColorPicker({
  value,
  onChange,
  children,
  align = "start",
  tooltip,
}: ColorPickerProps) {
  const trigger = <PopoverTrigger asChild>{children}</PopoverTrigger>;
  return (
    <Popover>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <PopoverContent
        align={align}
        className="w-auto space-y-3 p-3 [&_.react-colorful]:h-40 [&_.react-colorful]:w-40"
      >
        <HexColorPicker color={value} onChange={onChange} />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">#</span>
          <HexColorInput
            color={value}
            onChange={onChange}
            aria-label={tr("common:hexCode")}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-8 w-full rounded-md border bg-transparent px-2 text-sm uppercase shadow-xs outline-none focus-visible:ring-[3px]"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
