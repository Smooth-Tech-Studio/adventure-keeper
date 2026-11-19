import { Trans, useTranslation } from "react-i18next";

import { PageContainer } from "@/components/page-container";

function ExternalLink({ href, children }: { href: string; children?: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
      {children}
    </a>
  );
}

/**
 * `/credits` — the attribution the SRD 5.2.1 licence (CC-BY-4.0) requires.
 * The quoted statement is the one Wizards of the Coast asks for, word for
 * word (the French SRD's wording in French, the English one's in English),
 * and must stay the *only* mention of them: their legal notice forbids
 * adding any other attribution to Wizards or its affiliates.
 */
export function CreditsPage() {
  const { t } = useTranslation();
  return (
    <PageContainer size="narrow" className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("credits.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("credits.intro")}</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t("credits.dnd2024")}</h2>
        <p className="text-muted-foreground text-sm">{t("credits.dnd2024Intro")}</p>
        <blockquote className="bg-muted/30 border-l-primary rounded-md border border-l-4 p-4 text-sm">
          <Trans
            i18nKey="credits.srdStatement"
            components={{
              srd: <ExternalLink href="https://www.dndbeyond.com/srd" />,
              cc: <ExternalLink href="https://creativecommons.org/licenses/by/4.0/legalcode" />,
            }}
          />
        </blockquote>
        <p className="text-muted-foreground text-sm">{t("credits.ownWords")}</p>
      </section>
    </PageContainer>
  );
}
