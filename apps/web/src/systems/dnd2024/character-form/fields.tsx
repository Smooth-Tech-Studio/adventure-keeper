import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Marker put on every rendered validation message. The form uses it to scroll
 * to the first problem after a failed submit — see `scrollToFirstError()` in
 * `character-form/index.tsx`.
 */
export const FORM_ERROR_ATTR = "data-form-error";

/**
 * One validation message. Renders nothing when there is no error, so callers
 * can drop it in unconditionally.
 *
 * `role="alert"` announces it to screen readers; `tabIndex={-1}` lets the form
 * move focus here so keyboard users land on the problem instead of hunting for
 * it down a form several screens tall.
 */
export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p
      {...{ [FORM_ERROR_ATTR]: "" }}
      role="alert"
      tabIndex={-1}
      className="text-destructive text-sm outline-none"
    >
      {children}
    </p>
  );
}

export function FieldSelect({
  label,
  placeholder,
  value,
  onValueChange,
  options,
  error,
  disabled,
  hint,
  fallbackLabel,
}: {
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string; description?: string }[];
  error?: string;
  disabled?: boolean;
  /** A line under the field (e.g. which content pack the choice comes from). */
  hint?: React.ReactNode;
  /** Shown for a value none of the options matches, instead of the placeholder. */
  fallbackLabel?: string;
}) {
  // Radix renders the chosen item's children into the trigger, which would drag
  // the description up there and make the closed field two lines tall. Naming
  // the label explicitly keeps the trigger to the name.
  const selected = options.find((option) => option.value === value);

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            {selected?.label ?? (value ? fallbackLabel : undefined)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {/* A bare « Loyal Neutre » or « Rôdeur » asks the player to choose
                  blind; the catalogues have carried the one-liner all along. */}
              <span className="grid gap-0.5 pr-2">
                <span>{option.label}</span>
                {option.description && (
                  <span className="text-muted-foreground max-w-80 text-xs leading-snug text-pretty">
                    {option.description}
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint}
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
      />
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-muted/40 rounded-lg border px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
