import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import {
  imageStorageAvailable,
  subscribeStorageConnection,
  uploadImage,
  type StorageConnection,
} from "@/lib/image-storage";

/**
 * The signed-in player's image store: whether the deployment offers one, the
 * connection (`undefined` while loading, `null` when not connected), and an
 * `upload` that returns the image's public link.
 */
export function useImageStorage() {
  const { user } = useAuth();
  const available = imageStorageAvailable();
  const [connection, setConnection] = useState<StorageConnection | null | undefined>(undefined);
  useEffect(() => {
    if (!user || !available) return;
    return subscribeStorageConnection(user.uid, setConnection);
  }, [user, available]);
  return {
    available,
    connection: available && user ? connection : null,
    upload: (file: File) => {
      if (!user || !connection) throw new Error("no image storage connected");
      return uploadImage(user.uid, connection, file);
    },
  };
}
