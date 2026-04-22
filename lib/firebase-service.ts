import {
  collection,
  CollectionReference,
  DocumentData,
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
  AdminUpsertCollectionPayload,
  AdminUpsertOutfitPayload,
  AffiliateItem,
  AffiliateLibraryItem,
  AffiliateLibraryListResponse,
  AdminUpsertAffiliateLibraryItemPayload,
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

function formatDisplayPrice(price: number | null) {
  if (price == null || Number.isNaN(price)) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

function normalizeAffiliateLibraryItem(
  id: string,
  data: Record<string, unknown>,
): AffiliateLibraryItem {
  const rawPrice = data.price;
  const price =
    typeof rawPrice === "number"
      ? rawPrice
      : typeof rawPrice === "string" && rawPrice.trim() !== ""
        ? Number(rawPrice)
        : null;

  return {
    id,
    product_name: String(data.product_name ?? ""),
    affiliate_url: String(data.affiliate_url ?? ""),
    price: price != null && !Number.isNaN(price) ? price : null,
    display_price:
      typeof data.display_price === "string"
        ? data.display_price
        : formatDisplayPrice(price != null && !Number.isNaN(price) ? price : null),
    thumbnail_url:
      typeof data.thumbnail_url === "string" ? data.thumbnail_url : null,
    thumbnail_path:
      typeof data.thumbnail_path === "string" ? data.thumbnail_path : null,
    created_at:
      typeof data.created_at === "string" ? data.created_at : undefined,
    updated_at:
      typeof data.updated_at === "string" ? data.updated_at : undefined,
  };
}

function getAffiliateCollectionRef() {
  return collection(db, "affiliate_items") as CollectionReference<DocumentData>;
}

async function getAffiliateLibraryItemById(
  id: string,
  cache: Map<string, AffiliateLibraryItem | null>,
) {
  if (cache.has(id)) {
    return cache.get(id) ?? null;
  }

  const snapshot = await getDoc(firestoreDoc(db, "affiliate_items", id));

  if (!snapshot.exists()) {
    cache.set(id, null);
    return null;
  }

  const item = normalizeAffiliateLibraryItem(
    snapshot.id,
    snapshot.data() as Record<string, unknown>,
  );

  cache.set(id, item);

  return item;
}

async function hydrateAffiliateItems(
  items: unknown,
  cache: Map<string, AffiliateLibraryItem | null>,
): Promise<AffiliateItem[]> {
  if (!Array.isArray(items)) {
    return [];
  }

  const normalizedReferences = items
    .map((item, index) => {
      const record = item as Record<string, unknown>;
      const libraryItemId =
        typeof record.library_item_id === "string"
          ? record.library_item_id
          : null;
      const sortOrder =
        typeof record.sort_order === "number"
          ? record.sort_order
          : Number(record.sort_order ?? index + 1) || index + 1;

      if (!libraryItemId) {
        return null;
      }

      return {
        library_item_id: libraryItemId,
        sort_order: sortOrder,
      };
    })
    .filter(
      (
        item,
      ): item is {
        library_item_id: string;
        sort_order: number;
      } => item !== null,
    )
    .sort((left, right) => left.sort_order - right.sort_order);

  const hydratedItems = await Promise.all(
    normalizedReferences.map(async (reference, index) => {
      const libraryItem = await getAffiliateLibraryItemById(
        reference.library_item_id,
        cache,
      );

      if (!libraryItem) {
        return null;
      }

      return {
        id: `${reference.library_item_id}_${index + 1}`,
        library_item_id: reference.library_item_id,
        product_name: libraryItem.product_name,
        affiliate_url: libraryItem.affiliate_url,
        price: libraryItem.price,
        display_price: libraryItem.display_price,
        thumbnail_url: libraryItem.thumbnail_url,
        thumbnail_path: libraryItem.thumbnail_path,
        sort_order: reference.sort_order,
      } satisfies AffiliateItem;
    }),
  );

  return hydratedItems.filter((item): item is AffiliateItem => item !== null);
}

async function hydrateOutfitDocument(
  id: string,
  data: Record<string, unknown>,
  affiliateCache: Map<string, AffiliateLibraryItem | null>,
): Promise<Outfit> {
  return {
    id,
    ...data,
    formatted_code: formatOutfitCode(String(data.code ?? "")),
    affiliate_items: await hydrateAffiliateItems(data.affiliate_items, affiliateCache),
  } as Outfit;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

/**
 * PUBLIC: Fetches featured outfits from Firestore
 */
export async function fetchFeaturedOutfits(): Promise<FeaturedOutfitsResponse> {
  try {
    const outfitsRef = collection(db, "outfits");
    const q = query(outfitsRef, where("is_featured", "==", true), limit(10));
    const querySnapshot = await getDocs(q);
    const affiliateCache = new Map<string, AffiliateLibraryItem | null>();

    const outfits: Outfit[] = await Promise.all(
      querySnapshot.docs.map((d) =>
        hydrateOutfitDocument(
          d.id,
          d.data() as Record<string, unknown>,
          affiliateCache,
        ),
      ),
    );

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
      const affiliateCache = new Map<string, AffiliateLibraryItem | null>();

      // Fetch outfits for this collection
      const outfitsRef = collection(db, "outfits");
      const outfitsQuery = query(outfitsRef, where("collection_id", "==", collectionDoc.id));
      const outfitsSnap = await getDocs(outfitsQuery);

      const outfits: Outfit[] = await Promise.all(
        outfitsSnap.docs.map((d) =>
          hydrateOutfitDocument(
            d.id,
            d.data() as Record<string, unknown>,
            affiliateCache,
          ),
        ),
      );

      return {
        message: "Collection found",
        type: "collection",
        data: {
          id: collectionDoc.id,
          ...collectionData,
          formatted_code: formatOutfitCode(String(collectionData.code ?? "")),
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
          data: await hydrateOutfitDocument(
            outfitDoc.id,
            outfitData as Record<string, unknown>,
            new Map<string, AffiliateLibraryItem | null>(),
          ),
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
    const affiliateCache = new Map<string, AffiliateLibraryItem | null>();

    if (search?.trim()) {
      q = query(q, where("code", "==", search.trim()));
    }

    const snap = await getDocs(q);

    // Parallel fetch for sub-outfits is more efficient
    const collectionPromises = snap.docs.map(async (d) => {
      const data = d.data() as Record<string, unknown>;
      const outfitsQuery = query(
        collection(db, "outfits"),
        where("collection_id", "==", d.id),
      );
      const outfitsSnap = await getDocs(outfitsQuery);
      const outfits = await Promise.all(
        outfitsSnap.docs.map((od) =>
          hydrateOutfitDocument(
            od.id,
            od.data() as Record<string, unknown>,
            affiliateCache,
          ),
        ),
      );

      return {
        id: d.id,
        ...data,
        formatted_code: formatOutfitCode(String(data.code ?? "")),
        outfits,
      } as unknown as OutfitCollection;
    });

    const results = await Promise.all(collectionPromises);
    return { data: results };
  } catch (error: unknown) {
    console.error("Error fetching admin collections:", error);
    throw new FirebaseError(getErrorMessage(error, "Failed to fetch collections."), 500);
  }
}

/**
 * ADMIN: Create collection
 */
export async function createAdminCollection(payload: AdminUpsertCollectionPayload) {
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
  } catch (error: unknown) {
    console.error("Error creating collection:", error);
    throw new FirebaseError(getErrorMessage(error, "Failed to create collection."), 500);
  }
}

/**
 * ADMIN: Update collection
 */
export async function updateAdminCollection(
  id: string,
  payload: Partial<AdminUpsertCollectionPayload>,
) {
  try {
    if (payload.code) {
      const isUnique = await checkCodeUniqueness(payload.code, id);
      if (!isUnique) {
        throw new Error(`The code "${payload.code}" is already in use.`);
      }
    }

    await updateDoc(firestoreDoc(db, "collections", id), {
      ...payload,
      updated_at: new Date().toISOString(),
    });
    return { message: "Collection updated successfully." };
  } catch (error: unknown) {
    console.error("Error updating collection:", error);
    throw new FirebaseError(getErrorMessage(error, "Failed to update collection."), 500);
  }
}

/**
 * ADMIN: Delete collection
 */
export async function deleteAdminCollection(id: string) {
  try {
    await deleteDoc(firestoreDoc(db, "collections", id));
    return { message: "Collection deleted successfully." };
  } catch (error: unknown) {
    console.error("Error deleting collection:", error);
    throw new FirebaseError(getErrorMessage(error, "Failed to delete collection."), 500);
  }
}

/**
 * ADMIN: Create outfit
 */
export async function createAdminOutfit(
  collectionId: string,
  payload: AdminUpsertOutfitPayload,
) {
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
  } catch (error: unknown) {
    console.error("Error creating outfit:", error);
    throw new FirebaseError(getErrorMessage(error, "Failed to create outfit."), 500);
  }
}


/**
 * ADMIN: Update outfit
 */
export async function updateAdminOutfit(
  id: string,
  payload: Partial<AdminUpsertOutfitPayload>,
) {
  try {
    if (payload.code) {
      const isUnique = await checkCodeUniqueness(payload.code, id);
      if (!isUnique) {
        throw new Error(`The code "${payload.code}" is already in use.`);
      }
    }

    await updateDoc(firestoreDoc(db, "outfits", id), {
      ...payload,
      updated_at: new Date().toISOString(),
    });
    return { message: "Outfit updated successfully." };
  } catch (error: unknown) {
    console.error("Error updating outfit:", error);
    throw new FirebaseError(getErrorMessage(error, "Failed to update outfit."), 500);
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
    }

    // 3. Finally delete the Firestore document
    await deleteDoc(firestoreDoc(db, "outfits", id));
    return { message: "Outfit and associated images deleted successfully." };
  } catch (error: unknown) {
    console.error("Error deleting outfit:", error);
    throw new FirebaseError(getErrorMessage(error, "Failed to delete outfit."), 500);
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    console.error("Error uploading image:", error);
    throw new FirebaseError(getErrorMessage(error, "Failed to upload image."), 500);
  }
}

/**
 * ADMIN: Fetch reusable affiliate items
 */
export async function fetchAdminAffiliateItems(
  search?: string,
  maxItems = 200,
): Promise<AffiliateLibraryListResponse> {
  try {
    const snap = await getDocs(query(getAffiliateCollectionRef(), limit(maxItems)));
    const searchTerm = search?.trim().toLowerCase() ?? "";

    const items = snap.docs
      .map((d) =>
        normalizeAffiliateLibraryItem(
          d.id,
          d.data() as Record<string, unknown>,
        ),
      )
      .filter((item) => {
        if (!searchTerm) {
          return true;
        }

        return (
          item.product_name.toLowerCase().includes(searchTerm) ||
          item.affiliate_url.toLowerCase().includes(searchTerm)
        );
      })
      .sort((left, right) => {
        const leftUpdated = left.updated_at ?? left.created_at ?? "";
        const rightUpdated = right.updated_at ?? right.created_at ?? "";

        return rightUpdated.localeCompare(leftUpdated) || left.product_name.localeCompare(right.product_name);
      });

    return { data: items };
  } catch (error: unknown) {
    console.error("Error fetching affiliate items:", error);
    throw new FirebaseError(
      getErrorMessage(error, "Failed to fetch affiliate items."),
      500,
    );
  }
}

/**
 * ADMIN: Create reusable affiliate item
 */
export async function createAdminAffiliateItem(
  payload: AdminUpsertAffiliateLibraryItemPayload,
) {
  try {
    await addDoc(getAffiliateCollectionRef(), {
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return { message: "Affiliate item created successfully." };
  } catch (error: unknown) {
    console.error("Error creating affiliate item:", error);
    throw new FirebaseError(
      getErrorMessage(error, "Failed to create affiliate item."),
      500,
    );
  }
}

/**
 * ADMIN: Update reusable affiliate item
 */
export async function updateAdminAffiliateItem(
  id: string,
  payload: AdminUpsertAffiliateLibraryItemPayload,
) {
  try {
    await updateDoc(firestoreDoc(db, "affiliate_items", id), {
      ...payload,
      updated_at: new Date().toISOString(),
    });

    return { message: "Affiliate item updated successfully." };
  } catch (error: unknown) {
    console.error("Error updating affiliate item:", error);
    throw new FirebaseError(
      getErrorMessage(error, "Failed to update affiliate item."),
      500,
    );
  }
}

/**
 * ADMIN: Delete reusable affiliate item
 */
export async function deleteAdminAffiliateItem(id: string) {
  try {
    await deleteDoc(firestoreDoc(db, "affiliate_items", id));
    return { message: "Affiliate item deleted successfully." };
  } catch (error: unknown) {
    console.error("Error deleting affiliate item:", error);
    throw new FirebaseError(
      getErrorMessage(error, "Failed to delete affiliate item."),
      500,
    );
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

/**
 * ADMIN: Fetch all outfits across all collections
 */
export async function fetchAllAdminOutfits(search?: string) {
  try {
    const outfitsRef = collection(db, "outfits");
    const affiliateCache = new Map<string, AffiliateLibraryItem | null>();

    if (search?.trim()) {
      const cleanTerm = normalizeOutfitCode(search.trim());
      const hashTerm = `#${cleanTerm}`;

      // Firestore range queries are sensitive to exact prefixes. 
      // We query both the raw term and the prefixed term in parallel.
      const q1 = query(
        outfitsRef,
        where("code", ">=", cleanTerm),
        where("code", "<=", cleanTerm + "\uf8ff"),
        limit(40)
      );

      const q2 = query(
        outfitsRef,
        where("code", ">=", hashTerm),
        where("code", "<=", hashTerm + "\uf8ff"),
        limit(40)
      );

      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      // Merge and deduplicate results by document ID
      const allDocs = [...snap1.docs, ...snap2.docs];
      const uniqueDocs = allDocs.filter((doc, index, self) => 
        index === self.findIndex((d) => d.id === doc.id)
      );

      const outfits: Outfit[] = await Promise.all(
        uniqueDocs.map((d) =>
          hydrateOutfitDocument(
            d.id,
            d.data() as Record<string, unknown>,
            affiliateCache,
          ),
        ),
      );

      // Sort alphabetically and Apply final limit
      outfits.sort((a, b) => a.code.localeCompare(b.code));

      return { data: outfits.slice(0, 50) };
    } else {
      const q = query(outfitsRef, limit(100));
      const snap = await getDocs(q);
      const outfits: Outfit[] = await Promise.all(
        snap.docs.map((d) =>
          hydrateOutfitDocument(
            d.id,
            d.data() as Record<string, unknown>,
            affiliateCache,
          ),
        ),
      );
      return { data: outfits };
    }
  } catch (error: unknown) {
    console.error("Error fetching all outfits:", error);
    throw new FirebaseError(getErrorMessage(error, "Failed to fetch outfits."), 500);
  }
}
