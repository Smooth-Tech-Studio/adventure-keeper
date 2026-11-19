import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

import { REACHES_INTO_DND } from "./eslint.system-boundary.mjs";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/dist-e2e/**", // the build the end-to-end tests run against
      "**/node_modules/**",
      "**/.turbo/**",
      "**/*.config.{js,ts}",
      "apps/web/src/components/ui/**", // vendored shadcn primitives
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // React front-end
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Keep the classic, bug-catching rules strict.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Compiler-era advisories — useful signal, not build blockers here.
      // The "reset state, then fetch" effect pattern is intentional in pages.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "warn",
      "react-hooks/incompatible-library": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // The frontier between the application and its rules system: the 5e
  // package is imported from the system's own folder, nowhere else.
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    ignores: ["apps/web/src/systems/dnd2024/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@adventure-keeper/system-dnd2024",
              message:
                "Passez par « @/systems » : seul apps/web/src/systems/dnd2024 importe le paquet 5e (docs/RULES_AND_CONTENT.md, lot 1).",
            },
          ],
        },
      ],
    },
  },

  // …and the rest of the application reaches a system through `@/systems`,
  // not through that folder. The files that still do are listed; none is added.
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    ignores: ["apps/web/src/systems/**", ...REACHES_INTO_DND],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@adventure-keeper/system-dnd2024",
              message:
                "Passez par « @/systems » : seul apps/web/src/systems/dnd2024 importe le paquet 5e (docs/RULES_AND_CONTENT.md, lot 1).",
            },
          ],
          patterns: [
            {
              group: ["@/systems/dnd2024", "@/systems/dnd2024/*"],
              message:
                "Passez par « @/systems » ou « @/systems/screens » : le dossier d'un système n'est pas importé directement (docs/RULES_AND_CONTENT.md, lot 1).",
            },
          ],
        },
      ],
    },
  },

  // Node scripts
  {
    files: ["scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },

  // Tests
  {
    files: ["**/*.test.ts"],
    languageOptions: { globals: globals.node },
  },
);
