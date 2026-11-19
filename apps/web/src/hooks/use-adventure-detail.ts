import { useCallback, useEffect, useState } from "react";
import {
  playerCanReadAdventure,
  type Adventure,
  type AdventureEnemy,
  type AdventureEvent,
  type AdventureLocation,
  type AdventureNpc,
  type AdventureParticipant,
  type Campaign,
  type CampaignMember,
  type LiveSession,
} from "@adventure-keeper/schemas";

import {
  getAdventure,
  listCampaignMembers,
  listEnemies,
  listEvents,
  listLocations,
  listNpcs,
  listParticipants,
} from "@/lib/adventures";
import { getCampaign, type WithId } from "@/lib/collections";
import { getActiveLiveSession, listEndedSessions } from "@/lib/sessions";
import { softLoad } from "@/lib/load";

export type AdventureLoad = WithId<Adventure> | null | "missing" | "error";

export interface AdventureDetailState {
  campaign: WithId<Campaign> | null;
  adventure: AdventureLoad;
  members: WithId<CampaignMember>[];
  locations: WithId<AdventureLocation>[];
  participants: WithId<AdventureParticipant>[];
  enemyList: WithId<AdventureEnemy>[];
  npcList: WithId<AdventureNpc>[];
  /** Story beats — loaded for the GM only (players read them in the chronicle). */
  eventList: WithId<AdventureEvent>[];
  session: WithId<LiveSession> | null;
  endedSessions: WithId<LiveSession>[];
  reload: () => Promise<void>;
}

/**
 * Loads everything the adventure detail page shows. Critical reads (campaign +
 * adventure) drive the `AdventureLoad` state machine; the subcollection
 * reads are soft — one failure defaults to empty rather than hiding the page.
 */
export function useAdventureDetail(
  campaignId: string | undefined,
  adventureId: string | undefined,
  userId: string | undefined,
): AdventureDetailState {
  const [campaign, setCampaign] = useState<WithId<Campaign> | null>(null);
  const [adventure, setAdventure] = useState<AdventureLoad>(null);
  const [members, setMembers] = useState<WithId<CampaignMember>[]>([]);
  const [locations, setLocations] = useState<WithId<AdventureLocation>[]>([]);
  const [participants, setParticipants] = useState<WithId<AdventureParticipant>[]>([]);
  const [enemyList, setEnemyList] = useState<WithId<AdventureEnemy>[]>([]);
  const [npcList, setNpcList] = useState<WithId<AdventureNpc>[]>([]);
  const [eventList, setEventList] = useState<WithId<AdventureEvent>[]>([]);
  const [session, setSession] = useState<WithId<LiveSession> | null>(null);
  const [endedSessions, setEndedSessions] = useState<WithId<LiveSession>[]>([]);

  const reload = useCallback(async () => {
    if (!campaignId || !adventureId || !userId) return;

    let c: WithId<Campaign> | null;
    let a: WithId<Adventure> | null;
    try {
      [c, a] = await Promise.all([getCampaign(campaignId), getAdventure(campaignId, adventureId)]);
    } catch (error) {
      console.error("[adventure] échec du chargement de l'aventure", error);
      setAdventure("error");
      return;
    }
    if (!a) {
      setAdventure("missing");
      return;
    }
    if (!c) {
      console.error("[adventure] aventure trouvée mais campagne inaccessible");
      setAdventure("error");
      return;
    }
    setCampaign(c);
    setAdventure(a);
    // Between sessions a player reads the chronicle only: the adventure's
    // content (locations, enemies, NPCs) is GM-only until it is live or over.
    const content = c.ownerId === userId || playerCanReadAdventure(a);
    const none = <T>() => Promise.resolve([] as WithId<T>[]);

    const isGm = c.ownerId === userId;
    const [m, l, p, e, n, ev, s, ended] = await Promise.all([
      listCampaignMembers(campaignId).catch(
        softLoad("les membres", [] as WithId<CampaignMember>[]),
      ),
      (content
        ? listLocations(campaignId, adventureId, { gm: c.ownerId === userId })
        : none<AdventureLocation>()
      ).catch(softLoad("les lieux", [] as WithId<AdventureLocation>[])),
      listParticipants(campaignId, adventureId).catch(
        softLoad("les participants", [] as WithId<AdventureParticipant>[]),
      ),
      (content ? listEnemies(campaignId, adventureId) : none<AdventureEnemy>()).catch(
        softLoad("les ennemis", [] as WithId<AdventureEnemy>[]),
      ),
      (content ? listNpcs(campaignId, adventureId) : none<AdventureNpc>()).catch(
        softLoad("les PNJ", [] as WithId<AdventureNpc>[]),
      ),
      (isGm ? listEvents(campaignId, adventureId) : none<AdventureEvent>()).catch(
        softLoad("les événements", [] as WithId<AdventureEvent>[]),
      ),
      getActiveLiveSession(campaignId, adventureId).catch(
        softLoad("la session en direct", null as WithId<LiveSession> | null),
      ),
      listEndedSessions(campaignId, adventureId).catch(
        softLoad("les sessions passées", [] as WithId<LiveSession>[]),
      ),
    ]);
    setMembers(m);
    setLocations(l);
    setParticipants(p);
    setEnemyList(e);
    setNpcList(n);
    setEventList(ev);
    setSession(s);
    setEndedSessions(ended);
  }, [campaignId, adventureId, userId]);

  useEffect(() => {
    reload().catch((error) => {
      console.error(error);
      setAdventure("error");
    });
  }, [reload]);

  return {
    campaign,
    adventure,
    members,
    locations,
    participants,
    enemyList,
    npcList,
    eventList,
    session,
    endedSessions,
    reload,
  };
}
