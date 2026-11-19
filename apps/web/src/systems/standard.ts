import { CHARACTER_SYSTEM_LABELS } from "@adventure-keeper/schemas";

import type { RulesSystem } from "@/systems/types";

/** The free sheet: a name, hit points, an inventory and notes — no rules. */
export const standardSystem: RulesSystem = {
  id: "standard",
  get label() {
    return CHARACTER_SYSTEM_LABELS.standard;
  },
  licenceNotice: null,
  contentPacks: false,
  personality: false,

  subtitle: () => CHARACTER_SYSTEM_LABELS.standard,
  combatStats: () => ({ initiativeBonus: 0 }),
  companions: () => [],
  personalityOf: () => undefined,
  experienceOf: () => null,

  withContent: (input) => input,
  derivedFields: () => ({}),
  storedDefaults: () => ({}),
  clearableFields: ["color", "imageUrl", "imageCrop", "notes"],
  sessionFields: ["inventory"],
};
