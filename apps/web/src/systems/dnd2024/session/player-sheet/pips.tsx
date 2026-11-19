import { cn } from "@/lib/utils";

interface PipsProps {
  total: number;
  filled: number;
  onChange?: (filled: number) => void;
  className?: string;
  /** Colour of a filled pip. */
  tone?: "primary" | "destructive" | "success";
  label: string;
}

const TONE: Record<NonNullable<PipsProps["tone"]>, string> = {
  primary: "bg-primary border-primary",
  destructive: "bg-destructive border-destructive",
  success: "bg-emerald-500 border-emerald-500",
};

/**
 * A row of dots. Clicking a dot sets `filled` to that many (click the last
 * filled dot again to clear it) — used for spell slots and death saves.
 */
export function Pips({ total, filled, onChange, className, tone = "primary", label }: PipsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)} role="group" aria-label={label}>
      {Array.from({ length: total }, (_, index) => {
        const isFilled = index < filled;
        const next = index + 1 === filled ? index : index + 1;
        return (
          <button
            key={index}
            type="button"
            disabled={!onChange}
            aria-label={`${label} ${index + 1}`}
            aria-pressed={isFilled}
            onClick={() => onChange?.(next)}
            className={cn(
              "size-3.5 rounded-full border transition-colors",
              isFilled ? TONE[tone] : "border-muted-foreground/40 bg-transparent",
              onChange && "hover:border-foreground cursor-pointer",
            )}
          />
        );
      })}
    </div>
  );
}
