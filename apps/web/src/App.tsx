import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { BareLayout } from "@/components/bare-layout";
import { ProtectedRoute } from "@/components/protected-route";
import { RootLayout } from "@/components/root-layout";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { ContentPacksProvider } from "@/systems/dnd2024/hooks/use-content-packs";
import { BreadcrumbsProvider } from "@/hooks/breadcrumbs-provider";
import { FullWidthPageProvider } from "@/hooks/full-width-page-provider";
import { LicenceNoticeProvider } from "@/hooks/licence-notice-provider";
import { SessionChromeProvider } from "@/hooks/session-chrome-provider";
// Small, entry-path pages stay eager; everything behind auth is code-split.
import { HomePage } from "@/pages/home";
import { CreditsPage } from "@/pages/credits";
import { ForgotPasswordPage } from "@/pages/forgot-password";
import { LoginPage } from "@/pages/login";
import { NotFoundPage } from "@/pages/not-found";
import { ServerDownloadPage } from "@/pages/server-download";
import { SignupPage } from "@/pages/signup";

const CampaignsListPage = lazy(() =>
  import("@/pages/campaigns/campaigns-list").then((m) => ({ default: m.CampaignsListPage })),
);
const CreateCampaignPage = lazy(() =>
  import("@/pages/campaigns/create-campaign").then((m) => ({ default: m.CreateCampaignPage })),
);
const CampaignFormatPage = lazy(() =>
  import("@/pages/campaigns/campaign-format-page").then((m) => ({
    default: m.CampaignFormatPage,
  })),
);
const ChronicleBookPage = lazy(() =>
  import("@/pages/adventures/chronicle-book").then((m) => ({ default: m.ChronicleBookPage })),
);
const CodexPage = lazy(() =>
  import("@/pages/campaigns/codex-page").then((m) => ({ default: m.CodexPage })),
);
const CampaignDetailPage = lazy(() =>
  import("@/pages/campaigns/campaign-detail").then((m) => ({ default: m.CampaignDetailPage })),
);
const JoinCampaignPage = lazy(() =>
  import("@/pages/campaigns/join-campaign").then((m) => ({ default: m.JoinCampaignPage })),
);
const PacksPage = lazy(() =>
  import("@/systems/dnd2024/packs/pages/packs-page").then((m) => ({ default: m.PacksPage })),
);
const PackPage = lazy(() =>
  import("@/systems/dnd2024/packs/pages/pack-page").then((m) => ({ default: m.PackPage })),
);
const ProfilePage = lazy(() =>
  import("@/pages/profile-page").then((m) => ({ default: m.ProfilePage })),
);
const StorageCallbackPage = lazy(() =>
  import("@/pages/storage-callback-page").then((m) => ({ default: m.StorageCallbackPage })),
);
const PackFormatPage = lazy(() =>
  import("@/systems/dnd2024/packs/pages/pack-format-page").then((m) => ({
    default: m.PackFormatPage,
  })),
);
const CreateAdventurePage = lazy(() =>
  import("@/pages/adventures/create-adventure").then((m) => ({ default: m.CreateAdventurePage })),
);
const AdventureDetailPage = lazy(() =>
  import("@/pages/adventures/adventure-detail").then((m) => ({ default: m.AdventureDetailPage })),
);
const GameSessionPage = lazy(() =>
  import("@/pages/sessions/game-session").then((m) => ({ default: m.GameSessionPage })),
);
const CharactersListPage = lazy(() =>
  import("@/pages/characters/characters-list").then((m) => ({ default: m.CharactersListPage })),
);
const CreateCharacterPage = lazy(() =>
  import("@/pages/characters/create-character").then((m) => ({ default: m.CreateCharacterPage })),
);
const CharacterDetailPage = lazy(() =>
  import("@/pages/characters/character-detail").then((m) => ({ default: m.CharacterDetailPage })),
);
const LevelUpCharacterPage = lazy(() =>
  import("@/systems/dnd2024/pages/level-up-character").then((m) => ({
    default: m.LevelUpCharacterPage,
  })),
);
const RebuildCharacterPage = lazy(() =>
  import("@/systems/dnd2024/pages/rebuild-character").then((m) => ({
    default: m.RebuildCharacterPage,
  })),
);
const EditCharacterPage = lazy(() =>
  import("@/pages/characters/edit-character").then((m) => ({ default: m.EditCharacterPage })),
);

function Protected({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export function App() {
  // Re-render the whole tree on a language change: the engine's tables
  // (`ABILITY_LABELS`…) read the language at render time, without a hook.
  useTranslation();
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <BrowserRouter>
        <AuthProvider>
          <ContentPacksProvider>
            <SessionChromeProvider>
              <BreadcrumbsProvider>
                <LicenceNoticeProvider>
                  <FullWidthPageProvider>
                    <Routes>
                      <Route element={<RootLayout />}>
                        <Route index element={<HomePage />} />
                        <Route path="login" element={<LoginPage />} />
                        <Route path="mot-de-passe-oublie" element={<ForgotPasswordPage />} />
                        <Route path="signup" element={<SignupPage />} />
                        <Route path="credits" element={<CreditsPage />} />
                        <Route path="serveur" element={<ServerDownloadPage />} />

                        <Route
                          path="campaigns"
                          element={
                            <Protected>
                              <CampaignsListPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="campaigns/new"
                          element={
                            <Protected>
                              <CreateCampaignPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="campaigns/:id"
                          element={
                            <Protected>
                              <CampaignDetailPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="campaigns/format"
                          element={
                            <Protected>
                              <CampaignFormatPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="campaigns/:id/chronique"
                          element={
                            <Protected>
                              <ChronicleBookPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="campaigns/:id/adventures/:adventureId/chronique"
                          element={
                            <Protected>
                              <ChronicleBookPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="campaigns/:id/codex"
                          element={
                            <Protected>
                              <CodexPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="join/:inviteId"
                          element={
                            <Protected>
                              <JoinCampaignPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="campaigns/:id/adventures/new"
                          element={
                            <Protected>
                              <CreateAdventurePage />
                            </Protected>
                          }
                        />
                        <Route
                          path="campaigns/:id/adventures/:adventureId"
                          element={
                            <Protected>
                              <AdventureDetailPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="campaigns/:id/adventures/:adventureId/session/:sessionId"
                          element={
                            <Protected>
                              <GameSessionPage />
                            </Protected>
                          }
                        />

                        <Route
                          path="characters"
                          element={
                            <Protected>
                              <CharactersListPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="characters/new"
                          // Open to guests: the 5E creation runs on the device
                          // and asks for an account only to save.
                          element={<CreateCharacterPage />}
                        />
                        <Route
                          path="characters/:id"
                          element={
                            <Protected>
                              <CharacterDetailPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="characters/:id/level-up"
                          element={
                            <Protected>
                              <LevelUpCharacterPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="characters/:id/rebuild"
                          element={
                            <Protected>
                              <RebuildCharacterPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="characters/:id/edit"
                          element={
                            <Protected>
                              <EditCharacterPage />
                            </Protected>
                          }
                        />

                        <Route
                          path="packs"
                          element={
                            <Protected>
                              <PacksPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="stockage/dropbox"
                          element={
                            <Protected>
                              <StorageCallbackPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="profil"
                          element={
                            <Protected>
                              <ProfilePage />
                            </Protected>
                          }
                        />
                        <Route
                          path="packs/format"
                          element={
                            <Protected>
                              <PackFormatPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="packs/shared/:packDocId"
                          element={
                            <Protected>
                              <PackPage />
                            </Protected>
                          }
                        />
                        <Route
                          path="packs/:packDocId"
                          element={
                            <Protected>
                              <PackPage />
                            </Protected>
                          }
                        />

                        <Route path="*" element={<NotFoundPage />} />
                      </Route>
                      {/* One block of a live session, alone in its own tab. */}
                      <Route element={<BareLayout />}>
                        <Route
                          path="campaigns/:id/adventures/:adventureId/session/:sessionId/:pane"
                          element={
                            <Protected>
                              <GameSessionPage />
                            </Protected>
                          }
                        />
                      </Route>
                    </Routes>
                    <Toaster richColors position="top-center" />
                  </FullWidthPageProvider>
                </LicenceNoticeProvider>
              </BreadcrumbsProvider>
            </SessionChromeProvider>
          </ContentPacksProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
