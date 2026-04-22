import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  onSnapshot,
  doc as firestoreDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "./firebase";
import type {
  CodeLookupResponse,
  FeaturedOutfitsResponse,
  Outfit,
  OutfitCollection,
  UploadResponse,
} from "@/types/outfit";
import { normalizeOutfitCode, formatOutfitCode } from "./outfit-code";

/**
 * Custom error class for Firebase operations
 */
export class FirebaseError extends Error {
  status: number;
  code?: string;
  errors?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    options?: { code?: string; errors?: Record<string, string[]> },
  ) {
    super(message);
    this.name = "FirebaseError";
    this.status = status;
    this.code = options?.code;
    this.errors = options?.errors;
  }
}

/**
 * PUBLIC: Fetches featured outfits from Firestore
 */
export async function fetchFeaturedOutfits(): Promise<FeaturedOutfitsResponse> {
  try {
    const outfitsRef = collection(db, "outfits");
    const q = query(outfitsRef, where("is_featured", "==", true), limit(10));
    const querySnapshot = await getDocs(q);

    const outfits: Outfit[] = querySnapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        formatted_code: formatOutfitCode((data as any).code),
      };
    }) as unknown as Outfit[];

    return { data: outfits };
  } catch (error) {
    console.error("Error fetching featured outfits:", error);
    return { data: [] };
  }
}

/**
 * PUBLIC: Looks up a code in either collections or outfits
 */
export async function fetchCodeLookup(
  inputCode: string,
): Promise<CodeLookupResponse> {
  const code = normalizeOutfitCode(inputCode);

  if (!code) {
    throw new FirebaseError("Invalid outfit code.", 422);
  }

  try {
    // 1. Try to find a collection with this code
    const collectionsRef = collection(db, "collections");
    // Search for the normalized code, the code with #, and lowercase to be safe
    const collectionQuery = query(
      collectionsRef,
      where("code", "in", [code, `#${code}`, code.toLowerCase()]),
      limit(1),
    );
    const collectionSnap = await getDocs(collectionQuery);

    if (!collectionSnap.empty) {
      const collectionDoc = collectionSnap.docs[0];
      const collectionData = collectionDoc.data();

      // Fetch outfits for this collection
      const outfitsRef = collection(db, "outfits");
      const outfitsQuery = query(outfitsRef, where("collection_id", "==", collectionDoc.id));
      const outfitsSnap = await getDocs(outfitsQuery);

      const outfits: Outfit[] = outfitsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          formatted_code: formatOutfitCode((data as any).code),
        };
      }) as unknown as Outfit[];

      return {
        message: "Collection found",
        type: "collection",
        data: {
          id: collectionDoc.id,
          ...collectionData,
          formatted_code: formatOutfitCode((collectionData as any).code),
          outfits,
        } as unknown as OutfitCollection,
      };
    }

    // 2. If no collection, try to find an individual outfit
    const outfitsRef = collection(db, "outfits");
    const outfitQuery = query(
      outfitsRef,
      where("code", "in", [code, `#${code}`, code.toLowerCase()]),
      limit(1),
    );
    const outfitSnap = await getDocs(outfitQuery);

      if (!outfitSnap.empty) {
        const outfitDoc = outfitSnap.docs[0];
        const outfitData = outfitDoc.data();
        return {
          message: "Outfit found",
          type: "outfit",
          data: {
            id: outfitDoc.id,
            ...outfitData,
            formatted_code: formatOutfitCode((outfitData as any).code),
          } as unknown as Outfit,
        };
      }

    throw new FirebaseError(`No result found for code: ${code}`, 404);
  } catch (error) {
    if (error instanceof FirebaseError) throw error;
    console.error("Error in code lookup:", error);
    throw new FirebaseError("Something went wrong with the search.", 500);
  }
}

/* -------------------------------------------------------------------------- */
/**
 * ADMIN: Check if a code is unique across both collections and outfits
 */
export async function checkCodeUniqueness(code: string, excludeId?: string) {
  // We check BOTH stores to ensure no collision anywhere
  const collectionsQuery = query(
    collection(db, "collections"),
    where("code", "==", code),
  );
  const outfitsQuery = query(
    collection(db, "outfits"),
    where("code", "==", code),
  );

  const [collectionsSnap, outfitsSnap] = await Promise.all([
    getDocs(collectionsQuery),
    getDocs(outfitsQuery),
  ]);

  const allDocs = [...collectionsSnap.docs, ...outfitsSnap.docs];

  if (excludeId) {
    // If we're updating, it's okay if the only match is the current document
    return allDocs.every((d) => d.id === excludeId);
  }

  return allDocs.length === 0;
}

/*                                ADMIN SERVICE                               */
/* -------------------------------------------------------------------------- */

/**
 * ADMIN: Fetch all collections (optionally searched by code)
 */
export async function fetchAdminCollections(search?: string) {
  try {
    const collectionsRef = collection(db, "collections");
    let q = query(collectionsRef);

    if (search?.trim()) {
      q = query(q, where("code", "==", search.trim()));
    }

    const snap = await getDocs(q);
    const collections: OutfitCollection[] = [];

    // Parallel fetch for sub-outfits is more efficient
    const collectionPromises = snap.docs.map(async (d) => {
      const data = d.data();
      const outfitsQuery = query(
        collection(db, "outfits"),
        where("collection_id", "==", d.id),
      );
      const outfitsSnap = await getDocs(outfitsQuery);
      const outfits = outfitsSnap.docs.map((od) => ({
        id: od.id,
        ...od.data(),
      })) as any;

      return {
        id: d.id,
        ...data,
        formatted_code: formatOutfitCode(data.code),
        outfits: outfits.map((o: any) => ({
          ...o,
          formatted_code: formatOutfitCode(o.code),
        })),
      } as unknown as OutfitCollection;
    });

    const results = await Promise.all(collectionPromises);
    return { data: results };
  } catch (error: any) {
    console.error("Error fetching admin collections:", error);
    throw new FirebaseError(error.message || "Failed to fetch collections.", 500);
  }
}

/**
 * ADMIN: Create collection
 */
export async function createAdminCollection(payload: any) {
  try {
    const isUnique = await checkCodeUniqueness(payload.code);
    if (!isUnique) {
      throw new Error(`The code "${payload.code}" is already in use.`);
    }

    await addDoc(collection(db, "collections"), {
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return { message: "Collection created successfully." };
  } catch (error: any) {
    console.error("Error creating collection:", error);
    throw new FirebaseError(error.message || "Failed to create collection.", 500);
  }
}

/**
 * ADMIN: Update collection
 */
export async function updateAdminCollection(id: string, payload: any) {
  try {
    const isUnique = await checkCodeUniqueness(payload.code, id);
    if (!isUnique) {
      throw new Error(`The code "${payload.code}" is already in use.`);
    }

    await updateDoc(firestoreDoc(db, "collections", id), {
      ...payload,
      updated_at: new Date().toISOString(),
    });
    return { message: "Collection updated successfully." };
  } catch (error: any) {
    console.error("Error updating collection:", error);
    throw new FirebaseError(error.message || "Failed to update collection.", 500);
  }
}

/**
 * ADMIN: Delete collection
 */
export async function deleteAdminCollection(id: string) {
  try {
    await deleteDoc(firestoreDoc(db, "collections", id));
    return { message: "Collection deleted successfully." };
  } catch (error: any) {
    console.error("Error deleting collection:", error);
    throw new FirebaseError(error.message || "Failed to delete collection.", 500);
  }
}

/**
 * ADMIN: Create outfit
 */
export async function createAdminOutfit(collectionId: string, payload: any) {
  try {
    const isUnique = await checkCodeUniqueness(payload.code);
    if (!isUnique) {
      throw new Error(`The code "${payload.code}" is already in use.`);
    }

    await addDoc(collection(db, "outfits"), {
      ...payload,
      collection_id: collectionId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return { message: "Outfit created successfully." };
  } catch (error: any) {
    console.error("Error creating outfit:", error);
    throw new FirebaseError(error.message || "Failed to create outfit.", 500);
  }
}


/**
 * ADMIN: Update outfit
 */
export async function updateAdminOutfit(id: string, payload: any) {
  try {
    const isUnique = await checkCodeUniqueness(payload.code, id);
    if (!isUnique) {
      throw new Error(`The code "${payload.code}" is already in use.`);
    }

    await updateDoc(firestoreDoc(db, "outfits", id), {
      ...payload,
      updated_at: new Date().toISOString(),
    });
    return { message: "Outfit updated successfully." };
  } catch (error: any) {
    console.error("Error updating outfit:", error);
    throw new FirebaseError(error.message || "Failed to update outfit.", 500);
  }
}

/**
 * ADMIN: Delete outfit and its associated images from Storage
 */
export async function deleteAdminOutfit(id: string) {
  try {
    // 1. Get the outfit details first to retrieve image paths
    const outfitDoc = await getDoc(firestoreDoc(db, "outfits", id));
    if (outfitDoc.exists()) {
      const data = outfitDoc.data() as Outfit;

      // 2. Delete main image if it has a path
      if (data.image_path) {
        await deleteAdminImage(data.image_path).catch(console.error);
      }

      // 3. Delete all affiliate thumbnail images
      if (data.affiliate_items?.length > 0) {
        const deletePromises = data.affiliate_items
          .filter((item) => item.thumbnail_path)
          .map((item) => deleteAdminImage(item.thumbnail_path!).catch(console.error));
        await Promise.all(deletePromises);
      }
    }

    // 4. Finally delete the Firestore document
    await deleteDoc(firestoreDoc(db, "outfits", id));
    return { message: "Outfit and associated images deleted successfully." };
  } catch (error: any) {
    console.error("Error deleting outfit:", error);
    throw new FirebaseError(error.message || "Failed to delete outfit.", 500);
  }
}

/**
 * ADMIN: Delete an image from Firebase Storage
 */
export async function deleteAdminImage(path: string) {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    return { message: "Image deleted successfully." };
  } catch (error: any) {
    console.error(`Error deleting image at ${path}:`, error);
    // We don't always want to throw here so that document deletion can continue
    // but we should log it.
  }
}

/**
 * ADMIN: Upload image to Firebase Storage
 */
export async function uploadAdminImage(
  file: File,
  type: "outfit" | "affiliate",
): Promise<UploadResponse> {
  try {
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
    const storageRef = ref(storage, `uploads/${type}/${fileName}`);
    const snap = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snap.ref);

    return {
      message: "Image uploaded successfully.",
      data: {
        url,
        path: snap.ref.fullPath,
      },
    };
  } catch (error: any) {
    console.error("Error uploading image:", error);
    throw new FirebaseError(error.message || "Failed to upload image.", 500);
  }
}

/**
 * ANALYTICS: Increment visitor count
 */
export async function trackVisitor() {
  try {
    const statsRef = firestoreDoc(db, "analytics", "site_stats");
    await setDoc(
      statsRef,
      {
        visitor_count: increment(1),
        last_visit: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error tracking visitor:", error);
  }
}

/**
 * ANALYTICS: Subscribe to visitor stats
 */
export function subscribeToVisitorStats(
  callback: (stats: { visitor_count: number } | null) => void
) {
  const statsRef = firestoreDoc(db, "analytics", "site_stats");
  return onSnapshot(
    statsRef,
    (doc) => {
      if (doc.exists()) {
        callback(doc.data() as { visitor_count: number });
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error("Error subscribing to visitor stats:", error);
      callback(null);
    }
  );
}

