import {
  COMMON_DICES,
  DICE_LABELS,
  type Die,
  type DicePool,
} from "@adventure-keeper/system-dnd2024";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  value: DicePool | undefined;
  onChange: (value: DicePool | undefined) => void;
  /** Allow clearing to `undefined` (adds a "—" option). */
  clearable?: boolean;
  /** Dice offered in the list (default: d4–d12). */
  dice?: Die[];
}

const NONE = "__none__";

/** A number-of-dice input paired with a die-type dropdown (e.g. `2` × `d6`). */
export function DicePoolField({ value, onChange, clearable = false, dice = COMMON_DICES }: Props) {
  const count = value?.count ?? 1;
  const die = value?.die ?? dice[0];

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={1}
        max={100}
        className="w-16 text-center"
        value={count}
        onChange={(e) => onChange({ count: Math.max(1, Number(e.target.value) || 1), die })}
      />
      <span className="text-muted-foreground">×</span>
      <Select
        value={value ? die : NONE}
        onValueChange={(v) =>
          v === NONE ? onChange(undefined) : onChange({ count, die: v as Die })
        }
      >
        <SelectTrigger className="flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {clearable && <SelectItem value={NONE}>—</SelectItem>}
          {dice.map((d) => (
            <SelectItem key={d} value={d}>
              {DICE_LABELS[d]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
