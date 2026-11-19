// @adventure-keeper/system-dnd2024
// 5e 2024 (SRD 5.2, CC-BY-4.0) reference data + character-creation rules engine.
// Kept in its own package so the licensed content is isolable and so the web
// app can code-split it away from routes that don't need it.

export * from "./distance";
export * from "./locale";
export * from "./export-json";
export * from "./dice";
export * from "./abilities";
export * from "./skills";
export * from "./choices";
export * from "./feats";
export * from "./subclasses";
export * from "./starting-equipment";
export * from "./resolve-choices";
export * from "./normalize-choices";
export * from "./alignments";
export * from "./species";
export * from "./armors";
export * from "./weapons";
export * from "./tools";
export * from "./gear";
export * from "./classes";
export * from "./conditions";
export * from "./features";
export * from "./mechanics";
export * from "./feature-mechanics";
export * from "./feature-rolls";
export * from "./class-options";
export * from "./backgrounds";
export * from "./languages";
export * from "./spells";
export * from "./spellcasting";
export * from "./granted-spells";
export * from "./invocations";
export * from "./combat-notes";
export * from "./monsters";
export * from "./beasts";
export * from "./character-rules";
export * from "./progression";
export * from "./packs/schema";
export * from "./packs/translations";
export * from "./packs/registry";
export * from "./packs/active";
export * from "./packs/parse";
export * from "./packs/snapshot";
export * from "./packs/migrate";
export * from "./packs/example";
export * from "./packs/json-schema";
export * from "./srd/catalogs";
