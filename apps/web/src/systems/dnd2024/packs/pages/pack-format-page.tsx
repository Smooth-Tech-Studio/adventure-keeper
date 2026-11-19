import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2Icon,
  DownloadIcon,
  FileJsonIcon,
  FileSearchIcon,
  XCircleIcon,
} from "lucide-react";
import {
  CONTENT_PACK_FORMAT,
  EXAMPLE_PACK,
  PACK_CONTENT_KINDS,
  PACK_SYSTEM,
  contentPackJsonSchema,
  packText,
  type ContentPack,
} from "@adventure-keeper/system-dnd2024";
import { Trans, useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useLicenceNotice } from "@/hooks/use-licence-notice";
import { downloadTextFile } from "@/lib/download";
import { PACK_KIND_PLURALS, packSummary } from "@/systems/dnd2024/lib/pack-labels";
import { checkPackFile } from "@/systems/dnd2024/lib/packs";
import { C, KIND_GUIDE } from "@/systems/dnd2024/packs/pages/pack-format-guide";
import { currentLanguage, tr } from "@/i18n";

/** Tags a translated guide sentence may hold. */
const CODE = { c: <C>{""}</C>, strong: <strong /> };

/**
 * `/packs/format` — how to write a pack: the principle, the structure, one
 * section per kind of entry with its fields, the values a field accepts (read
 * from the engine's own lists) and a real entry of the example pack — which
 * the tests parse, so the examples cannot drift from what the import accepts.
 * Ends on a checker that runs the import's validation on a file, without
 * importing it. The rules of every field are also offered as a JSON Schema,
 * generated from the import's own schema.
 */

const example = EXAMPLE_PACK as ContentPack;

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

/** `[field, what it holds]` rows — « ? » marks an optional field. */
function Fields({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(9rem,auto)_1fr]">
      {rows.map(([field, what]) => (
        <div key={field} className="contents">
          <dt className="font-mono text-xs leading-6">{field}</dt>
          <dd className="text-muted-foreground">{what}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A list of accepted values, folded: `id` — label. */
function Values({ title, values }: { title: string; values: [string, string][] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium">{title}</summary>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {values.map(([id, label]) => (
          <li key={id}>
            <C>{id}</C> <span className="text-muted-foreground">{label}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** A pack's skeleton, in the reader's language. */
const skeleton = () => `{
  "format": "${CONTENT_PACK_FORMAT}",
  "system": "${PACK_SYSTEM}",
  "id": "${tr("packs:format.skeleton.id")}",
  "name": "${tr("packs:format.skeleton.name")}",
  "version": "1.0.0",
  "author": "${tr("packs:format.skeleton.author")}",
  "language": "${currentLanguage()}",
  "description": "${tr("packs:format.skeleton.description")}",
  "content": {
${PACK_CONTENT_KINDS.map((kind) => `    "${kind}": []`).join(",\n")}
  }
}`;

/** A slice of the example pack's English translation: its name, a feat, a monster. */
const TRANSLATION_SAMPLE = (() => {
  const english = example.translations?.en;
  const sample = {
    language: example.language,
    translations: {
      en: {
        name: english?.name,
        content: {
          feats: { "tireur-des-brumes": english?.content.feats?.["tireur-des-brumes"] },
          monsters: { "loup-des-brumes": english?.content.monsters?.["loup-des-brumes"] },
        },
      },
    },
  };
  return JSON.stringify(sample, null, 2);
})();

type CheckResult =
  { file: string; ok: true; pack: ContentPack } | { file: string; ok: false; errors: string[] };

function PackChecker() {
  const { t } = useTranslation("packs", { keyPrefix: "format.check" });
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [dragging, setDragging] = useState(false);

  async function check(file: File | undefined) {
    if (!file) return;
    const outcome = checkPackFile(await file.text());
    setResult(outcome.ok ? { file: file.name, ...outcome } : { file: file.name, ...outcome });
  }

  return (
    <Card id="verifier">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <button
          type="button"
          className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm ${
            dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30"
          }`}
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void check(event.dataTransfer.files[0]);
          }}
        >
          <FileSearchIcon className="text-muted-foreground size-6" />
          <span>{t("drop")}</span>
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            void check(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {result?.ok && (
          <p className="flex gap-2 text-sm">
            <CheckCircle2Icon className="size-4 shrink-0 text-green-600" />
            <span>
              <Trans
                t={t}
                i18nKey="valid"
                values={{
                  file: result.file,
                  name: packText(result.pack, "name"),
                  version: result.pack.version,
                  summary: packSummary(result.pack),
                }}
                components={{
                  file: <span className="font-medium" />,
                  import: <Link to="/packs" className="underline underline-offset-4" />,
                }}
              />
            </span>
          </p>
        )}
        {result && !result.ok && (
          <div className="flex flex-col gap-2 text-sm">
            <p className="flex gap-2">
              <XCircleIcon className="text-destructive size-4 shrink-0" />
              <span>
                <Trans
                  t={t}
                  i18nKey="invalid"
                  count={result.errors.length}
                  values={{ file: result.file }}
                  components={{ file: <span className="font-medium" /> }}
                />
              </span>
            </p>
            <ul className="text-muted-foreground list-inside list-disc pl-6">
              {result.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PackFormatPage() {
  const { t } = useTranslation("packs", { keyPrefix: "format" });
  useLicenceNotice("srd521");
  useBreadcrumbs([{ label: tr("packs:page.crumb"), to: "/packs" }, { label: t("title") }]);

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            <Trans
              t={t}
              i18nKey="intro"
              components={{ packs: <Link to="/packs" className="underline underline-offset-4" /> }}
            />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              downloadTextFile(
                "brumes-du-nord.json",
                `${JSON.stringify(example, null, 2)}\n`,
                "application/json",
              )
            }
          >
            <DownloadIcon /> {t("example")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              downloadTextFile(
                "ak-pack.schema.json",
                `${JSON.stringify(contentPackJsonSchema(currentLanguage()), null, 2)}\n`,
                "application/json",
              )
            }
          >
            <FileJsonIcon /> {t("rules")}
          </Button>
        </div>
      </div>

      <nav aria-label={t("toc")} className="flex flex-wrap gap-1.5 text-sm">
        {[
          ["#structure", t("structure")],
          ["#references", t("references")],
          ["#translations", t("translations")],
          ...PACK_CONTENT_KINDS.map((kind) => [`#format-${kind}`, PACK_KIND_PLURALS[kind]]),
          ["#verifier", t("check.title")],
        ].map(([href, label]) => (
          <a key={href} href={href} className="hover:bg-accent rounded-full border px-3 py-1">
            {label}
          </a>
        ))}
      </nav>

      <Card id="structure" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>{t("structure")}</CardTitle>
          <CardDescription>
            <Trans t={t} i18nKey="structureIntro" components={CODE} />
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Code>{skeleton()}</Code>
          <p className="text-muted-foreground text-sm">
            <Trans t={t} i18nKey="structureNote" components={CODE} />
          </p>
          <p className="text-muted-foreground text-sm">
            <Trans t={t} i18nKey="rulesNote" components={CODE} />
          </p>
        </CardContent>
      </Card>

      <Card id="references" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>{t("references")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            <Trans t={t} i18nKey="ids" components={CODE} />
          </p>
          <p>{t("refIntro")}</p>
          <ul className="text-muted-foreground list-inside list-disc">
            <li>{t("refSame")}</li>
            <li>
              <Trans t={t} i18nKey="refOther" components={CODE} />
            </li>
            <li>
              <Trans t={t} i18nKey="refSrd" components={CODE} />
            </li>
          </ul>
          <p className="text-muted-foreground">{t("refEnglish")}</p>
        </CardContent>
      </Card>

      <Card id="translations" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>{t("translations")}</CardTitle>
          <CardDescription>
            <Trans t={t} i18nKey="translationsIntro" components={CODE} />
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>
            <Trans t={t} i18nKey="translationsShape" components={CODE} />
          </p>
          <p className="text-muted-foreground">
            <Trans t={t} i18nKey="translationsValues" components={CODE} />
          </p>
          <div className="flex flex-col gap-1.5">
            <p className="text-muted-foreground text-xs">{t("translationsSample")}</p>
            <Code>{TRANSLATION_SAMPLE}</Code>
          </div>
        </CardContent>
      </Card>

      {PACK_CONTENT_KINDS.map((kind) => {
        const guide = KIND_GUIDE[kind];
        const sample = example.content[kind][0];
        return (
          <Card key={kind} id={`format-${kind}`} className="scroll-mt-20">
            <CardHeader>
              <CardTitle>
                {PACK_KIND_PLURALS[kind]} <C>{`content.${kind}`}</C>
              </CardTitle>
              <CardDescription>{guide.intro}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Fields rows={[["id, name", t("idName")], ...guide.rows]} />
              {guide.values?.map(([title, values]) => (
                <Values key={title} title={title} values={values} />
              ))}
              {sample && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-muted-foreground text-xs">{t("sample")}</p>
                  <Code>{JSON.stringify(sample, null, 2)}</Code>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <PackChecker />
    </PageContainer>
  );
}
