import { useState } from "react";
import { MinusIcon, MoonIcon, PlusIcon, SunIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBufferedValue } from "@/hooks/use-buffered-writes";
import { isNightTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stepGameTime, type GameTime } from "@/lib/game-time";
import { STEPPER_WRITE_MS } from "@/lib/write-buffer";

interface Props {
  value: GameTime;
  /** GM only — enables the −30 / edit / +30 controls. Players get a read-only pill. */
  onChange?: (value: GameTime) => void;
  /** The −30 / +30 buttons (on by default); without them, a tap still edits. */
  steps?: boolean;
}

/**
 * In-map in-game clock: the day (« Jour 3 ») and the time, with a sun or a
 * moon. The GM moves it by 30 minutes — past midnight the day goes up — or
 * types both; players read it.
 */
export function GameClock({ value: remote, onChange, steps = true }: Props) {
  const { t } = useTranslation("session", { keyPrefix: "clock" });
  // −30 / +30: shown at once, written once the clicks stop.
  const [value, setValue] = useBufferedValue<GameTime>(remote, (next) => onChange?.(next), {
    delay: STEPPER_WRITE_MS,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ day: "", time: "" });
  const day = value.day ?? 1;

  const icon = isNightTime(value.time) ? (
    <MoonIcon className="size-4 opacity-70" />
  ) : (
    <SunIcon className="size-4 opacity-70" />
  );
  const dayLabel = <span className="text-muted-foreground">{t("day", { day })}</span>;

  if (!onChange) {
    return (
      <div
        id="session-clock"
        className="bg-background/90 flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm shadow-sm backdrop-blur"
      >
        {icon}
        {dayLabel}
        <span className="font-medium tabular-nums">{value.time || "--:--"}</span>
      </div>
    );
  }

  function commit() {
    setEditing(false);
    const time = draft.time.trim() || value.time;
    const parsed = Math.round(Number(draft.day));
    const nextDay = Number.isFinite(parsed) && parsed >= 1 ? parsed : day;
    if (time !== value.time || nextDay !== day) setValue({ day: nextDay, time });
  }

  return (
    <div
      id="session-clock"
      className={cn(
        "bg-background/90 flex items-center gap-1 rounded-full border py-1 pl-2 text-sm shadow-sm backdrop-blur",
        steps ? "pr-1" : "pr-2",
      )}
    >
      {icon}
      {steps && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-6"
          aria-label={t("back")}
          onClick={() => setValue(stepGameTime(value, -30))}
        >
          <MinusIcon className="size-3.5" />
        </Button>
      )}
      {editing ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            commit();
          }}
          onBlur={(event) => {
            // Leaving both fields, not moving from one to the other.
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) commit();
          }}
          onKeyDown={(event) => event.key === "Escape" && setEditing(false)}
        >
          <Input
            aria-label={t("dayLabel")}
            type="number"
            min={1}
            value={draft.day}
            onChange={(event) => setDraft((d) => ({ ...d, day: event.target.value }))}
            className="h-6 w-14 px-1 text-center text-sm"
          />
          <Input
            autoFocus
            aria-label={t("timeLabel")}
            value={draft.time}
            onChange={(event) => setDraft((d) => ({ ...d, time: event.target.value }))}
            placeholder="14:00"
            className="h-6 w-16 px-1 text-center text-sm"
          />
          <button type="submit" hidden />
        </form>
      ) : (
        <button
          type="button"
          aria-label={t("edit")}
          className="hover:bg-accent flex min-w-[3rem] items-center gap-1.5 rounded px-1 text-center font-medium tabular-nums"
          onClick={() => {
            setDraft({ day: String(day), time: value.time ?? "" });
            setEditing(true);
          }}
        >
          {dayLabel}
          {value.time || "--:--"}
        </button>
      )}
      {steps && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-6"
          aria-label={t("forward")}
          onClick={() => setValue(stepGameTime(value, 30))}
        >
          <PlusIcon className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
