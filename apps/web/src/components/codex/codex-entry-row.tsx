import { Link } from "react-router-dom";
import type { CodexEntry } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { CODEX_KIND_ICONS } from "@/components/codex/codex-kinds";

/** A codex entry in a short list: its kind's icon, its name as a link, its kind. */
export function CodexEntryRow({
  entry,
  to,
}: {
  entry: Pick<CodexEntry, "kind" | "name">;
  to: string;
}) {
  const { t } = useTranslation("codex");
  const Icon = CODEX_KIND_ICONS[entry.kind];
  return (
    <li className="flex items-center gap-2 py-1.5 text-sm">
      <Icon className="text-muted-foreground size-3.5 shrink-0" />
      <Link
        to={to}
        className="min-w-0 flex-1 truncate underline decoration-dotted underline-offset-4 hover:decoration-solid"
      >
        {entry.name}
      </Link>
      <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
        {t(`kinds.${entry.kind}`)}
      </span>
    </li>
  );
}
