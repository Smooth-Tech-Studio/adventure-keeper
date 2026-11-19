/**
 * Writes the 5e 2024 catalogues to a JSON file.
 *
 *   pnpm catalogs:export            → dist-catalogs/dnd2024-catalogs.json
 *   pnpm catalogs:export chemin.json
 *
 * The point is not that the app needs this file — it imports the TypeScript
 * directly. The point is that it *can be produced at all*, which is the design
 * promise the guided creation was built on. See `export-json.ts`.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { catalogJson, catalogExport } from "../packages/system-dnd2024/src/index";

async function main() {
  const out = resolve(process.argv[2] ?? "dist-catalogs/dnd2024-catalogs.json");
  const json = catalogJson();
  const { classes, species, backgrounds, subclasses, feats } = catalogExport();

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, json + "\n", "utf8");

  console.log(`✔ ${out}`);
  console.log(
    `  ${Math.round(json.length / 1024)} Ko — ${classes.length} classes, ` +
      `${species.length} espèces, ${backgrounds.length} historiques, ` +
      `${subclasses.length} sous-classes, ${feats.length} dons`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
