import { createContext, useContext, useEffect } from "react";
import type { CharacterSystem } from "@adventure-keeper/schemas";

import { getSystem } from "@/systems";

/**
 * The licences whose attribution a page may need to show. Each game system
 * that ships open content adds its own entry, worded under `licence.<id>` in
 * the `common` translations; the full text lives on /credits.
 */
export const LICENCE_NOTICES = ["srd521"] as const;

export type LicenceNoticeId = (typeof LICENCE_NOTICES)[number];

export const LicenceNoticeContext = createContext<LicenceNoticeId | null>(null);
export const SetLicenceNoticeContext = createContext<
  ((notice: LicenceNoticeId | null) => void) | undefined
>(undefined);

/** The notice published by the current page, for the footer. */
export function useLicenceNoticeValue(): LicenceNoticeId | null {
  return useContext(LicenceNoticeContext);
}

/**
 * Show a licence's attribution in the footer while the page displays content
 * under it (a 5E sheet, a 5E campaign…). `null` while there is none, or while
 * the page is still loading and can't tell yet.
 */
export function useLicenceNotice(notice: LicenceNoticeId | null) {
  const setNotice = useContext(SetLicenceNoticeContext);
  if (!setNotice) throw new Error("useLicenceNotice must be used within a LicenceNoticeProvider");
  useEffect(() => {
    setNotice(notice);
  }, [notice, setNotice]);
  useEffect(() => () => setNotice(null), [setNotice]);
}

/** A 5E campaign shows SRD content: its monsters, and its sheets if they are 5E. */
export function campaignLicenceNotice(
  campaign: { system: string; characterSystem: CharacterSystem } | null | undefined,
): LicenceNoticeId | null {
  if (!campaign) return null;
  return campaign.system === "dnd5e" ? "srd521" : getSystem(campaign.characterSystem).licenceNotice;
}
