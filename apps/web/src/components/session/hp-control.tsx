import { HeartIcon, MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tr } from "@/i18n";

interface Props {
  current: number;
  max: number;
  onChange: (value: number) => void;
}

/**
 * The `♥ [−] [ input ] [+] / max PV` row shared by the session player panels.
 * Renders a fragment of inline items — wrap it in a flex row, and add trailing
 * siblings (e.g. an HP-ratio bar) after it as needed.
 */
export function HpControl({ current, max, onChange }: Props) {
  const clamp = (v: number) => Math.max(0, Math.min(max, v));
  return (
    <>
      <HeartIcon className="text-destructive size-4 shrink-0" />
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-7"
        aria-label={tr("session:hud.minusHp")}
        onClick={() => onChange(clamp(current - 1))}
      >
        <MinusIcon className="size-3.5" />
      </Button>
      <Input
        type="number"
        className="h-7 w-14 text-center"
        value={current}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
      />
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-7"
        aria-label={tr("session:hud.plusHp")}
        onClick={() => onChange(clamp(current + 1))}
      >
        <PlusIcon className="size-3.5" />
      </Button>
      <span className="text-muted-foreground text-xs">/ {max} PV</span>
    </>
  );
}
