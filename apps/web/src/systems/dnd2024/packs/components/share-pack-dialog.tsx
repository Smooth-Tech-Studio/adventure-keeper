import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { CopyIcon, MailIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { COLLECTIONS, type ContentPackDoc, type UserProfile } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/firebase";
import type { WithId } from "@/lib/collections";
import {
  packShareUrl,
  setPackLinkSharing,
  sharePackByEmail,
  unsharePack,
} from "@/systems/dnd2024/lib/packs";
import { tr } from "@/i18n";
import { packName } from "@/systems/dnd2024/lib/pack-labels";

interface Props {
  pack: WithId<ContentPackDoc>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Owner: who sees this pack, by email or by link. */
export function SharePackDialog({ pack, open, onOpenChange }: Props) {
  const { t } = useTranslation("packs", { keyPrefix: "share" });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const sharedKey = pack.sharedWith.join(",");

  useEffect(() => {
    if (!open || !sharedKey) return;
    let cancelled = false;
    Promise.all(
      sharedKey.split(",").map((uid) =>
        getDoc(doc(db, COLLECTIONS.users, uid))
          .then((snap) => {
            const profile = snap.data() as UserProfile | undefined;
            return [uid, profile?.displayName || profile?.email || t("player")] as const;
          })
          .catch(() => [uid, t("player")] as const),
      ),
    ).then((entries) => {
      if (!cancelled) setNames(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [open, sharedKey, t]);

  async function share(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const result = await sharePackByEmail(pack, email);
      if (result.ok) {
        toast.success(t("shared", { name: result.displayName }));
        setEmail("");
      } else {
        toast.error(result.reason);
      }
    } catch (error) {
      console.error(error);
      toast.error(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<void>, failure: string) {
    try {
      await action();
    } catch (error) {
      console.error(error);
      toast.error(failure);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(packShareUrl(pack.id));
      toast.success(t("linkCopied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { name: packName(pack) })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={share} className="grid gap-2">
          <Label htmlFor="share-email">{t("byEmail")}</Label>
          <div className="flex gap-2">
            <Input
              id="share-email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-w-0 flex-1"
            />
            <Button type="submit" disabled={busy}>
              <MailIcon /> {t("submit")}
            </Button>
          </div>
        </form>

        {pack.sharedWith.length > 0 && (
          <ul className="flex flex-col gap-1">
            {pack.sharedWith.map((uid) => (
              <li
                key={uid}
                className="bg-muted/30 flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{names[uid] ?? "…"}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={t("revokeAria", { name: names[uid] ?? t("thisPlayer") })}
                  onClick={() => run(() => unsharePack(pack.id, uid), t("revokeFailed"))}
                >
                  <XIcon className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Separator />

        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="share-link"
              checked={pack.linkSharing}
              onCheckedChange={(checked) =>
                run(() => setPackLinkSharing(pack.id, checked === true), t("linkFailed"))
              }
            />
            <Label htmlFor="share-link">{t("byLink")}</Label>
          </div>
          <p className="text-muted-foreground text-xs">{t("linkHint")}</p>
          {pack.linkSharing && (
            <div className="flex gap-2">
              <Input
                readOnly
                value={packShareUrl(pack.id)}
                onFocus={(event) => event.currentTarget.select()}
                className="min-w-0 flex-1 font-mono text-xs"
                aria-label={t("linkAria")}
              />
              <Button type="button" variant="outline" onClick={copyLink}>
                <CopyIcon /> {tr("common:actions.copy")}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
