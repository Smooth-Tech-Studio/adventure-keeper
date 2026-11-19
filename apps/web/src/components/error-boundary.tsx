import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import i18n from "@/i18n";

interface Props {
  children: ReactNode;
  /** Changing this value re-mounts the boundary and clears a caught error. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time exceptions so a single broken page doesn't blank the
 * whole app (previously seen with Firestore's `INTERNAL ASSERTION FAILED`
 * killing the tab). Pass `resetKey={location.pathname}` so navigating away
 * clears the error.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught a render error", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // A class component: `i18n.t` directly, the message shows in the language of the moment.
    const t = i18n.t.bind(i18n);

    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">{t("errorBoundary.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("errorBoundary.body")}</p>
        {error.message && (
          <pre className="bg-muted text-muted-foreground max-w-full overflow-x-auto rounded-md p-3 text-left text-xs">
            {error.message}
          </pre>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => this.setState({ error: null })}>
            {t("errorBoundary.retry")}
          </Button>
          <Button onClick={() => window.location.reload()}>{t("errorBoundary.reload")}</Button>
        </div>
      </div>
    );
  }
}
