import { useState } from "react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authErrorMessage } from "@/lib/auth-errors";
import { useAuth } from "@/hooks/use-auth";

const signupSchema = z
  .object({
    displayName: z.string().min(2, "validation.min2").max(80, "validation.max80"),
    email: z.string().min(1, "validation.emailRequired").email("validation.emailInvalid"),
    password: z.string().min(8, "validation.min8"),
    confirmPassword: z.string().min(1, "validation.confirmRequired"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "validation.passwordsMismatch",
    path: ["confirmPassword"],
  });

type SignupValues = z.infer<typeof signupSchema>;

export function SignupPage() {
  const { t } = useTranslation(["auth", "common"]);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);

  // Set by `ProtectedRoute` (via the login page) — e.g. an invite link.
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: SignupValues) {
    setSubmitting(true);
    try {
      await signUp({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
      });
      toast.success(t("signup.success"));
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
              <CardTitle className="text-xl">{t("signup.title")}</CardTitle>
              <CardDescription>{t("signup.description")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signup.displayName")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="nickname"
                        placeholder={t("signup.displayNamePlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signup.email")}</FormLabel>
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
                    <FormLabel>{t("signup.password")}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormDescription>{t("signup.passwordHint")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signup.confirmPassword")}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? t("signup.submitting") : t("signup.submit")}
              </Button>
              <p className="text-muted-foreground text-sm">
                {t("signup.haveAccount")}{" "}
                <Link
                  to="/login"
                  state={location.state}
                  className="text-foreground font-medium underline underline-offset-4"
                >
                  {t("signup.signIn")}
                </Link>
              </p>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
