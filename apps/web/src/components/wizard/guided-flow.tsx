import { useState, type ReactNode } from "react";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { GuidedRail } from "@/systems/dnd2024/creation-wizard/wizard-rail";
import { WizardScreen } from "@/components/wizard/wizard-screen";

/** One screen of a guided flow: one question, its answer, why it matters. */
export interface FlowStep {
  id: string;
  /** Short name in the rail. */
  label: string;
  title: string;
  lead?: string;
  why?: ReactNode;
  whyTitle?: string;
  /** What was answered, shown in the rail once the step is behind. */
  value?: string;
  /** What still blocks « Suivant ». Empty: the step is done. */
  issues?: string[];
  /** Uses the full width — no help column. */
  wide?: boolean;
  content: ReactNode;
  /**
   * Replaces « Suivant » — « Créer la campagne » — and runs before moving on;
   * `false` stays on the step (the action failed and said why).
   */
  action?: { label: string; run: () => Promise<boolean> };
}

/**
 * A guided flow of single-question screens (campaign, adventure), in the same
 * shell as the character creation: the rail of steps on the left, the
 * question on the right, « Précédent » / « Suivant » at the bottom. The parent
 * holds the current step, so it can move on after an action (the campaign
 * exists → its invitations).
 */
export function GuidedFlow({
  heading,
  eyebrow,
  steps,
  index,
  onIndexChange,
  lockedBefore = 0,
  lastReachable,
  summary,
  railFooter,
  onCancel,
  finish,
  busy = false,
}: {
  heading: string;
  /** « Campagne » — before « étape 2 sur 5 ». */
  eyebrow: string;
  steps: FlowStep[];
  index: number;
  onIndexChange: (index: number) => void;
  /** Steps before this one are done for good (the campaign was created). */
  lockedBefore?: number;
  /** The rail goes no further (the invitations wait for the campaign). */
  lastReachable?: number;
  summary?: ReactNode;
  railFooter?: ReactNode;
  onCancel?: () => void;
  /** The last step's button. */
  finish: { label: string; run: () => void | Promise<void> };
  busy?: boolean;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "flow" });
  const [tried, setTried] = useState(false);
  const step = steps[index];
  const issues = step.issues ?? [];
  const isLast = index === steps.length - 1;
  const blocker = steps.findIndex((s) => (s.issues ?? []).length > 0);

  function goto(next: number) {
    setTried(false);
    onIndexChange(next);
    window.scrollTo({ top: 0 });
  }

  async function goNext() {
    if (issues.length > 0) {
      setTried(true);
      toast.error(issues[0]);
      return;
    }
    if (step.action && !(await step.action.run())) return;
    if (isLast) await finish.run();
    else goto(index + 1);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[19rem_minmax(0,1fr)]">
      <GuidedRail
        heading={heading}
        steps={steps}
        stepIndex={index}
        subIndex={0}
        substeps={[]}
        stepValue={(i) => steps[i].value ?? ""}
        stepDone={(i) => i < index && (steps[i].issues ?? []).length === 0}
        // Back to any earlier step still open; forward only past done steps.
        stepReachable={(i) =>
          i >= lockedBefore &&
          i <= (lastReachable ?? steps.length - 1) &&
          (blocker === -1 || i <= blocker)
        }
        onGoto={(i) => goto(i)}
        summary={summary}
        footer={
          railFooter ??
          (onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={onCancel}
            >
              {t("cancel")}
            </Button>
          ))
        }
      />
      <WizardScreen
        eyebrow={t("eyebrow", { what: eyebrow, current: index + 1, total: steps.length })}
        segments={steps.map((s, i) => ({
          key: s.id,
          done: i < index && (s.issues ?? []).length === 0,
        }))}
        current={index}
        title={step.title}
        lead={step.lead}
        wide={step.wide}
        why={step.why}
        whyTitle={step.whyTitle}
        issues={tried ? issues : []}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => goto(index - 1)}
              disabled={index <= lockedBefore || busy}
            >
              <ChevronLeftIcon /> {t("previous")}
            </Button>
            <span className="flex-1" />
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel} className="lg:hidden">
                {t("cancel")}
              </Button>
            )}
            <Button type="button" onClick={goNext} disabled={busy}>
              {isLast ? (
                <>
                  <CheckIcon /> {finish.label}
                </>
              ) : step.action ? (
                <>
                  <CheckIcon /> {step.action.label}
                </>
              ) : (
                <>
                  {t("next")}
                  <span className="font-normal opacity-75 max-sm:hidden">
                    · {steps[index + 1].label}
                  </span>
                  <ChevronRightIcon />
                </>
              )}
            </Button>
          </>
        }
      >
        {step.content}
      </WizardScreen>
    </div>
  );
}
