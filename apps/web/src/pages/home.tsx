import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpenIcon,
  Dice6Icon,
  MapIcon,
  ScrollTextIcon,
  SwordsIcon,
  UsersIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";

const FEATURES = [
  { icon: SwordsIcon, key: "campaigns" },
  { icon: UsersIcon, key: "characters" },
  { icon: Dice6Icon, key: "sessions" },
  { icon: ScrollTextIcon, key: "notes" },
  { icon: MapIcon, key: "resources" },
  { icon: BookOpenIcon, key: "houseRules" },
] as const;

export function HomePage() {
  const { t } = useTranslation("home");
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="flex flex-col items-center gap-6 py-20 text-center">
        <Badge variant="secondary">{t("badge")}</Badge>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg text-pretty">{t("pitch")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {user ? (
            <>
              <Button asChild size="lg">
                <Link to="/campaigns">{t("myCampaigns")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/characters">{t("myCharacters")}</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="lg">
                <Link to="/signup">{t("signUp")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">{t("signIn")}</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/characters/new?system=5e">{t("tryCreation")}</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      <Separator />

      <section className="grid gap-4 py-16 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, key }) => (
          <Card key={key}>
            <CardHeader>
              <Icon className="text-primary mb-2 size-6" />
              <CardTitle>{t(`features.${key}.title`)}</CardTitle>
              <CardDescription>{t(`features.${key}.description`)}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
