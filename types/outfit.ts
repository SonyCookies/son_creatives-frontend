export type AffiliateItem = {
  id: number;
  product_name: string;
  affiliate_url: string;
  price: number | null;
  display_price: string | null;
  thumbnail_url: string | null;
  sort_order: number;
};

export type OutfitCollectionSummary = {
  id: number;
  code: string;
  formatted_code: string;
  title: string;
  description: string | null;
};

export type Outfit = {
  id: number;
  code: string;
  formatted_code: string;
  collection_id: number | null;
  title: string;
  image_url: string;
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
  thumbnail_url?: string;
  sort_order?: number;
};

export type AdminUpsertOutfitPayload = {
  code: string;
  title: string;
  image_url: string;
  description?: string;
  is_featured: boolean;
  outfit_collection_id?: number;
  affiliate_items: AdminUpsertAffiliateItemPayload[];
};
