import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeftIcon, ArrowRightIcon, HistoryIcon, InfoIcon } from "lucide-react";
import { toast } from "sonner";
import { CHARACTER_SYSTEMS, type CharacterSystem } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useFullWidthPage } from "@/hooks/use-full-width-page";
import { useLicenceNotice } from "@/hooks/use-licence-notice";
import {
  clearWizardSnapshot,
  describeAge,
  readWizardSnapshot,
  type WizardSnapshot,
} from "@/hooks/use-wizard-autosave";
import { cn } from "@/lib/utils";
import { getSystem, isCharacterSystem } from "@/systems";
import { getScreens } from "@/systems/screens";

/** How a system's creation goes, as the chooser tells it. */
const creationOf = (system: CharacterSystem) => getScreens(system).creation;

/** The systems a character can be created with, guided creations first. */
const OPTIONS: CharacterSystem[] = [...CHARACTER_SYSTEMS].sort(
  (a, b) => Number(creationOf(b).guided) - Number(creationOf(a).guided),
);

/**
 * The guided creation keeps what a player entered on this device (a reload, a
 * closed tab): one such creation at a time, and so one system that resumes it.
 */
const RESUMABLE = OPTIONS.find((system) => creationOf(system).guided) ?? null;

/**
 * `?returnTo=` sends the player back where they came from once the character
 * is saved — the campaign join screen or a campaign page, nothing else.
 */
function safeReturnTo(value: string | null): string | undefined {
  return value && /^\/(join|campaigns)\/[\w-]+$/.test(value) ? value : undefined;
}

export function CreateCharacterPage() {
  const { t } = useTranslation(["characters", "common"]);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  /** Not signed in: the 5E creation runs on this device, an account saves it. */
  const guest = !loading && !user;
  const returnTo = safeReturnTo(params.get("returnTo"));
  // A link may pick the system already — a campaign that takes one only.
  // `?system=5e` names the 5E sheet; the stored id (`dnd2024`) is read too.
  const requested = params.get("system");
  const asked = requested === "5e" ? "dnd2024" : requested;
  const [system, setSystem] = useState<CharacterSystem | null>(
    isCharacterSystem(asked) && creationOf(asked).guided ? asked : null,
  );
  const creation = system ? creationOf(system) : null;
  useBreadcrumbs(
    guest
      ? [{ label: t("create.crumb") }]
      : [{ label: t("common:nav.characters"), to: "/characters" }, { label: t("create.crumb") }],
  );
  useLicenceNotice(system ? getSystem(system).licenceNotice : null);

  /**
   * A guided creation left on this device (a reload, a closed tab). The offer comes
   * before anything else — on the system choice, or instead of the wizard when
   * the link already picked 5E — so the player never starts over by accident.
   */
  const [offer, setOffer] = useState(() => readWizardSnapshot<unknown>());
  const [resume, setResume] = useState<WizardSnapshot<unknown> | undefined>();

  /**
   * `?resume=1`: back from the sign-up page with the creation a guest made.
   * It reopens where they left it, to be validated under the new account.
   */
  useEffect(() => {
    if (!user || params.get("resume") !== "1") return;
    if (offer) {
      setResume(offer);
      setOffer(null);
      setSystem(RESUMABLE);
      // An id, so a second run of the effect (React's strict mode) shows it once.
      toast.info(t("create.resumed"), { id: "wizard-resume" });
    }
    const next = new URLSearchParams(params);
    next.delete("resume");
    navigate({ search: next.toString() }, { replace: true });
  }, [user, params, offer, navigate, t]);
  const wizardOpen = Boolean(creation?.guided) && !offer;
  useFullWidthPage(wizardOpen);

  function startOver() {
    clearWizardSnapshot();
    setOffer(null);
  }

  const page = (
    <PageContainer
      // The guided creation spreads over the whole window: rail on the left,
      // one question per screen on the right.
      size={wizardOpen || system === null ? "wide" : "form"}
      // The wizard sits right under the navbar, flush with the window edges.
      className={wizardOpen ? "p-0" : "mx-auto flex max-w-6xl flex-col gap-6"}
    >
      {/* A step inside the page, not a way out of it: the trail covers that.
          The wizard has its own « Annuler la création » instead. */}
      {creation && !creation.guided && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setSystem(null)}>
          <ArrowLeftIcon /> {t("create.changeSystem")}
        </Button>
      )}

      {offer && RESUMABLE && (!creation || creation.guided) && (
        <ResumeOffer
          snapshot={offer}
          system={RESUMABLE}
          onResume={() => {
            setResume(offer);
            setOffer(null);
            setSystem(RESUMABLE);
          }}
          onStartOver={startOver}
        />
      )}

      {system === null && (
        <SystemChooser
          guest={guest}
          onStart={(chosen) => {
            // A sheet written straight to the account needs one.
            if (guest && !creationOf(chosen).guestCreation) {
              navigate("/login", { state: { from: "/characters/new" } });
              return;
            }
            // Starting a guided creation here, past the offer, means a fresh start.
            if (creationOf(chosen).guided) startOver();
            setSystem(chosen);
          }}
        />
      )}

      {creation && (!creation.guided || wizardOpen) && (
        <creation.Create returnTo={returnTo} resume={resume} />
      )}
    </PageContainer>
  );

  // What a system keeps for the whole page — the packs a creation draws from —
  // wraps it, chooser and creation alike.
  return CHARACTER_SYSTEMS.reduce((children, id) => {
    const Scope = creationOf(id).Scope;
    return Scope ? <Scope campaignId={params.get("campaign")}>{children}</Scope> : children;
  }, page);
}

function ResumeOffer({
  snapshot,
  system,
  onResume,
  onStartOver,
}: {
  snapshot: WizardSnapshot<unknown>;
  system: CharacterSystem;
  onResume: () => void;
  onStartOver: () => void;
}) {
  const { t } = useTranslation("characters", { keyPrefix: "create" });
  const { name, detail } = creationOf(system).describeSnapshot?.(snapshot.state) ?? {};
  const who = [name || t("untitled"), detail].filter(Boolean).join(" · ");
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3">
        <HistoryIcon className="text-muted-foreground size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t("inProgress")}</p>
          <p className="text-muted-foreground text-xs">
            {t("inProgressLine", { who, age: describeAge(snapshot.savedAt), step: snapshot.step })}
          </p>
        </div>
        <Button type="button" size="sm" onClick={onResume}>
          {t("resume")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onStartOver}>
          {t("startOver")}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * The rules come first, and they are explained before they are picked: what
 * the sheet holds, and how the creation goes from there.
 */
function SystemChooser({
  guest,
  onStart,
}: {
  guest: boolean;
  onStart: (system: CharacterSystem) => void;
}) {
  const { t } = useTranslation("characters", { keyPrefix: "create" });
  const [picked, setPicked] = useState<CharacterSystem>(OPTIONS[0]!);
  const option = creationOf(picked);
  const Extras = option.ChooserExtras;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="type-title">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("intro")}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div role="radiogroup" aria-label={t("rules")} className="flex flex-col gap-3">
          {OPTIONS.map((entry) => {
            const selected = entry === picked;
            return (
              <button
                key={entry}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPicked(entry)}
                className={cn(
                  "bg-card hover:bg-accent flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                  selected && "border-primary ring-primary ring-1",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 grid size-4 shrink-0 place-items-center rounded-full border",
                    selected && "border-primary",
                  )}
                >
                  {selected && <span className="bg-primary size-2 rounded-full" />}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="type-heading">{creationOf(entry).title}</span>
                  <span className="text-muted-foreground text-sm">
                    {t(`options.${entry}.tagline`)}
                  </span>
                </span>
              </button>
            );
          })}
          <p className="text-muted-foreground text-xs">{t("moreSoon")}</p>
        </div>

        <section className="bg-card flex flex-col gap-5 rounded-xl border p-6" aria-live="polite">
          <div className="flex flex-col gap-2">
            <h2 className="type-heading">{option.title}</h2>
            <p className="text-sm leading-relaxed">{t(`options.${picked}.about`)}</p>
          </div>
          <div className="flex flex-col gap-3">
            <span className="type-label">{t("howItGoes")}</span>
            <ol className="flex flex-col gap-3">
              {option.steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="bg-muted grid size-7 shrink-0 place-items-center rounded-full text-xs font-medium tabular-nums">
                    {index + 1}
                  </span>
                  <span className="flex flex-col pt-0.5">
                    <span className="text-sm font-medium">{t(`steps.${step}.title`)}</span>
                    <span className="text-muted-foreground text-sm">{t(`steps.${step}.text`)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          {Extras && !guest && <Extras />}
          {guest ? (
            <p className="bg-muted flex gap-2 rounded-md p-3 text-sm">
              <InfoIcon className="mt-0.5 size-4 shrink-0" />
              {option.guestCreation ? t("guestDnd") : t("guestStandard")}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">{t(`options.${picked}.note`)}</p>
          )}
          <Button type="button" className="self-start" onClick={() => onStart(picked)}>
            {guest && !option.guestCreation ? t("signIn") : t(`options.${picked}.start`)}{" "}
            <ArrowRightIcon />
          </Button>
        </section>
      </div>
    </div>
  );
}
