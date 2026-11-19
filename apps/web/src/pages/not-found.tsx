import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-primary text-5xl font-bold">404</p>
      <h1 className="text-xl font-semibold">{t("notFound.title")}</h1>
      <p className="text-muted-foreground">{t("notFound.body")}</p>
      <Button asChild>
        <Link to="/">{t("notFound.home")}</Link>
      </Button>
    </div>
  );
}
