import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Campaign, LiveSession } from "@adventure-keeper/schemas";

import type { WithId } from "@/lib/collections";
import { run } from "@/lib/run";
import { leaveLiveSession, setLiveSessionStatus } from "@/lib/sessions";
import { useSessionChrome } from "@/hooks/use-session-chrome";
import { tr } from "@/i18n";

/**
 * Publishes the "En direct" control (connected count, end / leave actions) to
 * the global navbar for as long as the session is live.
 */
export function useSessionChromePublish(args: {
  campaignId: string | undefined;
  adventureId: string | undefined;
  sessionId: string | undefined;
  userId: string | undefined;
  campaign: WithId<Campaign> | null;
  session: WithId<LiveSession> | null | "loading";
  onBeforeLeave: () => void;
  /** Who is in the realtime room, when the session plays through one: the presence then. */
  roomUids?: string[];
  /** Before the GM ends the session (a realtime room saves its state to Firestore). */
  beforeEnd?: () => Promise<void>;
}) {
  const {
    campaignId,
    adventureId,
    sessionId,
    userId,
    campaign,
    session,
    onBeforeLeave,
    roomUids,
    beforeEnd,
  } = args;
  const navigate = useNavigate();
  const { setChrome } = useSessionChrome();

  useEffect(() => {
    if (!campaignId || !adventureId || !sessionId || !userId) return;
    if (!session || session === "loading" || session.status === "ended") {
      setChrome(null);
      return;
    }
    const campaignPath = `/campaigns/${campaignId}`;
    const adventurePath = `/campaigns/${campaignId}/adventures/${adventureId}`;
    const gm = !!campaign && campaign.ownerId === userId;
    // Through a room, presence is the room's: Firestore is not told each departure.
    const inRoom = !!session.realtime;
    setChrome({
      connectedCount: inRoom ? (roomUids?.length ?? 0) : session.connectedUids.length,
      canControl: gm,
      onEnd: () =>
        run(async () => {
          await beforeEnd?.();
          await setLiveSessionStatus(campaignId, adventureId, sessionId, "ended");
        }, "Action impossible."),
      onLeave: () => {
        onBeforeLeave();
        if (!gm && !inRoom) run(() => leaveLiveSession(campaignId, adventureId, sessionId, userId));
        navigate(gm ? adventurePath : campaignPath);
      },
      leaveLabel: gm ? tr("session:chrome.backToAdventure") : tr("session:chrome.leave"),
    });
    return () => setChrome(null);
  }, [
    campaign,
    userId,
    session,
    campaignId,
    adventureId,
    sessionId,
    navigate,
    setChrome,
    onBeforeLeave,
    roomUids,
    beforeEnd,
  ]);
}
