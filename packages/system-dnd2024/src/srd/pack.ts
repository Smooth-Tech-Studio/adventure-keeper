/**
 * The SRD 5.2.1 as a content pack — the base pack every 5e table has. Each
 * kind of entry lives in its own file (`classes.json`…), in the pack format,
 * with its English text; the content modules read those files directly, and
 * this module puts them together as one `ak-pack/1` pack, for the tests that
 * hold it to the format and for the pages that show a pack.
 *
 * Its ids stay short (`"barbarian"`): sheets store them.
 */
import SRD_ARMORS from "./armors.json";
import SRD_BACKGROUNDS from "./backgrounds.json";
import SRD_CLASSES from "./classes.json";
import SRD_EQUIPMENT_PACKS from "./equipment-packs.json";
import SRD_FEATS from "./feats.json";
import SRD_GEAR from "./gear.json";
import SRD_INVOCATIONS from "./invocations.json";
import SRD_LANGUAGES from "./languages.json";
import SRD_MONSTERS from "./monsters.json";
import SRD_SPECIES from "./species.json";
import SRD_SPELLS from "./spells.json";
import SRD_SUBCLASSES from "./subclasses.json";
import SRD_TOOLS from "./tools.json";
import SRD_WEAPONS from "./weapons.json";

export const SRD_PACK_ID = "srd";

export const SRD_PACK = {
  format: "ak-pack/1",
  system: "5e",
  id: SRD_PACK_ID,
  name: "SRD 5.2.1",
  version: "5.2.1",
  language: "fr",
  author: "Wizards of the Coast",
  description:
    "Cette œuvre inclut du matériel issu du System Reference Document 5.2.1 (« SRD 5.2.1 ») de Wizards of the Coast LLC, disponible à l’adresse https://www.dndbeyond.com/srd. Le SRD 5.2.1 est régi par la Licence Creative Commons Attribution 4.0 International, disponible à l’adresse https://creativecommons.org/licenses/by/4.0/legalcode.",
  content: {
    classes: SRD_CLASSES.entries,
    species: SRD_SPECIES.entries,
    backgrounds: SRD_BACKGROUNDS.entries,
    feats: SRD_FEATS.entries,
    monsters: SRD_MONSTERS.entries,
    invocations: SRD_INVOCATIONS.entries,
    languages: SRD_LANGUAGES.entries,
    spells: SRD_SPELLS.entries,
    tools: SRD_TOOLS.entries,
    weapons: SRD_WEAPONS.entries,
    armors: SRD_ARMORS.entries,
    gear: SRD_GEAR.entries,
    equipmentPacks: SRD_EQUIPMENT_PACKS.entries,
    subclasses: SRD_SUBCLASSES.entries,
  },
  translations: {
    en: {
      description:
        "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.",
      content: {
        classes: SRD_CLASSES.translations.en,
        species: SRD_SPECIES.translations.en,
        backgrounds: SRD_BACKGROUNDS.translations.en,
        feats: SRD_FEATS.translations.en,
        monsters: SRD_MONSTERS.translations.en,
        invocations: SRD_INVOCATIONS.translations.en,
        languages: SRD_LANGUAGES.translations.en,
        spells: SRD_SPELLS.translations.en,
        tools: SRD_TOOLS.translations.en,
        weapons: SRD_WEAPONS.translations.en,
        armors: SRD_ARMORS.translations.en,
        gear: SRD_GEAR.translations.en,
        equipmentPacks: SRD_EQUIPMENT_PACKS.translations.en,
        subclasses: SRD_SUBCLASSES.translations.en,
      },
    },
  },
} as const;
