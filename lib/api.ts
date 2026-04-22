import { isValidOutfitCode, normalizeOutfitCode } from "@/lib/outfit-code";
import type {
  AdminUpsertCollectionPayload,
  AdminUpsertOutfitPayload,
  ApiErrorResponse,
  CodeLookupResponse,
  CollectionListResponse,
  FeaturedOutfitsResponse,
  OutfitLookupResponse,
  UploadResponse,
} from "@/types/outfit";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    DEFAULT_API_BASE_URL
  );
}

export class ApiError extends Error {
  status: number;
  code?: string;
  errors?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    options?: { code?: string; errors?: Record<string, string[]> },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options?.code;
    this.errors = options?.errors;
  }
}

export class OutfitLookupError extends ApiError {
  constructor(
    message: string,
    status: number,
    options?: { code?: string; errors?: Record<string, string[]> },
  ) {
    super(message, status, options);
    this.name = "OutfitLookupError";
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
    ...init,
  });

  const payload = (await response
    .json()
    .catch(() => null)) as ApiErrorResponse | T | null;

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object" && "message" in payload
        ? (payload as ApiErrorResponse)
        : null;

    throw new ApiError(errorPayload?.message ?? "Request failed.", response.status, {
      code: errorPayload?.code,
      errors: errorPayload?.errors,
    });
  }

  return payload as T;
}

export async function fetchOutfitByCode(
  inputCode: string,
): Promise<OutfitLookupResponse> {
  const normalizedCode = normalizeOutfitCode(inputCode);

  if (!normalizedCode || !isValidOutfitCode(normalizedCode)) {
    throw new OutfitLookupError(
      "Please enter a valid outfit code like AAA111.",
      422,
    );
  }

  try {
    return await requestJson<OutfitLookupResponse>(
      `/api/outfits/${encodeURIComponent(normalizedCode)}`,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw new OutfitLookupError(error.message, error.status, {
        code: error.code,
        errors: error.errors,
      });
    }

    throw error;
  }
}

export async function fetchCodeLookup(
  inputCode: string,
): Promise<CodeLookupResponse> {
  const normalizedCode = normalizeOutfitCode(inputCode);

  if (!normalizedCode || !isValidOutfitCode(normalizedCode)) {
    throw new OutfitLookupError(
      "Please enter a valid code like AAA111 or 000000.",
      422,
    );
  }

  try {
    return await requestJson<CodeLookupResponse>(
      `/api/lookups/${encodeURIComponent(normalizedCode)}`,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw new OutfitLookupError(error.message, error.status, {
        code: error.code,
        errors: error.errors,
      });
    }

    throw error;
  }
}

export function fetchFeaturedOutfits() {
  return requestJson<FeaturedOutfitsResponse>("/api/featured-outfits");
}

export function fetchAdminCollections(search?: string) {
  const query = search?.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : "";

  return requestJson<CollectionListResponse>(`/api/admin/collections${query}`);
}

export function createAdminCollection(payload: AdminUpsertCollectionPayload) {
  return requestJson<{ message: string }>("/api/admin/collections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminCollection(
  collectionId: number,
  payload: AdminUpsertCollectionPayload,
) {
  return requestJson<{ message: string }>(`/api/admin/collections/${collectionId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminCollection(collectionId: number) {
  return requestJson<{ message: string }>(`/api/admin/collections/${collectionId}`, {
    method: "DELETE",
  });
}

export function createAdminOutfit(
  collectionId: number,
  payload: AdminUpsertOutfitPayload,
) {
  return requestJson<{ message: string }>(
    `/api/admin/collections/${collectionId}/outfits`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateAdminOutfit(outfitId: number, payload: AdminUpsertOutfitPayload) {
  return requestJson<{ message: string }>(`/api/admin/outfits/${outfitId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminOutfit(outfitId: number) {
  return requestJson<{ message: string }>(`/api/admin/outfits/${outfitId}`, {
    method: "DELETE",
  });
}

export async function uploadAdminImage(file: File, type: "outfit" | "affiliate") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const response = await fetch(`${getApiBaseUrl()}/api/admin/uploads`, {
    method: "POST",
    body: formData,
    headers: {
      Accept: "application/json",
    },
  });

  const payload = (await response
    .json()
    .catch(() => null)) as UploadResponse | ApiErrorResponse | null;

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object" && "message" in payload
        ? (payload as ApiErrorResponse)
        : null;

    throw new ApiError(errorPayload?.message ?? "Upload failed.", response.status, {
      code: errorPayload?.code,
      errors: errorPayload?.errors,
    });
  }

  return payload as UploadResponse;
}
