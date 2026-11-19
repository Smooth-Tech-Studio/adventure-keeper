import { MoonIcon, SettingsIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLanguage } from "@/hooks/use-language";
import { isLanguage, LANGUAGE_NAMES, LANGUAGES } from "@/i18n";

/** The navbar's settings — language and light / dark theme, open to guests too. */
export function SettingsMenu() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("settings.label")}>
          <SettingsIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-60 flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-language">{t("language.label")}</Label>
          <Select
            value={language}
            onValueChange={(value) => {
              if (isLanguage(value)) void setLanguage(value);
            }}
          >
            <SelectTrigger id="settings-language" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((code) => (
                <SelectItem key={code} value={code} lang={code}>
                  {LANGUAGE_NAMES[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("theme.label")}</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            className="w-full"
            aria-label={t("theme.label")}
            value={resolvedTheme === "dark" ? "dark" : "light"}
            onValueChange={(value) => value && setTheme(value)}
          >
            <ToggleGroupItem value="light" className="flex-1">
              <SunIcon /> {t("theme.light")}
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" className="flex-1">
              <MoonIcon /> {t("theme.dark")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </PopoverContent>
    </Popover>
  );
}
