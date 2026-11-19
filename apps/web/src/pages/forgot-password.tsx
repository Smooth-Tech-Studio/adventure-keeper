import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Trans, useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { authErrorMessage } from "@/lib/auth-errors";

const schema = z.object({
  email: z.string().min(1, "validation.emailRequired").email("validation.emailInvalid"),
});
type Values = z.infer<typeof schema>;

/**
 * `/mot-de-passe-oublie` — mails a reset link (Firebase hosts the page that
 * sets the new password). The answer is the same whether the address has an
 * account or not, so the page cannot be used to find out who is signed up.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation(["auth", "common"]);
  const { resetPassword } = useAuth();
  const location = useLocation();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: (location.state as { email?: string } | null)?.email ?? "" },
  });

  async function onSubmit(values: Values) {
    setSending(true);
    try {
      await resetPassword(values.email);
      setSentTo(values.email.trim());
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t("forgot.title")}</CardTitle>
              <CardDescription>{t("forgot.description")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {sentTo ? (
                <p className="text-sm">
                  <Trans
                    t={t}
                    i18nKey="forgot.sent"
                    values={{ email: sentTo }}
                    components={{ strong: <span className="font-medium" /> }}
                  />
                </p>
              ) : (
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("forgot.email")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder={t("common:emailPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
            <CardFooter className="flex-col gap-3">
              {!sentTo && (
                <Button type="submit" className="w-full" disabled={sending}>
                  {sending ? t("forgot.submitting") : t("forgot.submit")}
                </Button>
              )}
              <Link
                to="/login"
                className="text-muted-foreground text-sm underline underline-offset-4"
              >
                {t("forgot.back")}
              </Link>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
