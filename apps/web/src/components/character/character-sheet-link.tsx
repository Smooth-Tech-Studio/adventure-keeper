import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { Crumb } from "@/hooks/use-breadcrumbs";

/** `/characters/:id?campaign=…` — the sheet as read from that campaign. */
function characterSheetPath(characterId: string, campaignId?: string): string {
  return campaignId
    ? `/characters/${characterId}?campaign=${encodeURIComponent(campaignId)}`
    : `/characters/${characterId}`;
}

/**
 * A character's name, linking to their sheet. From a campaign, the sheet then
 * shows what the character shared with it, and the breadcrumbs lead back.
 */
export function CharacterSheetLink({
  characterId,
  campaignId,
  from,
  className,
  children,
}: {
  characterId: string;
  campaignId?: string;
  /** Breadcrumbs back to where the link was clicked. */
  from?: Crumb[];
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={characterSheetPath(characterId, campaignId)}
      state={from ? { from } : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}
