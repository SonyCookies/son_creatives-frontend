"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  createAdminAffiliateItem,
  deleteAdminImage,
  deleteAdminAffiliateItem,
  fetchAdminAffiliateItems,
  FirebaseError as ApiError,
  updateAdminAffiliateItem,
  uploadAdminImage,
} from "@/lib/firebase-service";
import type {
  AdminUpsertAffiliateLibraryItemPayload,
  AffiliateLibraryItem,
} from "@/types/outfit";

type AffiliateItemFormState = {
  product_name: string;
  affiliate_url: string;
  price: string;
  thumbnail_url: string;
  thumbnail_path: string;
  thumbnail_file: File | null;
  thumbnail_preview: string;
};

const emptyFormState: AffiliateItemFormState = {
  product_name: "",
  affiliate_url: "",
  price: "",
  thumbnail_url: "",
  thumbnail_path: "",
  thumbnail_file: null,
  thumbnail_preview: "",
};

const DEFAULT_LIBRARY_FETCH_LIMIT = 5;
const SEARCH_LIBRARY_FETCH_LIMIT = 50;

function createFormState(item: AffiliateLibraryItem | null): AffiliateItemFormState {
  if (!item) {
    return emptyFormState;
  }

  return {
    product_name: item.product_name ?? "",
    affiliate_url: item.affiliate_url ?? "",
    price: item.price != null ? String(item.price) : "",
    thumbnail_url: item.thumbnail_url ?? "",
    thumbnail_path: item.thumbnail_path ?? "",
    thumbnail_file: null,
    thumbnail_preview: item.thumbnail_url ?? "",
  };
}

export function AdminAffiliateItemsManager() {
  const [items, setItems] = useState<AffiliateLibraryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [form, setForm] = useState<AffiliateItemFormState>(emptyFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedItem =
    items.find((item) => String(item.id) === selectedItemId) ?? null;

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      setIsLoading(true);
      setError(null);

      try {
        const payload = await fetchAdminAffiliateItems(
          undefined,
          DEFAULT_LIBRARY_FETCH_LIMIT,
        );

        if (!isMounted) {
          return;
        }

        const firstItem = payload.data[0] ?? null;
        setItems(payload.data);
        setSelectedItemId(firstItem?.id ?? null);
        setForm(createFormState(firstItem));
      } catch (loadError) {
        if (isMounted) {
          setError(resolveErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  async function loadItems(options?: {
    search?: string;
    nextItemId?: string | null;
  }) {
    setIsLoading(true);
    setError(null);

    try {
      const activeSearch = options?.search ?? appliedSearch;
      const payload = await fetchAdminAffiliateItems(
        activeSearch,
        activeSearch?.trim()
          ? SEARCH_LIBRARY_FETCH_LIMIT
          : DEFAULT_LIBRARY_FETCH_LIMIT,
      );
      const requestedId = options?.nextItemId ?? selectedItemId;
      const activeItem =
        payload.data.find((item) => item.id === requestedId) ??
        payload.data[0] ??
        null;

      setAppliedSearch(activeSearch);
      setItems(payload.data);
      setSelectedItemId(activeItem?.id ?? null);
      setForm(createFormState(activeItem));
    } catch (loadError) {
      setError(resolveErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch() {
    setMessage(null);
    await loadItems({
      search: search,
      nextItemId: null,
    });
  }

  async function handleSubmit() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    let thumbnailUrl = form.thumbnail_url;
    let thumbnailPath = form.thumbnail_path;
    const previousThumbnailPath = selectedItem?.thumbnail_path ?? null;

    try {
      if (form.thumbnail_file) {
        const uploadedImage = await uploadAdminImage(form.thumbnail_file, "affiliate");
        thumbnailUrl = uploadedImage.data.url;
        thumbnailPath = uploadedImage.data.path;
      }

      const payload: AdminUpsertAffiliateLibraryItemPayload = {
        product_name: form.product_name,
        affiliate_url: form.affiliate_url,
        price: form.price ? Number(form.price) : null,
        thumbnail_url: thumbnailUrl || null,
        thumbnail_path: thumbnailPath || null,
      };

      if (selectedItem) {
        await updateAdminAffiliateItem(selectedItem.id, payload);

        if (
          form.thumbnail_file &&
          previousThumbnailPath &&
          previousThumbnailPath !== thumbnailPath
        ) {
          await deleteAdminImage(previousThumbnailPath).catch(console.error);
        }

        setMessage("Affiliate item updated.");
        await loadItems({
          search: appliedSearch,
          nextItemId: selectedItem.id,
        });
      } else {
        await createAdminAffiliateItem(payload);
        setMessage("Affiliate item created.");
        setSearch("");
        await loadItems({
          search: "",
          nextItemId: null,
        });
      }
    } catch (saveError) {
      setError(resolveErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedItem) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      await deleteAdminAffiliateItem(selectedItem.id);

      if (selectedItem.thumbnail_path) {
        await deleteAdminImage(selectedItem.thumbnail_path).catch(console.error);
      }

      setMessage("Affiliate item deleted.");
      setSelectedItemId(null);
      await loadItems({
        search: appliedSearch,
        nextItemId: null,
      });
    } catch (deleteError) {
      setError(resolveErrorMessage(deleteError));
    } finally {
      setIsSaving(false);
    }
  }

  function handleImageChange(file: File | null) {
    if (!file) {
      return;
    }

    setForm((current) => ({
      ...current,
      thumbnail_file: file,
      thumbnail_preview: URL.createObjectURL(file),
    }));
  }

  return (
    <section className="grid items-start gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="surface-panel rounded-[28px] p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
            Library
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedItemId(null);
              setForm(emptyFormState);
              setMessage(null);
              setError(null);
            }}
            className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
          >
            New
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSearch();
          }}
          className="mb-4 flex gap-2"
        >
          <input
            type="text"
            placeholder="Search affiliate item"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none"
          />
          <button
            type="submit"
            className="rounded-2xl border border-black px-4 py-3 text-sm font-semibold"
          >
            Search
          </button>
        </form>

        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-[var(--muted)]">Loading...</p>
          ) : null}

          {!isLoading && !appliedSearch.trim() && items.length > 0 ? (
            <p className="text-xs text-[var(--muted)]">
              Showing the latest 5 items. Use search to find older ones.
            </p>
          ) : null}

          {!isLoading && items.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {appliedSearch.trim()
                ? "No matching affiliate items."
                : "No affiliate items yet."}
            </p>
          ) : null}

          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedItemId(item.id);
                setForm(createFormState(item));
              }}
              className={`group flex w-full items-center gap-3 rounded-[22px] border px-4 py-4 text-left transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] ${
                selectedItemId === item.id
                  ? "border-black bg-black text-white shadow-xl shadow-black/10"
                  : "border-[var(--border-soft)] bg-white text-[var(--foreground)] hover:border-black/20"
              }`}
            >
              <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-[var(--surface-muted)]">
                {item.thumbnail_url ? (
                  <Image
                    src={item.thumbnail_url}
                    alt={item.product_name}
                    fill
                    unoptimized
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    No Img
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.product_name}</p>
                <p className="mt-1 truncate text-xs opacity-75">
                  {item.display_price ?? "No price"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="surface-panel rounded-[28px] p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
            Affiliate Item
          </p>
          {selectedItem ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSaving}
              className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              Delete
            </button>
          ) : null}
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Product name"
            value={form.product_name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                product_name: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none"
          />

          <input
            type="url"
            placeholder="Affiliate URL"
            value={form.affiliate_url}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                affiliate_url: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none"
          />

          <input
            type="text"
            placeholder="Price"
            value={form.price}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                price: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none"
          />

          <div className="rounded-[24px] border border-[var(--border-soft)] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              Thumbnail
            </p>
            {form.thumbnail_preview ? (
              <div className="relative mt-4 aspect-[4/5] w-full overflow-hidden rounded-[18px] bg-[var(--surface-muted)]">
                <Image
                  src={form.thumbnail_preview}
                  alt="Affiliate item preview"
                  fill
                  unoptimized
                  sizes="(min-width: 1280px) 34vw, 100vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="mt-4 flex aspect-[4/5] w-full items-center justify-center rounded-[18px] bg-[var(--surface-muted)] text-sm text-[var(--muted)]">
                No image selected
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)}
              className="mt-4 block w-full text-sm"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
          >
            {isSaving
              ? "Saving..."
              : selectedItem
                ? "Save affiliate item"
                : "Create affiliate item"}
          </button>
        </div>

        {message ? (
          <p className="mt-5 text-sm font-medium text-[var(--foreground)]">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{error}</p>
        ) : null}
      </div>
    </section>
  );
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const firstValidationError = error.errors
      ? Object.values(error.errors).flat()[0]
      : null;

    return firstValidationError ?? error.message;
  }

  return "Something went wrong.";
}
