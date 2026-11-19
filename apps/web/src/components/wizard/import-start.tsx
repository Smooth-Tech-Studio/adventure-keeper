import { useState, type ReactNode } from "react";
import { ClipboardPasteIcon, FileUpIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { OptionCard } from "@/components/wizard/option-card";
import { useFilePicker } from "@/hooks/use-file-picker";

/**
 * The first screen of a creation that can start from a file: from scratch, or
 * from a campaign / adventure file — picked, or its text pasted straight from
 * an AI's answer. Once read, it says what it holds — or, line by line, what is
 * wrong with it.
 */
export function ImportStart({
  importing,
  onImportingChange,
  blankTitle,
  blankHint,
  importTitle,
  importHint,
  onFile,
  fileName,
  errors,
  warnings = [],
  summary,
  guide,
}: {
  importing: boolean;
  onImportingChange: (importing: boolean) => void;
  blankTitle: string;
  blankHint: string;
  importTitle: string;
  importHint: string;
  /** The picked file: its name and its text (a pasted text comes with its own label). */
  onFile: (name: string, text: string) => void;
  /** The file read so far, if any. */
  fileName?: string;
  errors: string[];
  /** Read fine, but worth knowing (a pack the file needs is missing). */
  warnings?: string[];
  /** What the file holds, once read without errors. */
  summary?: ReactNode;
  /** A link to the format guide. */
  guide?: ReactNode;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "import" });
  const picker = useFilePicker((text, name) => onFile(name, text));
  const [pasted, setPasted] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <OptionCard
          selected={!importing}
          title={blankTitle}
          hint={blankHint}
          onSelect={() => onImportingChange(false)}
        />
        <OptionCard
          selected={importing}
          title={importTitle}
          hint={importHint}
          onSelect={() => onImportingChange(true)}
        />
      </div>

      {importing && (
        <div className="flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={picker.open}>
              <FileUpIcon /> {fileName ? t("another") : t("choose")}
            </Button>
            {picker.element}
            {fileName && <span className="text-muted-foreground text-sm">{fileName}</span>}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="import-paste" className="text-muted-foreground text-sm">
              {t("pasteLabel")}
            </label>
            <Textarea
              id="import-paste"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder={t("pastePlaceholder")}
              rows={5}
              spellCheck={false}
              className="max-h-64 font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              className="self-start"
              disabled={!pasted.trim()}
              onClick={() => onFile(t("pastedName"), pasted)}
            >
              <ClipboardPasteIcon /> {t("readPasted")}
            </Button>
          </div>
          {guide}

          {errors.length > 0 && (
            <div
              role="alert"
              className="border-destructive/50 bg-destructive/5 rounded-md border p-3 text-sm"
            >
              <p className="font-medium">{t("errors")}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {errors.slice(0, 20).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
              {errors.length > 20 && (
                <p className="text-muted-foreground mt-1">
                  {t("moreErrors", { count: errors.length - 20 })}
                </p>
              )}
            </div>
          )}
          {errors.length === 0 && summary}
          {errors.length === 0 &&
            warnings.map((warning) => (
              <p
                key={warning}
                className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400"
              >
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" /> {warning}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
