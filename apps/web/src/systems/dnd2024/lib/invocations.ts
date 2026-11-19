import {
  getInvocation,
  validInvocations,
  type InvocationDef,
  type InvocationPick,
  type SpellDef,
  hasInvocations,
} from "@adventure-keeper/system-dnd2024";

import { sortedByLabel } from "@/lib/sort";

/** A chosen invocation ready to display, with the cantrip it is attached to, if any. */
export interface InvocationEntry {
  invocation: InvocationDef;
  cantripName?: string;
}

/**
 * The invocations a character actually has (level, prerequisites and cantrip
 * checked), alphabetical, with their cantrip's name. Empty for non-Warlocks.
 */
export function invocationEntries(
  character: {
    classId: string;
    level?: number;
    eldritchInvocations?: readonly (InvocationPick | string)[];
  },
  spells: SpellDef[] | null,
): InvocationEntry[] {
  if (!hasInvocations(character.classId ?? "")) return [];
  const entries = validInvocations(
    character.eldritchInvocations ?? [],
    character.level ?? 1,
  ).flatMap((pick) => {
    const invocation = getInvocation(pick.id);
    if (!invocation) return [];
    const cantripName = pick.spellId
      ? (spells?.find((spell) => spell.id === pick.spellId)?.name ?? pick.spellId)
      : undefined;
    return [{ invocation, cantripName }];
  });
  return sortedByLabel(entries, (entry) => entry.invocation.name);
}
