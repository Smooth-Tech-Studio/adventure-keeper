import { useState } from "react";
import { toast } from "sonner";
import type { Adventure } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAdventureStart } from "@/lib/adventures";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * GM card on the adventure page: when the story starts — the day, the time and
 * the in-world date the first session's clock opens on.
 */
export function AdventureStartCard({
  campaignId,
  adventureId,
  adventure,
  onChange,
}: {
  campaignId: string;
  adventureId: string;
  adventure: Pick<Adventure, "startDay" | "startTime" | "startDate" | "hasPlayedSession">;
  onChange: () => void;
}) {
  const { t } = useTranslation("adventures", { keyPrefix: "start" });
  const [day, setDay] = useState(adventure.startDay ? String(adventure.startDay) : "");
  const [time, setTime] = useState(adventure.startTime ?? "");
  const [date, setDate] = useState(adventure.startDate ?? "");
  const [busy, setBusy] = useState(false);

  const dayValue = day.trim() ? Math.round(Number(day)) : undefined;
  const dayInvalid = dayValue !== undefined && !(Number.isFinite(dayValue) && dayValue >= 1);
  const timeInvalid = time.trim() !== "" && !TIME.test(time.trim());
  const dirty =
    (dayValue ?? undefined) !== adventure.startDay ||
    (time.trim() || undefined) !== adventure.startTime ||
    (date.trim() || undefined) !== adventure.startDate;

  const summary =
    adventure.startDay || adventure.startTime || adventure.startDate
      ? [
          adventure.startDay ? t("day", { day: adventure.startDay }) : null,
          adventure.startTime,
          adventure.startDate,
        ]
          .filter(Boolean)
          .join(" · ")
      : t("unset");

  async function save() {
    setBusy(true);
    try {
      await setAdventureStart(campaignId, adventureId, {
        day: dayValue,
        time: time.trim() || undefined,
        date: date.trim() || undefined,
      });
      onChange();
      toast.success(t("saved"));
    } catch (error) {
      console.error(error);
      toast.error(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CollapsibleCard title={t("title")} storageKey="adv-start" summary={summary}>
      <form
        id="adventure-start"
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!dayInvalid && !timeInvalid && dirty) void save();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="adventure-start-day">{t("dayLabel")}</Label>
            <Input
              id="adventure-start-day"
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="1"
              value={day}
              aria-invalid={dayInvalid}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adventure-start-time">{t("timeLabel")}</Label>
            <Input
              id="adventure-start-time"
              placeholder="21:00"
              value={time}
              aria-invalid={timeInvalid}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="adventure-start-date">{t("dateLabel")}</Label>
          <Input
            id="adventure-start-date"
            maxLength={80}
            placeholder={t("datePlaceholder")}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {timeInvalid && <p className="text-destructive text-xs">{t("timeInvalid")}</p>}
        <p className="text-muted-foreground text-xs">
          {t(adventure.hasPlayedSession ? "hintPlayed" : "hint")}
        </p>
        <Button
          type="submit"
          size="sm"
          className="justify-self-end"
          disabled={busy || !dirty || dayInvalid || timeInvalid}
        >
          {t("save")}
        </Button>
      </form>
    </CollapsibleCard>
  );
}
