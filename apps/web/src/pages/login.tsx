import { useState } from "react";
import { InfoIcon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { authErrorMessage } from "@/lib/auth-errors";
import { useAuth } from "@/hooks/use-auth";
import { IDLE_DAYS, MAX_SESSION_DAYS, takeSessionEnded } from "@/lib/session-policy";

const loginSchema = z.object({
  email: z.string().min(1, "validation.emailRequired").email("validation.emailInvalid"),
  password: z.string().min(1, "validation.passwordRequired"),
  remember: z.boolean(),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { t } = useTranslation(["auth", "common"]);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  // Why the previous session ended, if the session policy ended it — read once.
  const [ended] = useState(takeSessionEnded);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });
  // Watched, not read once: the forgot-password link carries what is typed.
  const email = form.watch("email");

  async function onSubmit(values: LoginValues) {
    setSubmitting(true);
    try {
      await signIn(values.email, values.password, values.remember);
      toast.success(t("login.success"));
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t("login.title")}</CardTitle>
              <CardDescription>{t("login.description")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {ended && (
                <p className="bg-muted flex gap-2 rounded-md p-3 text-sm">
                  <InfoIcon className="mt-0.5 size-4 shrink-0" />
                  {ended === "expired"
                    ? t("login.expired", { days: MAX_SESSION_DAYS })
                    : t("login.idle", { days: IDLE_DAYS })}
                </p>
              )}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("login.email")}</FormLabel>
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
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-baseline justify-between gap-2">
                      <FormLabel>{t("login.password")}</FormLabel>
                      <Link
                        to="/mot-de-passe-oublie"
                        state={{ email }}
                        className="text-muted-foreground text-xs underline underline-offset-4"
                      >
                        {t("login.forgot")}
                      </Link>
                    </div>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="remember"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                    </FormControl>
                    <div className="grid gap-0.5 leading-none">
                      <FormLabel className="font-normal">{t("login.remember")}</FormLabel>
                      <p className="text-muted-foreground text-xs">
                        {t("login.rememberHint", { days: MAX_SESSION_DAYS })}
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? t("login.submitting") : t("login.submit")}
              </Button>
              <p className="text-muted-foreground text-sm">
                {t("login.noAccount")}{" "}
                <Link
                  to="/signup"
                  state={location.state}
                  className="text-foreground font-medium underline underline-offset-4"
                >
                  {t("login.signUp")}
                </Link>
              </p>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
