import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Trans, useTranslation } from "react-i18next";
import type { User } from "firebase/auth";
import type { Campaign, WithId } from "@adventure-keeper/schemas";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { campaignsIRun, changePassword, deleteMyAccount, requestEmailChange } from "@/lib/account";
import i18n from "@/i18n";
import { authErrorMessage } from "@/lib/auth-errors";

/** Here the only credential typed is the current password: say so. */
function accountError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    return i18n.t("profile:account.wrongPassword");
  }
  return authErrorMessage(error);
}

function Field({
  id,
  label,
  ...input
}: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...input} />
    </div>
  );
}

function PasswordSection({ user }: { user: User }) {
  const { t } = useTranslation("profile", { keyPrefix: "account" });
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const mismatch = again.length > 0 && next !== again;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (next.length < 8) return toast.error(t("password.tooShort"));
    if (next !== again) return toast.error(t("password.mismatch"));
    setBusy(true);
    try {
      await changePassword(user, current, next);
      setCurrent("");
      setNext("");
      setAgain("");
      toast.success(t("password.changed"));
    } catch (error) {
      toast.error(accountError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h3 className="font-medium">{t("password.title")}</h3>
      <Field
        id="pw-current"
        label={t("currentPassword")}
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(event) => setCurrent(event.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id="pw-new"
          label={t("password.new")}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <Field
          id="pw-again"
          label={t("password.again")}
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(event) => setAgain(event.target.value)}
          aria-invalid={mismatch}
        />
      </div>
      {mismatch && <p className="text-destructive text-sm">{t("password.differ")}</p>}
      <Button type="submit" className="self-end" disabled={busy || !current || !next || !again}>
        {busy ? t("password.submitting") : t("password.submit")}
      </Button>
    </form>
  );
}

function EmailSection({ user }: { user: User }) {
  const { t } = useTranslation("profile", { keyPrefix: "account" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await requestEmailChange(user, password, email);
      setSentTo(email.trim());
      setEmail("");
      setPassword("");
    } catch (error) {
      toast.error(accountError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <h3 className="font-medium">{t("email.title")}</h3>
      <p className="text-muted-foreground text-sm">
        <Trans
          t={t}
          i18nKey="email.current"
          values={{ email: user.email }}
          components={{ em: <span className="text-foreground" /> }}
        />
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id="email-new"
          label={t("email.new")}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          id="email-password"
          label={t("currentPassword")}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {sentTo && (
        <p className="text-sm">
          <Trans
            t={t}
            i18nKey="email.sent"
            values={{ email: sentTo }}
            components={{ strong: <span className="font-medium" /> }}
          />
        </p>
      )}
      <Button type="submit" className="self-end" disabled={busy || !email.trim() || !password}>
        {busy ? t("email.submitting") : t("email.submit")}
      </Button>
    </form>
  );
}

function DeleteSection({ user }: { user: User }) {
  const { t } = useTranslation("profile", { keyPrefix: "account" });
  // The word typed to confirm the deletion — no slip of the finger.
  const confirmWord = t("delete.confirmWord");
  const navigate = useNavigate();
  const [running, setRunning] = useState<WithId<Campaign>[] | null>(null);
  const [password, setPassword] = useState("");
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    campaignsIRun(user.uid).then(setRunning, () => setRunning([]));
  }, [user.uid]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await deleteMyAccount(user, password);
      toast.success(t("delete.done"));
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof Error && error.message === "STILL_GM") {
        toast.error(t("delete.stillGmToast"));
        setRunning(await campaignsIRun(user.uid));
      } else {
        toast.error(accountError(error));
      }
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-destructive font-medium">{t("delete.title")}</h3>
      <p className="text-muted-foreground text-sm">{t("delete.warning")}</p>
      {running === null ? null : running.length > 0 ? (
        <div className="border-destructive/40 bg-destructive/5 rounded-md border p-3 text-sm">
          <p>{t("delete.stillGm", { count: running.length })}</p>
          <ul className="mt-1 list-inside list-disc">
            {running.map((campaign) => (
              <li key={campaign.id}>
                <Link to={`/campaigns/${campaign.id}`} className="underline underline-offset-4">
                  {campaign.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="delete-password"
              label={t("currentPassword")}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Field
              id="delete-word"
              label={t("delete.typeToConfirm", { word: confirmWord })}
              autoComplete="off"
              value={word}
              onChange={(event) => setWord(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="destructive"
            className="self-end"
            disabled={busy || !password || word !== confirmWord}
          >
            {busy ? t("delete.submitting") : t("delete.submit")}
          </Button>
        </form>
      )}
    </div>
  );
}

/** « Compte et sécurité » — password, e-mail, deletion. */
export function AccountSettings({ user }: { user: User }) {
  const { t } = useTranslation("profile", { keyPrefix: "account" });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <PasswordSection user={user} />
        <Separator />
        <EmailSection user={user} />
        <Separator />
        <DeleteSection user={user} />
      </CardContent>
    </Card>
  );
}
