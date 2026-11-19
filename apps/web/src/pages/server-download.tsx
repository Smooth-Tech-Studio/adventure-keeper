import { DownloadIcon, MonitorIcon, ServerIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DESKTOP_RELEASES_PAGE,
  desktopDownloadUrl,
  guessDesktopPlatform,
  type DesktopPlatform,
} from "@/lib/realtime/desktop-downloads";

const PLATFORMS: DesktopPlatform[] = [
  "windows",
  "macos-arm64",
  "macos-x64",
  "linux-appimage",
  "linux-deb",
];

/**
 * `/serveur` — Adventure Keeper Serveur, the desktop app that runs a live
 * session's realtime server on the GM's computer: download, first launch,
 * what to keep in mind during the session. Public: no account needed.
 */
export function ServerDownloadPage() {
  const { t } = useTranslation();
  const guessed = guessDesktopPlatform();
  const others = PLATFORMS.filter((p) => p !== guessed);

  return (
    <PageContainer size="narrow" className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
          <ServerIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("serverApp.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("serverApp.intro")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("serverApp.download")}</CardTitle>
          <CardDescription>
            {guessed ? t("serverApp.forYou") : t("serverApp.onComputer")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {guessed && (
            <Button asChild size="lg" className="self-start">
              <a href={desktopDownloadUrl(guessed)}>
                <DownloadIcon />
                {t(`serverApp.platform.${guessed}`)}
              </a>
            </Button>
          )}
          <div className="flex flex-col gap-1.5">
            {guessed && (
              <span className="text-muted-foreground text-xs">{t("serverApp.otherSystems")}</span>
            )}
            <ul className="flex flex-wrap gap-2">
              {others.map((platform) => (
                <li key={platform}>
                  <Button asChild variant="outline" size="sm">
                    <a href={desktopDownloadUrl(platform)}>
                      <MonitorIcon />
                      {t(`serverApp.platform.${platform}`)}
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <a
            href={DESKTOP_RELEASES_PAGE}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground self-start text-xs underline underline-offset-4"
          >
            {t("serverApp.allVersions")}
          </a>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t("serverApp.firstLaunch")}</h2>
        <p className="text-muted-foreground text-sm">{t("serverApp.unsigned")}</p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
          <li>{t("serverApp.launchWindows")}</li>
          <li>{t("serverApp.launchMac")}</li>
          <li>{t("serverApp.launchLinux")}</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t("serverApp.during")}</h2>
        <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
          <li>{t("serverApp.step1")}</li>
          <li>{t("serverApp.step2")}</li>
          <li>{t("serverApp.step3")}</li>
        </ol>
        <p className="text-muted-foreground text-sm">{t("serverApp.keepOpen")}</p>
      </section>
    </PageContainer>
  );
}
