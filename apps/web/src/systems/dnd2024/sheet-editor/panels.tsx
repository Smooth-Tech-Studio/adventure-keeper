import {
  getBackground,
  getClass,
  skillExpertiseCount,
  type CharacterDerived,
  type ChoiceContext,
  type Skill,
} from "@adventure-keeper/system-dnd2024";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUrlField } from "@/components/image-url-field";
import { ColorField } from "@/components/character/color-field";
import { HitPointRollsField } from "@/systems/dnd2024/components/hit-point-rolls";
import type { EditBlock } from "@/components/character/character-sheet/types";
import {
  InventoryMoneySection,
  ToolsSection,
  WeaponsArmorSection,
} from "@/systems/dnd2024/character-form/equipment-sections";
import type { FormState, SetForm } from "@/systems/dnd2024/character-form/state";
import { BonusStep, ValuesStep } from "@/systems/dnd2024/creation-wizard/ability-substeps";
import { ChoiceRenderer } from "@/systems/dnd2024/creation-wizard/choice-renderer";
import { LanguagePicker, LoreStep } from "@/systems/dnd2024/creation-wizard/fixed-substeps";
import { ClassSpellsStep } from "@/systems/dnd2024/creation-wizard/spell-substeps";
import { choiceSubsteps, detectMethod } from "@/systems/dnd2024/creation-wizard/substeps";
import { SkillRows } from "@/systems/dnd2024/creation-wizard/visual-choices";
import { blockDefs } from "@/systems/dnd2024/sheet-editor/blocks";
import { WildShapeFormsPicker } from "@/systems/dnd2024/components/wild-shape-forms-picker";
import type { ChoiceCatalogs } from "@/systems/dnd2024/lib/choices";
import { tr } from "@/i18n";

interface PanelProps {
  block: EditBlock;
  state: FormState;
  set: SetForm;
  setPick: (choiceId: string, values: string[]) => void;
  derived: CharacterDerived | null;
  catalogs: ChoiceCatalogs;
  context: ChoiceContext;
  choiceErrors: Record<string, string>;
}

export function EditPanelBody(props: PanelProps) {
  const { block, state, set, derived } = props;
  const t = (key: string, values?: Record<string, unknown>) => tr(`sheet:editor.${key}`, values);
  const klass = state.classId ? getClass(state.classId) : undefined;

  const choices = (defs = blockDefs(state, block)) =>
    defs.map((def) => (
      <section key={def.id} className="bg-card rounded-xl border p-4">
        <ChoiceRenderer
          def={def}
          values={state.choices.find((pick) => pick.choiceId === def.id)?.values ?? []}
          onChange={(values) => props.setPick(def.id, values)}
          catalogs={props.catalogs}
          context={props.context}
          error={props.choiceErrors[def.id]}
          scores={derived?.adjustedAbilityScores}
          proficiencyBonus={derived?.proficiencyBonus}
          classId={state.classId || undefined}
          picks={state.choices}
        />
      </section>
    ));

  switch (block) {
    // The name and the looks: the rest of who they are changes from the « Modifier » menu.
    case "identity":
      return (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-name">{t("name")}</Label>
            <Input
              id="edit-name"
              autoComplete="off"
              value={state.name}
              onChange={(event) => set("name", event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("color")}</Label>
            <ColorField value={state.color} onChange={(value) => set("color", value)} />
          </div>
          <ImageUrlField
            value={state.image}
            onChange={(value) => set("image", value)}
            label={t("portrait")}
            placeholder={t("portraitPlaceholder")}
          />
        </>
      );
    case "abilities":
      return (
        <>
          <ValuesStep
            state={state}
            set={set}
            klass={klass}
            method={detectMethod(state)}
            rolled={[]}
            setRolled={() => {}}
          />
          <BonusStep
            state={state}
            set={set}
            klass={klass}
            background={getBackground(state.backgroundId)}
          />
          {choices()}
          {state.level > 1 && (
            <section className="flex flex-col gap-3">
              <p className="text-sm font-medium">{t("hitPoints")}</p>
              <HitPointRollsField
                hitDie={klass?.hitDie ?? 8}
                conModifier={derived?.abilityModifiers.con ?? 0}
                levels={Array.from({ length: state.level - 1 }, (_, index) => index + 2)}
                rolls={state.hitPointRolls}
                onChange={(rolls) => set("hitPointRolls", rolls)}
                // A sheet is where a mistake gets fixed: nothing locks here.
                final={false}
              />
            </section>
          )}
        </>
      );
    case "skills": {
      const count = skillExpertiseCount(state.classId, state.level);
      const proficient = derived?.proficientSkills ?? [];
      return (
        <>
          {choices()}
          {count > 0 && (
            <section className="bg-card rounded-xl border p-4">
              <p className="mb-2 text-sm font-medium">
                {t("expertise", { picked: state.skillExpertise.length, count })}
              </p>
              <SkillRows
                def={{
                  id: "class:expertise",
                  source: "class",
                  kind: "skill",
                  label: t("expertiseLabel"),
                  count,
                  pool: { kind: "list", values: proficient },
                }}
                pool={proficient}
                values={state.skillExpertise}
                onChange={(values) => set("skillExpertise", values as Skill[])}
                catalogs={props.catalogs}
                scores={derived?.adjustedAbilityScores}
                proficiencyBonus={(derived?.proficiencyBonus ?? 2) * 2}
              />
            </section>
          )}
        </>
      );
    }
    case "proficiencies":
      return (
        <>
          <LanguagePicker state={state} set={set} showErrors />
          {choices()}
        </>
      );
    case "options": {
      const groups = choiceSubsteps(blockDefs(state, "options"));
      if (groups.length === 0) {
        return <p className="text-muted-foreground text-sm">{t("noChoice")}</p>;
      }
      return groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{group.nav}</h3>
          {choices(group.defs)}
        </div>
      ));
    }
    case "spells":
      return <ClassSpellsStep state={state} set={set} showErrors />;
    case "equipment":
      return (
        <>
          <WeaponsArmorSection state={state} errors={{}} set={set} derived={derived} />
          <ToolsSection state={state} errors={{}} set={set} derived={derived} />
          <InventoryMoneySection state={state} errors={{}} set={set} derived={derived} />
        </>
      );
    case "wildShape":
      return (
        <WildShapeFormsPicker
          level={state.level}
          value={state.wildShapeForms}
          onChange={(ids) => set("wildShapeForms", ids)}
        />
      );
    case "lore":
      return <LoreStep state={state} set={set} />;
  }
}
