import type { FormErrorKey, FormErrors } from "@/systems/dnd2024/character-form/state";
import { tr } from "@/i18n";

/**
 * The collapsible cards of the character form, in page order.
 *
 * `storageKey` is the one the matching `<CollapsibleCard>` is mounted with — it
 * doubles as the card's address for "reveal the sections in error" on submit,
 * so the two must stay in sync.
 */
export const FORM_SECTIONS = {
  identity: section("identity"),
  abilities: section("abilities"),
  skills: section("skills"),
  spells: section("spells"),
  weapons: section("weapons"),
  tools: section("tools"),
} as const;

/** A card's address and title — the title read when accessed, in the interface language. */
function section(id: string) {
  return {
    storageKey: `form-${id}`,
    get title() {
      return tr(`characters:form.sections.${id}`);
    },
  };
}

export type FormSectionId = keyof typeof FORM_SECTIONS;

/**
 * Which section displays each validation error.
 *
 * Total over {@link FormErrorKey} on purpose: a new error key does not compile
 * until it is given a section, which is what stops it from being reported by
 * `validateForm` and rendered nowhere.
 */
export const ERROR_SECTION: Record<FormErrorKey, FormSectionId> = {
  name: "identity",
  speciesId: "identity",
  speciesChoice: "identity",
  classId: "identity",
  backgroundId: "identity",
  alignment: "identity",
  base: "abilities",
  bonuses: "abilities",
  skills: "skills",
  speciesSkills: "skills",
  invocations: "spells",
  weaponMasteries: "weapons",
  toolProficiencies: "tools",
};

/**
 * Every error key, in the order the messages appear on the page. Drives the
 * toast; kept in step with {@link ERROR_SECTION} by `errors.test.ts`.
 */
export const FORM_ERROR_ORDER: readonly FormErrorKey[] = [
  "name",
  "speciesId",
  "speciesChoice",
  "classId",
  "backgroundId",
  "alignment",
  "base",
  "bonuses",
  "skills",
  "speciesSkills",
  "invocations",
  "weaponMasteries",
  "toolProficiencies",
];

/** The reported errors, page order, as `[key, message]` pairs. */
export function orderedErrors(errors: FormErrors): [FormErrorKey, string][] {
  return FORM_ERROR_ORDER.flatMap((key) => {
    const message = errors[key];
    return message ? [[key, message] as [FormErrorKey, string]] : [];
  });
}

/** `true` when the card holding `section` has at least one error to show. */
export function sectionHasError(errors: FormErrors, section: FormSectionId): boolean {
  return orderedErrors(errors).some(([key]) => ERROR_SECTION[key] === section);
}

/** `storageKey`s of the cards to force open on a failed submit, page order. */
export function sectionsInError(errors: FormErrors): string[] {
  const seen = new Set<FormSectionId>();
  for (const [key] of orderedErrors(errors)) seen.add(ERROR_SECTION[key]);
  return (Object.keys(FORM_SECTIONS) as FormSectionId[])
    .filter((id) => seen.has(id))
    .map((id) => FORM_SECTIONS[id].storageKey);
}

/** How many messages the toast spells out before falling back to a count. */
const TOAST_DETAIL_LIMIT = 3;

/**
 * What to tell the player when the sheet does not validate.
 *
 * The old message ("Corrigez les champs indiqués.") was a dead end whenever the
 * offending section was collapsed or, worse, had no place to show the message at
 * all: nothing on screen was "indiqué". Naming the section and quoting the
 * problem makes the toast enough on its own.
 */
export function errorToast(errors: FormErrors): { title: string; lines: string[] } {
  const entries = orderedErrors(errors);
  const title = tr("characters:form.toast.title", { count: entries.length });

  const lines = entries.slice(0, TOAST_DETAIL_LIMIT).map(([key, message]) =>
    tr("characters:form.toast.line", {
      section: FORM_SECTIONS[ERROR_SECTION[key]].title,
      message,
    }),
  );
  const rest = entries.length - lines.length;
  if (rest > 0) lines.push(tr("characters:form.toast.rest", { count: rest }));

  return { title, lines };
}
