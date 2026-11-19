import {
  BookOpenIcon,
  CrownIcon,
  FileTextIcon,
  GemIcon,
  MapPinIcon,
  ShapesIcon,
  SunIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";
import type { CodexKind } from "@adventure-keeper/schemas";

/** One icon per kind of codex entry. */
export const CODEX_KIND_ICONS: Record<CodexKind, LucideIcon> = {
  npc: UserIcon,
  place: MapPinIcon,
  faction: CrownIcon,
  item: GemIcon,
  deity: SunIcon,
  document: FileTextIcon,
  other: ShapesIcon,
};

export const CODEX_ICON: LucideIcon = BookOpenIcon;
