import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  ChevronDownIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  CircleAlertIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const storeKey = (key: string) => `ak.collapse.${key}`;

function readOpen(key: string | undefined, fallback: boolean): boolean {
  if (!key || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(storeKey(key));
    return raw === null ? fallback : raw === "1";
  } catch {
    return fallback;
  }
}

function writeOpen(key: string | undefined, open: boolean) {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storeKey(key), open ? "1" : "0");
  } catch {
    /* storage unavailable — the in-memory state still works */
  }
}

// --- Bulk collapse / expand ------------------------------------------------

interface BulkContextValue {
  /** Bumped on every "collapse/expand all"; `open` is the target state. */
  signal: { seq: number; open: boolean };
  setAll: (open: boolean) => void;
  /**
   * Bumped by {@link CollapsibleCardGroupHandle.reveal}; the listed
   * `storageKey`s open, every other card keeps whatever state it had.
   */
  revealSignal: { seq: number; keys: readonly string[] };
}

const BulkContext = createContext<BulkContextValue | null>(null);

export interface CollapsibleCardGroupHandle {
  /**
   * Force open the cards mounted with these `storageKey`s.
   *
   * Used on a failed form submit: a collapsed card does not render its body at
   * all, so an error message inside it is not merely hidden — it is absent from
   * the DOM. Revealing the offending cards is what makes "corrigez les champs
   * indiqués" point at something.
   */
  reveal: (storageKeys: readonly string[]) => void;
}

/**
 * Wrap a group of {@link CollapsibleCard}s to enable a shared "collapse / expand
 * all" control (see {@link CollapseAllToggle}). Cards outside a group work as
 * before.
 */
export function CollapsibleCardGroup({
  ref,
  children,
}: {
  ref?: Ref<CollapsibleCardGroupHandle>;
  children: React.ReactNode;
}) {
  const [signal, setSignal] = useState({ seq: 0, open: true });
  const [revealSignal, setRevealSignal] = useState<{ seq: number; keys: readonly string[] }>({
    seq: 0,
    keys: [],
  });
  const setAll = useCallback((open: boolean) => setSignal((s) => ({ seq: s.seq + 1, open })), []);

  useImperativeHandle(ref, () => ({
    reveal: (storageKeys) =>
      setRevealSignal((current) => ({ seq: current.seq + 1, keys: storageKeys })),
  }));

  const value = useMemo(() => ({ signal, setAll, revealSignal }), [signal, setAll, revealSignal]);
  return <BulkContext.Provider value={value}>{children}</BulkContext.Provider>;
}

/** One button that collapses every card in the enclosing group, then expands them. */
export function CollapseAllToggle({ className }: { className?: string }) {
  const bulk = useContext(BulkContext);
  if (!bulk) return null;
  const willCollapse = bulk.signal.open;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => bulk.setAll(!willCollapse)}
    >
      {willCollapse ? (
        <>
          <ChevronsDownUpIcon /> Tout replier
        </>
      ) : (
        <>
          <ChevronsUpDownIcon /> Tout déplier
        </>
      )}
    </Button>
  );
}

interface Props {
  title: React.ReactNode;
  /** Shown under the title while the card is open — explains the section. */
  description?: React.ReactNode;
  /**
   * Shown under the title while the card is **collapsed** — a compact recap
   * of what's currently filled in (e.g. chosen skills, ability scores).
   */
  summary?: React.ReactNode;
  /** Right side of the header — a badge, a count… */
  action?: React.ReactNode;
  /**
   * Beside the header, outside its toggle button — for something that is
   * itself interactive (a link, a button), which a button cannot hold.
   */
  headerAction?: React.ReactNode;
  defaultOpen?: boolean;
  /** Remembers open/closed for this viewer (localStorage). Ignored in controlled mode. */
  storageKey?: string;
  /**
   * Controlled mode — pass both to drive open/closed from a parent (e.g. an
   * accordion where only one card may be open at a time). Omit both to let
   * the card manage its own state as usual.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Marks the card as holding a validation error: it gets an "à corriger" badge
   * in the header — visible while collapsed, when the message itself is not
   * rendered — and a destructive border.
   */
  invalid?: boolean;
  /** Tighter header / body padding — for dense side panels. */
  dense?: boolean;
  /** Forwarded to the underlying element so it can be grabbed from the console. */
  id?: string;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

/**
 * A {@link Card} whose header toggles its body open / closed. Used for every
 * section of the character sheet and the creation form.
 */
export function CollapsibleCard({
  title,
  description,
  summary,
  action,
  headerAction,
  defaultOpen = true,
  storageKey,
  open: openProp,
  onOpenChange,
  invalid = false,
  dense = false,
  id,
  className,
  titleClassName,
  contentClassName,
  children,
}: Props) {
  const controlled = openProp !== undefined;
  const [openState, setOpenState] = useState(() => readOpen(storageKey, defaultOpen));
  const open = controlled ? openProp : openState;

  // Follow a "collapse / expand all" from the enclosing group — controlled
  // cards opt out, since their parent accordion owns the open state.
  const bulk = useContext(BulkContext);
  const lastSeq = useRef(0);
  useEffect(() => {
    if (controlled || !bulk || bulk.signal.seq === lastSeq.current) return;
    lastSeq.current = bulk.signal.seq;
    setOpenState(bulk.signal.open);
    writeOpen(storageKey, bulk.signal.open);
  }, [bulk, storageKey, controlled]);

  // Follow a targeted "reveal" from the enclosing group (failed form submit).
  // Only opens — never closes — so it cannot fight the player's own choices.
  const lastRevealSeq = useRef(0);
  useEffect(() => {
    if (controlled || !bulk || bulk.revealSignal.seq === lastRevealSeq.current) return;
    lastRevealSeq.current = bulk.revealSignal.seq;
    if (!storageKey || !bulk.revealSignal.keys.includes(storageKey)) return;
    setOpenState(true);
    writeOpen(storageKey, true);
  }, [bulk, storageKey, controlled]);

  function toggle() {
    const next = !open;
    if (controlled) {
      onOpenChange?.(next);
    } else {
      setOpenState(next);
      writeOpen(storageKey, next);
    }
  }

  const subline =
    open && description ? (
      <div className="text-muted-foreground mt-1.5 text-sm">{description}</div>
    ) : !open && summary ? (
      <div className="text-muted-foreground mt-1.5 min-w-0 text-sm">{summary}</div>
    ) : null;
  const chevron = (
    <ChevronDownIcon
      className={cn(
        "text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform",
        open && "rotate-180",
      )}
    />
  );

  return (
    // Padding lives on the button/content, not on the Card itself — that way
    // the button's hover background fills the Card's box exactly (edge to
    // edge when collapsed) instead of leaving an unstyled strip of the
    // Card's own `py-6` above it. `overflow-hidden` guarantees the hover
    // background never pokes past the Card's rounded corners.
    // shrink-0: inert in normal page flow, but keeps this card at its natural
    // size (instead of being squashed) inside a bounded scrollable column —
    // e.g. the session action panels — so overflow scrolls instead of squishes.
    <Card
      id={id}
      className={cn(
        "shrink-0 gap-0 overflow-hidden py-0",
        invalid && "border-destructive",
        className,
      )}
    >
      <div
        className={cn(
          "hover:bg-accent/40 flex items-start transition-colors",
          open ? "rounded-t-xl" : "rounded-xl",
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={cn(
            "flex min-w-0 flex-1 items-start gap-3 text-left",
            dense ? "px-3 py-2.5" : "px-6 py-5",
            headerAction && (dense ? "pr-2" : "pr-3"),
          )}
        >
          <div className="min-w-0 flex-1">
            <div className={cn("leading-none font-semibold", titleClassName)}>
              {title}
              {invalid && (
                <span className="text-destructive ml-2 inline-flex items-center gap-1 align-middle text-xs font-medium">
                  <CircleAlertIcon className="size-3.5" /> à corriger
                </span>
              )}
            </div>
            {!headerAction && subline}
          </div>
          {action}
          {!headerAction && chevron}
        </button>
        {headerAction && (
          <div
            className={cn("flex shrink-0 items-center gap-3", dense ? "py-2 pr-3" : "py-4 pr-6")}
          >
            {headerAction}
            {/* The same toggle as the header, for the pointer only: the header button is the one announced. */}
            <button type="button" tabIndex={-1} aria-hidden onClick={toggle}>
              {chevron}
            </button>
          </div>
        )}
      </div>
      {/* With a header action, the line under the title takes the card's full width. */}
      {headerAction && subline && (
        <div className={cn("-mt-1.5", dense ? "px-3 pb-2" : "px-6 pb-4")}>{subline}</div>
      )}
      {open && (
        <CardContent className={cn(dense ? "px-3 pb-3" : "pb-6", contentClassName)}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}
