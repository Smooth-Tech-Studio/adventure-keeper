# Adventure Keeper

**English** · [Français](README.fr.md)

[![CI and deployment](https://github.com/Smooth-Tech-Studio/adventure-keeper/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/Smooth-Tech-Studio/adventure-keeper/actions/workflows/main.yml?query=branch%3Amain)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue)](LICENSE)

A web platform for tabletop role-playing groups: campaigns, characters,
adventures and live sessions, in one place for the GM and their players.
Compatible with the fifth edition (SRD 5.2.1), with a free-form sheet for
other games too.

**Site: <https://adv-keeper.smthstd.fr>**

## Features

- **Guided character creation** (5e 2024): class, species, background,
  ability scores, spells, equipment, with the sheet's values computed live.
  Try it without an account.
- **Character sheet**, fully computed (AC, HP, attacks, saves, features),
  editable block by block, with guided level-up. A free-form sheet covers
  other systems.
- **Campaigns and adventures**: members, places, NPCs, enemies from the
  bestiary, quests, codex and chronicle, file import and export.
- **Live sessions**: shared map and tokens, combat and initiative, fog of war,
  dice, detachable tabs for a second screen or the table's TV. The session
  server can run on the GM's computer (the **Adventure Keeper Serveur** app,
  Windows, macOS, Linux).
- **Content packs**: a table adds its own classes, species, spells, monsters,
  items… in the `ak-pack/1` format, on top of the SRD, which is itself written
  in that format.
- **English and French.**

## Quick start

Requirements: **Node 26** (see `.nvmrc`), **pnpm 11** (`corepack enable`) and
**Java** for the Firestore emulator.

```bash
pnpm install
pnpm dev              # Firebase emulators + app → http://localhost:5173
pnpm emulators:seed   # in another terminal: test accounts, characters and campaigns
```

`pnpm dev` starts the Firebase emulators (Auth and Firestore) and the app,
which connects to them on its own: no Firebase project is needed. The
emulator UI is at <http://127.0.0.1:4000>.

The seed creates three accounts, `alice@test.dev`, `bob@test.dev` and
`carol@test.dev` (password `test1234`), with their characters and two
campaigns. The test walkthrough is in
[`docs/SEED_SCENARIO.md`](docs/SEED_SCENARIO.md).

To develop against a real Firebase project, copy `apps/web/.env.example` to
`apps/web/.env.local`, fill it in, then run `pnpm dev:app`. The details, and
how to set up deployment, are in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Commands

| Command               | What it does                                                   |
| --------------------- | -------------------------------------------------------------- |
| `pnpm dev`            | Emulators + app, with hot reload                               |
| `pnpm dev:app`        | App only, against the project in `apps/web/.env.local`         |
| `pnpm dev:https`      | Like `pnpm dev`, served over HTTPS (self-signed certificate)   |
| `pnpm dev:expose`     | Like `pnpm dev`, open to the local network (to try on a phone) |
| `pnpm emulators:seed` | Fills the emulators with test data (can be re-run)             |
| `pnpm build`          | Builds every package (Turborepo)                               |
| `pnpm typecheck`      | Type-checks the whole repository                               |
| `pnpm lint`           | ESLint                                                         |
| `pnpm format`         | Prettier                                                       |
| `pnpm test`           | Unit tests (Vitest)                                            |
| `pnpm test:e2e`       | End-to-end tests (Playwright, with their own emulators)        |

## Repository layout

pnpm + Turborepo monorepo.

```
apps/
  web/                React + Vite + Tailwind + shadcn/ui, hosted on Firebase Hosting
  realtime-server/    Live session server (Node + WebSocket)
  realtime-desktop/   Adventure Keeper Serveur: that server in a desktop app (Tauri)
packages/
  system-dnd2024/     5e 2024 rules engine, pack format and the SRD base pack (src/srd)
  schemas/            Zod schemas and types of the Firestore data model
  locale/             Current language and shared translation helpers
e2e/                  End-to-end scenarios (Playwright)
scripts/              Emulator seed, catalogue export
docs/                 Technical documentation
firestore.rules       Firestore security rules
```

Stack: React 19, React Router 7, Vite 8, Tailwind CSS 4, shadcn/ui, Zod 4,
i18next, Firebase (Authentication, Firestore, Hosting), Tauri, GitHub Actions.

## Documentation

The technical documentation is written in French.

| Document                                            | Topic                                                     |
| --------------------------------------------------- | --------------------------------------------------------- |
| [`DEPLOYMENT.md`](docs/DEPLOYMENT.md)               | Firebase projects, environments and continuous deployment |
| [`FIRESTORE.md`](docs/FIRESTORE.md)                 | Data model                                                |
| [`CONTENT_PACKS.md`](docs/CONTENT_PACKS.md)         | Content pack format and the SRD base pack                 |
| [`FEATURE_EFFECTS.md`](docs/FEATURE_EFFECTS.md)     | What each SRD feature applies to the sheet                |
| [`RULES_AND_CONTENT.md`](docs/RULES_AND_CONTENT.md) | How the app, the engine and the content are split         |
| [`REALTIME_SERVER.md`](docs/REALTIME_SERVER.md)     | Live session server and desktop app                       |
| [`I18N.md`](docs/I18N.md)                           | Translations                                              |
| [`IMAGE_STORAGE.md`](docs/IMAGE_STORAGE.md)         | Uploading images to the player's Dropbox                  |
| [`SEED_SCENARIO.md`](docs/SEED_SCENARIO.md)         | Test walkthrough with the seed data                       |

## Contributing

Changes and feedback are tracked in the
[issues](https://github.com/Smooth-Tech-Studio/adventure-keeper/issues).

`main` (production) and `staging` only accept pull requests. Pull requests
target `staging`; `staging` then goes to `main` through its own pull request.
To be merged, a pull request must:

- pass the CI (`ci / build`: format, lint, types, tests, build) and the
  end-to-end tests (`e2e / e2e`);
- be up to date with its target branch;
- be approved by a maintainer (see `.github/CODEOWNERS`), with its
  conversations resolved.

Before opening a pull request, run `pnpm format`, `pnpm lint`,
`pnpm typecheck` and `pnpm test`. A first-time contributor's CI waits for a
maintainer's approval before it runs.

Please do not report a security issue in a public issue: see
[`SECURITY.md`](SECURITY.md).

## License

The code is released under the
[PolyForm Noncommercial 1.0.0](LICENSE) license: you are free to read it,
modify it and use it for noncommercial purposes; any commercial use is
excluded.

## Credits

Compatible with the fifth edition. This work includes material from the
System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC,
available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under
the Creative Commons Attribution 4.0 International License, available at
https://creativecommons.org/licenses/by/4.0/legalcode.

The same notice is shown in the app, on the `/credits` page.
