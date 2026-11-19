import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import i18n, { currentLanguage, type Language } from "@/i18n";
import { useAuth } from "@/hooks/use-auth";
import { updateMyLocale } from "@/lib/users";

/**
 * The interface language and how to change it. Signed in, the choice goes to
 * the profile too, so it follows the account onto other devices; a guest's
 * stays on this device.
 */
export function useLanguage(): {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
} {
  // Subscribes the caller to language changes.
  useTranslation();
  const { user } = useAuth();

  const setLanguage = useCallback(
    async (language: Language) => {
      await i18n.changeLanguage(language);
      if (!user) return;
      try {
        await updateMyLocale(user.uid, language);
      } catch (error) {
        console.error(error);
        toast.error(i18n.t("language.saveFailed"));
      }
    },
    [user],
  );

  return { language: currentLanguage(), setLanguage };
}
