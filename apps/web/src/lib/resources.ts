import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  COLLECTIONS,
  resourceSchema,
  type Resource,
  type ResourceKind,
  type ResourceVisibility,
  type WithId,
} from "@adventure-keeper/schemas";

import { db } from "@/lib/firebase";
import { parseDoc, toMillis } from "@/lib/firestore";

const resourcesCol = (campaignId: string) =>
  collection(db, COLLECTIONS.campaigns, campaignId, COLLECTIONS.resources);

export interface CreateResourceInput {
  title: string;
  url: string;
  kind: ResourceKind;
  visibility: ResourceVisibility;
  description?: string;
}

/** Live resources list, most-recently-updated first (GM-only per the rules). */
export function subscribeResources(
  campaignId: string,
  onChange: (resources: WithId<Resource>[]) => void,
): () => void {
  const ref = resourcesCol(campaignId);
  return onSnapshot(ref, (snapshot) => {
    const resources = snapshot.docs.map((d) => parseDoc<Resource>(resourceSchema, d));
    resources.sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
    onChange(resources);
  });
}

export async function createResource(
  campaignId: string,
  input: CreateResourceInput,
  uploadedBy: string,
): Promise<string> {
  const now = serverTimestamp();
  const ref = await addDoc(resourcesCol(campaignId), {
    campaignId,
    uploadedBy,
    title: input.title.trim(),
    url: input.url.trim(),
    kind: input.kind,
    visibility: input.visibility,
    description: input.description?.trim() || undefined,
    tags: [],
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateResource(
  campaignId: string,
  resourceId: string,
  patch: Partial<Pick<Resource, "title" | "url" | "kind" | "visibility" | "description" | "tags">>,
): Promise<void> {
  await updateDoc(doc(resourcesCol(campaignId), resourceId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteResource(campaignId: string, resourceId: string): Promise<void> {
  await deleteDoc(doc(resourcesCol(campaignId), resourceId));
}
