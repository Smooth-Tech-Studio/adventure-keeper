import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { ImageCrop } from "@adventure-keeper/schemas";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DetailSkeleton } from "@/components/ui/page-loading";
import { ImageUrlField, type ImageUrlValue } from "@/components/image-url-field";
import { AccountSettings } from "@/components/account/account-settings";
import { ImageStorageCard } from "@/components/storage/image-storage-card";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/hooks/use-auth";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useLanguage } from "@/hooks/use-language";
import { isLanguage, LANGUAGE_NAMES, LANGUAGES } from "@/i18n";
import { updateMyProfile } from "@/lib/users";

const formSchema = z.object({
  displayName: z.string().trim().min(2, "validation.min2").max(80, "validation.max80"),
  avatar: z.custom<ImageUrlValue>(),
  bio: z.string().max(500, "validation.max500"),
});
type FormValues = z.infer<typeof formSchema>;

/** The interface language — applied at once, saved to the profile. */
function LanguageCard() {
  const { t } = useTranslation("profile");
  const { language, setLanguage } = useLanguage();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("language.title")}</CardTitle>
        <CardDescription>{t("language.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={language}
          onValueChange={(value) => {
            if (isLanguage(value)) void setLanguage(value);
          }}
        >
          <SelectTrigger className="w-48" aria-label={t("language.title")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((code) => (
              <SelectItem key={code} value={code} lang={code}>
                {LANGUAGE_NAMES[code]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

/**
 * `/profil` — how the others see you: the name shown in campaigns and on the
 * packs you share, an avatar (a link + its crop, like a character portrait)
 * and a few lines for the members of your campaigns.
 */
export function ProfilePage() {
  const { user, profile, profileLoading } = useAuth();
  const { t } = useTranslation(["profile", "common"]);
  const [saving, setSaving] = useState(false);
  useBreadcrumbs([{ label: t("title") }]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { displayName: "", avatar: {}, bio: "" },
  });

  // Filled once the profile is read — and not again, so a save in another tab
  // does not wipe what is being typed here.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    // Wait for the profile itself: filled from the account alone, the bio
    // would show empty — and a save would wipe it.
    if (filled || !user || profileLoading) return;
    form.reset({
      displayName: profile?.displayName ?? user.displayName ?? "",
      avatar: {
        imageUrl: profile?.photoURL ?? user.photoURL ?? undefined,
        imageCrop: profile?.photoCrop,
      },
      bio: profile?.bio ?? "",
    });
    setFilled(true);
  }, [filled, form, profile, profileLoading, user]);

  if (!user) {
    return (
      <PageContainer size="narrow">
        <DetailSkeleton />
      </PageContainer>
    );
  }

  const avatar = form.watch("avatar");
  const name = form.watch("displayName");

  async function onSubmit(values: FormValues) {
    if (!user) return;
    setSaving(true);
    try {
      await updateMyProfile(user, {
        displayName: values.displayName,
        photoURL: values.avatar.imageUrl,
        photoCrop: values.avatar.imageCrop as ImageCrop | undefined,
        bio: values.bio,
      });
      form.reset(values);
      toast.success(t("saved"));
    } catch (error) {
      console.error(error);
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer size="narrow" className="flex flex-col gap-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <Card>
            <CardHeader className="flex flex-row items-center gap-4">
              <UserAvatar
                name={name || user.email || "?"}
                photoURL={avatar?.imageUrl}
                photoCrop={avatar?.imageCrop as ImageCrop | undefined}
                size={64}
              />
              <div className="min-w-0">
                <CardTitle className="truncate text-xl">{name || t("title")}</CardTitle>
                <CardDescription className="truncate">{user.email}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("displayName")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="nickname" {...field} />
                    </FormControl>
                    <FormDescription>{t("displayNameHint")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="avatar"
                render={({ field }) => (
                  <FormItem>
                    <ImageUrlField
                      value={field.value}
                      onChange={field.onChange}
                      label={t("avatar")}
                      placeholder={t("avatarPlaceholder")}
                    />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("bio")}</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder={t("bioPlaceholder")} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t("bioHint", { length: field.value.length })}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={saving || !form.formState.isDirty}>
                {saving ? t("common:actions.saving") : t("common:actions.save")}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
      <LanguageCard />
      <ImageStorageCard />
      <AccountSettings user={user} />
    </PageContainer>
  );
}
