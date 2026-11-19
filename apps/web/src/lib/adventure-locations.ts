import { deleteField, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import {
  COLLECTIONS,
  adventureLocationSchema,
  adventureLocationSecretSchema,
  type AdventureLocation,
  type AdventureLocationSecret,
  type MapScale,
  type WithId,
} from "@adventure-keeper/schemas";

import { adventureSubCollection } from "@/lib/adventure-crud";
import { db } from "@/lib/firebase";
import { normalizePlannedLoot, type PlannedLootInput } from "@/lib/planned-loot";

// A location lives in two documents with the same id (see the schema): the
// public one players read during a session, and a GM-only one holding the
// description and the full map URL. Firestore rules grant read per document, so
// the split is what keeps a hidden location's secrets off the wire.
const locations = adventureSubCollection<AdventureLocation>(COLLECTIONS.locations, {
  ordered: true,
  schema: adventureLocationSchema,
});
const secrets = adventureSubCollection<AdventureLocationSecret>(COLLECTIONS.locationSecrets, {
  schema: adventureLocationSecretSchema,
});

export interface CreateLocationInput {
  name: string;
  description?: string;
  imageUrl?: string;
  hidden?: boolean;
  scale?: MapScale;
  loot?: PlannedLootInput;
}

export const secretsCollection = secrets.col;

/**
 * Join the public rows with their secrets. A secret wins; a legacy row that
 * still carries the fields itself keeps them until {@link migrateLegacyLocations}
 * has moved them.
 */
export function mergeLocationSecrets(
  rows: WithId<AdventureLocation>[],
  secretRows: WithId<AdventureLocationSecret>[],
): WithId<AdventureLocation>[] {
  const byId = new Map(secretRows.map((s) => [s.id, s]));
  return rows.map((row) => {
    const secret = byId.get(row.id);
    const merged: WithId<AdventureLocation> = { ...row };
    const description = secret?.description ?? row.description;
    const imageUrl = secret?.imageUrl ?? row.imageUrl;
    const storagePath = secret?.storagePath ?? row.storagePath;
    if (description !== undefined) merged.description = description;
    else delete merged.description;
    if (imageUrl !== undefined) merged.imageUrl = imageUrl;
    else delete merged.imageUrl;
    if (storagePath !== undefined) merged.storagePath = storagePath;
    else delete merged.storagePath;
    if (secret?.loot) merged.loot = secret.loot;
    else delete merged.loot;
    return merged;
  });
}

/**
 * Locations written before the split keep their description (and, when hidden,
 * their map URL) on the public doc, readable by players. Move them to the
 * secret doc; the GM's client runs this whenever it loads the locations.
 */
export async function migrateLegacyLocations(
  campaignId: string,
  adventureId: string,
  rows: WithId<AdventureLocation>[],
  secretRows: WithId<AdventureLocationSecret>[],
): Promise<void> {
  const secretIds = new Set(secretRows.map((s) => s.id));
  const legacy = rows.filter(
    (row) =>
      row.description !== undefined ||
      row.storagePath !== undefined ||
      (row.hidden && row.imageUrl !== undefined) ||
      !secretIds.has(row.id),
  );
  if (legacy.length === 0) return;
  const batch = writeBatch(db);
  for (const row of legacy) {
    const secret: Record<string, unknown> = {
      campaignId,
      adventureId,
      updatedAt: serverTimestamp(),
    };
    if (!secretIds.has(row.id)) secret.createdAt = serverTimestamp();
    if (row.description !== undefined) secret.description = row.description;
    if (row.storagePath !== undefined) secret.storagePath = row.storagePath;
    if (row.imageUrl !== undefined) secret.imageUrl = row.imageUrl;
    batch.set(secrets.ref(campaignId, adventureId, row.id), secret, { merge: true });
    const strip: Record<string, unknown> = {};
    if (row.description !== undefined) strip.description = deleteField();
    if (row.storagePath !== undefined) strip.storagePath = deleteField();
    if (row.hidden && row.imageUrl !== undefined) strip.imageUrl = deleteField();
    if (Object.keys(strip).length > 0) {
      batch.update(locations.ref(campaignId, adventureId, row.id), strip);
    }
  }
  await batch.commit();
}

/**
 * Locations as the GM sees them (secrets merged in) when `gm`, else as a player
 * does: the public docs only.
 */
export async function listLocations(
  campaignId: string,
  adventureId: string,
  { gm = false }: { gm?: boolean } = {},
): Promise<WithId<AdventureLocation>[]> {
  const rows = await locations.list(campaignId, adventureId);
  if (!gm) return rows;
  const secretRows = await secrets.list(campaignId, adventureId);
  await migrateLegacyLocations(campaignId, adventureId, rows, secretRows).catch((error) =>
    console.error("[locations] migration impossible", error),
  );
  return mergeLocationSecrets(rows, secretRows);
}

/** Live locations (order-sorted) — the session panel toggles `hidden` in play. */
export function subscribeLocations(
  campaignId: string,
  adventureId: string,
  onChange: (rows: WithId<AdventureLocation>[]) => void,
  { gm = false }: { gm?: boolean } = {},
): () => void {
  if (!gm) return locations.subscribe(campaignId, adventureId, onChange);
  let rows: WithId<AdventureLocation>[] | null = null;
  let secretRows: WithId<AdventureLocationSecret>[] | null = null;
  const emit = () => {
    if (!rows || !secretRows) return;
    migrateLegacyLocations(campaignId, adventureId, rows, secretRows).catch((error) =>
      console.error("[locations] migration impossible", error),
    );
    onChange(mergeLocationSecrets(rows, secretRows));
  };
  const unsubRows = locations.subscribe(campaignId, adventureId, (next) => {
    rows = next;
    emit();
  });
  const unsubSecrets = secrets.subscribe(campaignId, adventureId, (next) => {
    secretRows = next;
    emit();
  });
  return () => {
    unsubRows();
    unsubSecrets();
  };
}

export async function deleteLocation(
  campaignId: string,
  adventureId: string,
  id: string,
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(locations.ref(campaignId, adventureId, id));
  batch.delete(secrets.ref(campaignId, adventureId, id));
  await batch.commit();
}

export async function addLocation(
  campaignId: string,
  adventureId: string,
  input: CreateLocationInput,
  order?: number,
): Promise<string> {
  const resolvedOrder = order ?? (await locations.nextOrder(campaignId, adventureId));
  const hidden = input.hidden ?? false;
  const description = input.description?.trim() || undefined;
  const imageUrl = input.imageUrl?.trim() || undefined;
  const loot = normalizePlannedLoot(input.loot);
  const publicRef = doc(locations.col(campaignId, adventureId));
  const now = serverTimestamp();
  const batch = writeBatch(db);
  batch.set(publicRef, {
    campaignId,
    adventureId,
    name: input.name,
    // A hidden location's map is only served through the session's snapshot.
    ...(imageUrl && !hidden ? { imageUrl } : {}),
    hidden,
    // Not a secret: it only sizes the squares and tokens.
    ...(input.scale ? { scale: input.scale } : {}),
    order: resolvedOrder,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(secrets.ref(campaignId, adventureId, publicRef.id), {
    campaignId,
    adventureId,
    ...(description ? { description } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(loot ? { loot } : {}),
    createdAt: now,
    updatedAt: now,
  });
  await batch.commit();
  return publicRef.id;
}

export async function updateLocation(
  campaignId: string,
  adventureId: string,
  locationId: string,
  values: {
    name: string;
    description: string;
    imageUrl: string;
    hidden: boolean;
    scale?: MapScale;
    loot?: PlannedLootInput;
  },
): Promise<void> {
  const imageUrl = values.imageUrl.trim();
  const batch = writeBatch(db);
  batch.update(locations.ref(campaignId, adventureId, locationId), {
    name: values.name.trim(),
    imageUrl: imageUrl && !values.hidden ? imageUrl : deleteField(),
    // Legacy fields, in case this doc has not been migrated yet.
    description: deleteField(),
    storagePath: deleteField(),
    hidden: values.hidden,
    scale: values.scale ?? deleteField(),
    updatedAt: serverTimestamp(),
  });
  batch.set(
    secrets.ref(campaignId, adventureId, locationId),
    {
      campaignId,
      adventureId,
      description: values.description.trim() || deleteField(),
      imageUrl: imageUrl || deleteField(),
      loot: normalizePlannedLoot(values.loot) ?? deleteField(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
}

/**
 * Flip a location's "à cacher" flag — used live from the session panel. The map
 * URL follows: it leaves the public doc when the location becomes hidden and
 * comes back when it is revealed.
 */
export async function setLocationHidden(
  campaignId: string,
  adventureId: string,
  locationId: string,
  hidden: boolean,
): Promise<void> {
  const publicRef = locations.ref(campaignId, adventureId, locationId);
  const secretRef = secrets.ref(campaignId, adventureId, locationId);
  const [publicSnap, secretSnap] = await Promise.all([getDoc(publicRef), getDoc(secretRef)]);
  const imageUrl: string | undefined = secretSnap.data()?.imageUrl ?? publicSnap.data()?.imageUrl;
  const batch = writeBatch(db);
  batch.update(publicRef, {
    hidden,
    imageUrl: imageUrl && !hidden ? imageUrl : deleteField(),
    updatedAt: serverTimestamp(),
  });
  if (imageUrl) {
    batch.set(
      secretRef,
      {
        campaignId,
        adventureId,
        imageUrl,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
  await batch.commit();
}
