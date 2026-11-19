import { packLanguages, type ContentPack } from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { LANGUAGE_NAMES } from "@/i18n";

type TranslatablePack = Pick<ContentPack, "language" | "translations">;

/** The pack's language, shown only when the pack cannot be read in the reader's. */
export function PackLanguageBadge({ pack }: { pack: TranslatablePack }) {
  const { t, i18n } = useTranslation("packs");
  const languages = packLanguages(pack);
  if (languages.some((code) => code === i18n.resolvedLanguage)) return null;
  const names = languages.map((code) => LANGUAGE_NAMES[code]).join(", ");
  return (
    <Badge variant="outline" title={t("language.title", { language: names })}>
      {LANGUAGE_NAMES[languages[0]]}
    </Badge>
  );
}
