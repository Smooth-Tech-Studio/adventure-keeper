import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useLicenceNoticeValue } from "@/hooks/use-licence-notice";

/** The footer under every page: the tagline, the credits, and the licence of the content on screen. */
export function AppFooter() {
  const { t } = useTranslation();
  // Attribution follows the content on screen, not one system for the whole app.
  const notice = useLicenceNoticeValue();
  return (
    <footer className="text-muted-foreground flex flex-col items-center gap-1 border-t py-6 text-center text-sm print:hidden">
      <span>{t("footer.tagline")}</span>
      <span className="text-xs">
        {notice && <>{t(`licence.${notice}`)} · </>}
        <Link to="/credits" className="underline underline-offset-4">
          {t("footer.credits")}
        </Link>
        {" · "}
        <Link to="/serveur" className="underline underline-offset-4">
          {t("footer.server")}
        </Link>
      </span>
    </footer>
  );
}
