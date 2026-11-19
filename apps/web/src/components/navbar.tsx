import { Link, NavLink, useNavigate } from "react-router-dom";
import { CompassIcon, LogInIcon, LogOutIcon, UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsBell } from "@/components/notifications-bell";
import { SessionNavControl } from "@/components/session/session-nav-control";
import { SettingsMenu } from "@/components/settings-menu";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { useAuth } from "@/hooks/use-auth";
import { useSessionChrome } from "@/hooks/use-session-chrome";

const NAV_LINKS = [
  { to: "/campaigns", label: "nav.campaigns" },
  { to: "/characters", label: "nav.characters" },
  { to: "/packs", label: "nav.packs" },
] as const;

export function Navbar() {
  const { t } = useTranslation();
  const { user, profile, loading, logout } = useAuth();
  // The profile is the live source: a name changed on /profil shows at once.
  const displayName = profile?.displayName || user?.displayName || user?.email || "";
  const { chrome } = useSessionChrome();
  const navigate = useNavigate();
  const inSession = chrome !== null;

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur print:hidden">
      <div className="flex h-14 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <CompassIcon className="text-primary size-5" />
            <span>{t("appName")}</span>
          </Link>

          {inSession && chrome && <SessionNavControl chrome={chrome} />}

          {user && !inSession && (
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      "hover:text-foreground rounded-md px-3 py-1.5 text-sm transition-colors",
                      isActive ? "text-foreground font-medium" : "text-muted-foreground",
                    )
                  }
                >
                  {t(link.label)}
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-1">
          <SettingsMenu />
          {user && !inSession && <NotificationsBell uid={user.uid} />}

          {loading ? null : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label={t("nav.accountMenu")}
                >
                  <UserAvatar
                    name={displayName}
                    photoURL={profile?.photoURL ?? user.photoURL ?? undefined}
                    photoCrop={profile?.photoCrop}
                    size={32}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal">
                  <span className="block text-sm font-medium">
                    {displayName || t("nav.myAccount")}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!inSession && (
                  <>
                    {NAV_LINKS.map((link) => (
                      <DropdownMenuItem key={link.to} asChild className="sm:hidden">
                        <Link to={link.to}>{t(link.label)}</Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="sm:hidden" />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/profil">
                    <UserIcon />
                    {t("nav.myProfile")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
                  <LogOutIcon />
                  {t("nav.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link to="/login" aria-label={t("nav.signIn")}>
                <LogInIcon className="size-4" />
                <span className="hidden sm:inline">{t("nav.signIn")}</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
