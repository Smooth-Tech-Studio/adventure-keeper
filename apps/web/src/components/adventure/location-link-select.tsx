import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface LocationOption {
  id: string;
  name: string;
}

/**
 * Shared "lié à un lieu" dropdown for enemies / NPCs. Works off a plain
 * `{ id, name }[]` so both the creation form (draft keys) and the detail page
 * (Firestore ids) can feed it. `value` / `onChange` use `""` for "no location".
 */
export function LocationLinkSelect({
  options,
  value,
  onChange,
}: {
  options: LocationOption[];
  value: string;
  onChange: (locationId: string) => void;
}) {
  const { t } = useTranslation("adventures", { keyPrefix: "locations" });
  if (options.length === 0) {
    return <p className="text-muted-foreground text-xs">{t("addFirst")}</p>;
  }
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{t("linked")}</Label>
      <Select
        value={value || "none"}
        onValueChange={(next) => onChange(next === "none" ? "" : next)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("noLink")}</SelectItem>
          {options.map((option, index) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name.trim() || t("fallback", { index: index + 1 })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
