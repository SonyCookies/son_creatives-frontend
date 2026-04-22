export type AffiliateItem = {
  id: string;
  product_name: string;
  affiliate_url: string;
  price: number | null;
  display_price: string | null;
  thumbnail_url: string | null;
  thumbnail_path: string | null;
  sort_order: number;
};

export type OutfitCollectionSummary = {
  id: string;
  code: string;
  formatted_code: string;
  title: string;
  description: string | null;
};

export type Outfit = {
  id: string;
  code: string;
  formatted_code: string;
  collection_id: string | null;
  title: string;
  image_url: string;
  image_path: string | null;
  description: string | null;
  is_featured: boolean;
  collection?: OutfitCollectionSummary | null;
  affiliate_items: AffiliateItem[];
  created_at: string;
  updated_at: string;
};

export type OutfitCollection = OutfitCollectionSummary & {
  outfits: Outfit[];
  outfit_count?: number;
  created_at: string;
  updated_at: string;
};

export type OutfitLookupResponse = {
  message: string;
  data: Outfit;
};

export type CodeLookupResponse =
  | {
      message: string;
      type: "outfit";
      data: Outfit;
    }
  | {
      message: string;
      type: "collection";
      data: OutfitCollection;
    };

export type CollectionListResponse = {
  data: OutfitCollection[];
};

export type FeaturedOutfitsResponse = {
  data: Outfit[];
};

export type UploadResponse = {
  message: string;
  data: {
    path: string;
    url: string;
  };
};

export type ApiErrorResponse = {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
};

export type AdminUpsertCollectionPayload = {
  code: string;
  title: string;
  description?: string;
};

export type AdminUpsertAffiliateItemPayload = {
  product_name: string;
  affiliate_url: string;
  price?: number | null;
  thumbnail_url?: string | null;
  thumbnail_path?: string | null;
  sort_order?: number;
};

export type AdminUpsertOutfitPayload = {
  code: string;
  title: string;
  image_url: string;
  image_path: string | null;
  description?: string | null;
  is_featured: boolean;
  outfit_collection_id?: string;
  affiliate_items: AdminUpsertAffiliateItemPayload[];
};
