"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  createAdminCollection,
  createAdminOutfit,
  deleteAdminCollection,
  deleteAdminOutfit,
  fetchAdminCollections,
  uploadAdminImage,
  updateAdminCollection,
  updateAdminOutfit,
  ApiError,
} from "@/lib/api";
import type {
  AdminUpsertCollectionPayload,
  AdminUpsertOutfitPayload,
  OutfitCollection,
} from "@/types/outfit";

type CollectionFormState = {
  code: string;
  title: string;
  description: string;
};

type AffiliateItemFormState = {
  product_name: string;
  affiliate_url: string;
  price: string;
  thumbnail_url: string;
  thumbnail_file: File | null;
  thumbnail_preview: string;
};

type OutfitFormState = {
  code: string;
  title: string;
  image_url: string;
  image_file: File | null;
  image_preview: string;
  description: string;
  is_featured: boolean;
  affiliate_items: AffiliateItemFormState[];
};

const emptyAffiliateItem = (): AffiliateItemFormState => ({
  product_name: "",
  affiliate_url: "",
  price: "",
  thumbnail_url: "",
  thumbnail_file: null,
  thumbnail_preview: "",
});

const emptyCollectionForm: CollectionFormState = {
  code: "",
  title: "",
  description: "",
};

const emptyOutfitForm = (): OutfitFormState => ({
  code: "",
  title: "",
  image_url: "",
  image_file: null,
  image_preview: "",
  description: "",
  is_featured: false,
  affiliate_items: [emptyAffiliateItem()],
});

function createCollectionFormState(collection: OutfitCollection | null): CollectionFormState {
  if (!collection) {
    return emptyCollectionForm;
  }

  return {
    code: collection.formatted_code,
    title: collection.title,
    description: collection.description ?? "",
  };
}

function createOutfitFormState(
  outfit: OutfitCollection["outfits"][number] | null,
): OutfitFormState {
  if (!outfit) {
    return emptyOutfitForm();
  }

  return {
    code: outfit.formatted_code,
    title: outfit.title,
    image_url: outfit.image_url,
    image_file: null,
    image_preview: outfit.image_url,
    description: outfit.description ?? "",
    is_featured: outfit.is_featured,
    affiliate_items:
      outfit.affiliate_items.length > 0
        ? outfit.affiliate_items.map((item) => ({
            product_name: item.product_name,
            affiliate_url: item.affiliate_url,
            price: item.price !== null ? String(item.price) : "",
            thumbnail_url: item.thumbnail_url ?? "",
            thumbnail_file: null,
            thumbnail_preview: item.thumbnail_url ?? "",
          }))
        : [emptyAffiliateItem()],
  };
}

const affiliateUrlPattern = /(https?:\/\/\S+)/i;

function parseAffiliatePaste(value: string) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();
  const urlMatch = normalizedValue.match(affiliateUrlPattern);

  if (!urlMatch) {
    return null;
  }

  const affiliateUrl = urlMatch[0].replace(/[),.;]+$/, "");
  const productName = normalizedValue.replace(urlMatch[0], "").trim();

  if (!productName) {
    return null;
  }

  return {
    product_name: productName,
    affiliate_url: affiliateUrl,
  };
}

export function AdminDashboard() {
  const [collections, setCollections] = useState<OutfitCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [selectedOutfitId, setSelectedOutfitId] = useState<number | null>(null);
  const [collectionSearch, setCollectionSearch] = useState("");
  const [appliedCollectionSearch, setAppliedCollectionSearch] = useState("");
  const [collectionForm, setCollectionForm] = useState<CollectionFormState>(emptyCollectionForm);
  const [outfitForm, setOutfitForm] = useState<OutfitFormState>(emptyOutfitForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [isSavingOutfit, setIsSavingOutfit] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCollection =
    collections.find((collection) => collection.id === selectedCollectionId) ?? null;
  const selectedOutfit =
    selectedCollection?.outfits.find((outfit) => outfit.id === selectedOutfitId) ?? null;

  function syncCollectionState(
    nextCollections: OutfitCollection[],
    nextCollectionId?: number | null,
    nextOutfitId?: number | null,
  ) {
    const requestedCollectionId = nextCollectionId ?? selectedCollectionId;
    const activeCollection =
      nextCollections.find((collection) => collection.id === requestedCollectionId) ??
      nextCollections[0] ??
      null;

    const requestedOutfitId = nextOutfitId ?? selectedOutfitId;
    const activeOutfit =
      activeCollection?.outfits.find((outfit) => outfit.id === requestedOutfitId) ??
      activeCollection?.outfits[0] ??
      null;

    setCollections(nextCollections);
    setSelectedCollectionId(activeCollection?.id ?? null);
    setSelectedOutfitId(activeOutfit?.id ?? null);
    setCollectionForm(createCollectionFormState(activeCollection));
    setOutfitForm(createOutfitFormState(activeOutfit));
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const payload = await fetchAdminCollections();

        if (!isMounted) {
          return;
        }

        const firstCollection = payload.data[0] ?? null;
        const firstOutfit = firstCollection?.outfits[0] ?? null;

        setCollections(payload.data);
        setSelectedCollectionId(firstCollection?.id ?? null);
        setSelectedOutfitId(firstOutfit?.id ?? null);
        setCollectionForm(createCollectionFormState(firstCollection));
        setOutfitForm(createOutfitFormState(firstOutfit));
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

  async function loadCollections(options?: {
    search?: string;
    nextCollectionId?: number | null;
    nextOutfitId?: number | null;
  }) {
    setIsLoading(true);
    setError(null);

    try {
      const activeSearch = options?.search ?? appliedCollectionSearch;
      const payload = await fetchAdminCollections(activeSearch);

      setAppliedCollectionSearch(activeSearch);
      syncCollectionState(
        payload.data,
        options?.nextCollectionId,
        options?.nextOutfitId,
      );
    } catch (loadError) {
      setError(resolveErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCollectionSearch() {
    setMessage(null);
    await loadCollections({
      search: collectionSearch,
      nextCollectionId: null,
      nextOutfitId: null,
    });
  }

  async function handleCollectionSubmit() {
    setIsSavingCollection(true);
    setError(null);
    setMessage(null);

    const payload: AdminUpsertCollectionPayload = {
      code: collectionForm.code,
      title: collectionForm.title,
      description: collectionForm.description,
    };

    try {
      if (selectedCollection) {
        await updateAdminCollection(selectedCollection.id, payload);
        setMessage("Collection updated.");
        await loadCollections({
          search: appliedCollectionSearch,
          nextCollectionId: selectedCollection.id,
          nextOutfitId: selectedOutfitId,
        });
      } else {
        await createAdminCollection(payload);
        setMessage("Collection created.");
        setCollectionSearch("");
        await loadCollections({
          search: "",
          nextCollectionId: null,
          nextOutfitId: null,
        });
      }
    } catch (saveError) {
      setError(resolveErrorMessage(saveError));
    } finally {
      setIsSavingCollection(false);
    }
  }

  async function handleCollectionDelete() {
    if (!selectedCollection) {
      return;
    }

    setIsSavingCollection(true);
    setError(null);
    setMessage(null);

    try {
      await deleteAdminCollection(selectedCollection.id);
      setMessage("Collection deleted.");
      setSelectedCollectionId(null);
      setSelectedOutfitId(null);
      await loadCollections({
        search: appliedCollectionSearch,
        nextCollectionId: null,
        nextOutfitId: null,
      });
    } catch (deleteError) {
      setError(resolveErrorMessage(deleteError));
    } finally {
      setIsSavingCollection(false);
    }
  }

  async function handleOutfitSubmit() {
    if (!selectedCollection) {
      setError("Create or select a collection first.");
      return;
    }

    setIsSavingOutfit(true);
    setError(null);
    setMessage(null);

    try {
      let outfitImageUrl = outfitForm.image_url;

      if (outfitForm.image_file) {
        const uploadedImage = await uploadAdminImage(outfitForm.image_file, "outfit");
        outfitImageUrl = uploadedImage.data.url;
      }

      if (!outfitImageUrl) {
        setError("Please upload an outfit image.");
        setIsSavingOutfit(false);
        return;
      }

      const affiliateItems = await Promise.all(
        outfitForm.affiliate_items.map(async (item, index) => {
          let thumbnailUrl = item.thumbnail_url || undefined;

          if (item.thumbnail_file) {
            const uploadedThumbnail = await uploadAdminImage(
              item.thumbnail_file,
              "affiliate",
            );
            thumbnailUrl = uploadedThumbnail.data.url;
          }

          return {
            product_name: item.product_name,
            affiliate_url: item.affiliate_url,
            price: item.price ? Number(item.price) : null,
            thumbnail_url: thumbnailUrl,
            sort_order: index + 1,
          };
        }),
      );

      const payload: AdminUpsertOutfitPayload = {
        code: outfitForm.code,
        title: outfitForm.title,
        image_url: outfitImageUrl,
        description: outfitForm.description,
        is_featured: outfitForm.is_featured,
        outfit_collection_id: selectedCollection.id,
        affiliate_items: affiliateItems,
      };

      if (selectedOutfit) {
        await updateAdminOutfit(selectedOutfit.id, payload);
        setMessage("Outfit updated.");
        await loadCollections({
          search: appliedCollectionSearch,
          nextCollectionId: selectedCollection.id,
          nextOutfitId: selectedOutfit.id,
        });
      } else {
        await createAdminOutfit(selectedCollection.id, payload);
        setMessage("Outfit created.");
        await loadCollections({
          search: appliedCollectionSearch,
          nextCollectionId: selectedCollection.id,
          nextOutfitId: null,
        });
      }
    } catch (saveError) {
      setError(resolveErrorMessage(saveError));
    } finally {
      setIsSavingOutfit(false);
    }
  }

  async function handleOutfitDelete() {
    if (!selectedOutfit || !selectedCollection) {
      return;
    }

    setIsSavingOutfit(true);
    setError(null);
    setMessage(null);

    try {
      await deleteAdminOutfit(selectedOutfit.id);
      setMessage("Outfit deleted.");
      setSelectedOutfitId(null);
      await loadCollections({
        search: appliedCollectionSearch,
        nextCollectionId: selectedCollection.id,
        nextOutfitId: null,
      });
    } catch (deleteError) {
      setError(resolveErrorMessage(deleteError));
    } finally {
      setIsSavingOutfit(false);
    }
  }

  function addAffiliateItem() {
    setOutfitForm((current) => ({
      ...current,
      affiliate_items: [
        ...current.affiliate_items,
        emptyAffiliateItem(),
      ],
    }));
  }

  function updateAffiliateItem(
    index: number,
    key: keyof AffiliateItemFormState,
    value: string,
  ) {
    setOutfitForm((current) => ({
      ...current,
      affiliate_items: current.affiliate_items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
  }

  function removeAffiliateItem(index: number) {
    setOutfitForm((current) => ({
      ...current,
      affiliate_items:
        current.affiliate_items.length === 1
          ? [emptyAffiliateItem()]
          : current.affiliate_items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function handleOutfitImageChange(file: File | null) {
    if (!file) {
      return;
    }

    setOutfitForm((current) => ({
      ...current,
      image_file: file,
      image_preview: URL.createObjectURL(file),
    }));
  }

  function handleAffiliateImageChange(index: number, file: File | null) {
    if (!file) {
      return;
    }

    setOutfitForm((current) => ({
      ...current,
      affiliate_items: current.affiliate_items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              thumbnail_file: file,
              thumbnail_preview: URL.createObjectURL(file),
            }
          : item,
      ),
    }));
  }

  function handleAffiliateSmartPaste(index: number, value: string) {
    const parsed = parseAffiliatePaste(value);

    if (!parsed) {
      return false;
    }

    setOutfitForm((current) => ({
      ...current,
      affiliate_items: current.affiliate_items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              product_name: parsed.product_name,
              affiliate_url: parsed.affiliate_url,
            }
          : item,
      ),
    }));

    return true;
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="space-y-6">
        <div className="surface-panel rounded-[28px] p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
              Collections
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCollectionId(null);
                setSelectedOutfitId(null);
                setCollectionForm(emptyCollectionForm);
                setOutfitForm(emptyOutfitForm());
              }}
              className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              New
            </button>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleCollectionSearch();
            }}
            className="mb-4 flex gap-2"
          >
            <input
              type="text"
              placeholder="Search collection"
              value={collectionSearch}
              onChange={(event) => setCollectionSearch(event.target.value)}
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

            {!isLoading && collections.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                {appliedCollectionSearch.trim()
                  ? "No matching collections."
                  : "No collections yet."}
              </p>
            ) : null}

            {collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                onClick={() => {
                  const firstOutfit = collection.outfits[0] ?? null;
                  setSelectedCollectionId(collection.id);
                  setSelectedOutfitId(firstOutfit?.id ?? null);
                  setCollectionForm(createCollectionFormState(collection));
                  setOutfitForm(createOutfitFormState(firstOutfit));
                }}
                className={`w-full rounded-[22px] border px-4 py-4 text-left ${
                  selectedCollectionId === collection.id
                    ? "border-black bg-black text-white"
                    : "border-[var(--border-soft)] bg-white text-[var(--foreground)]"
                }`}
              >
                <p className="text-sm font-semibold">{collection.formatted_code}</p>
                <p className="mt-1 text-sm opacity-80">{collection.title}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="surface-panel rounded-[28px] p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
              Collection
            </p>
            {selectedCollection ? (
              <button
                type="button"
                onClick={handleCollectionDelete}
                disabled={isSavingCollection}
                className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
              >
                Delete
              </button>
            ) : null}
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="#000000"
              value={collectionForm.code}
              onChange={(event) =>
                setCollectionForm((current) => ({ ...current, code: event.target.value }))
              }
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none"
            />
            <input
              type="text"
              placeholder="Collection title"
              value={collectionForm.title}
              onChange={(event) =>
                setCollectionForm((current) => ({ ...current, title: event.target.value }))
              }
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none"
            />
            <textarea
              placeholder="Description"
              value={collectionForm.description}
              onChange={(event) =>
                setCollectionForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              className="min-h-24 w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={handleCollectionSubmit}
              disabled={isSavingCollection}
              className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
            >
              {isSavingCollection
                ? "Saving..."
                : selectedCollection
                  ? "Save collection"
                  : "Create collection"}
            </button>
          </div>
        </div>
      </div>

      <div className="surface-panel rounded-[28px] p-5">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
            Outfits
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedOutfitId(null);
              setOutfitForm(emptyOutfitForm());
            }}
            className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
          >
            New
          </button>
        </div>

        {selectedCollection ? (
          <>
            <div className="mb-5 flex flex-wrap gap-3">
              {selectedCollection.outfits.map((outfit) => (
                <button
                  key={outfit.id}
                  type="button"
                  onClick={() => {
                    setSelectedOutfitId(outfit.id);
                    setOutfitForm(createOutfitFormState(outfit));
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    selectedOutfitId === outfit.id
                      ? "border-black bg-black text-white"
                      : "border-[var(--border-soft)] bg-white text-[var(--foreground)]"
                  }`}
                >
                  {outfit.formatted_code}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="#AAA111"
                  value={outfitForm.code}
                  onChange={(event) =>
                    setOutfitForm((current) => ({ ...current, code: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none"
                />
                <input
                  type="text"
                  placeholder="Outfit title"
                  value={outfitForm.title}
                  onChange={(event) =>
                    setOutfitForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none"
                />
              </div>

              <div className="rounded-[24px] border border-[var(--border-soft)] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Outfit image
                </p>
                {outfitForm.image_preview ? (
                  <Image
                    src={outfitForm.image_preview}
                    alt="Outfit preview"
                    width={850}
                    height={1125}
                    unoptimized
                    className="mt-4 aspect-[850/1125] w-full rounded-[18px] object-cover"
                  />
                ) : (
                  <div className="mt-4 flex aspect-[850/1125] w-full items-center justify-center rounded-[18px] bg-[var(--surface-muted)] text-sm text-[var(--muted)]">
                    No image selected
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    handleOutfitImageChange(event.target.files?.[0] ?? null)
                  }
                  className="mt-4 block w-full text-sm"
                />
              </div>

              <textarea
                placeholder="Description"
                value={outfitForm.description}
                onChange={(event) =>
                  setOutfitForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="min-h-24 w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none"
              />

              <label className="flex items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={outfitForm.is_featured}
                  onChange={(event) =>
                    setOutfitForm((current) => ({
                      ...current,
                      is_featured: event.target.checked,
                    }))
                  }
                />
                <span>Featured code</span>
              </label>

              <div className="space-y-3 rounded-[24px] border border-[var(--border-soft)] bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
                    Affiliate items
                  </p>
                  <button
                    type="button"
                    onClick={addAffiliateItem}
                    className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
                  >
                    Add item
                  </button>
                </div>

                {outfitForm.affiliate_items.map((item, index) => (
                  <div
                    key={index}
                    className="space-y-3 rounded-[20px] border border-[var(--border-soft)] p-4"
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Paste title + TikTok URL"
                        value={item.product_name}
                        onChange={(event) =>
                          updateAffiliateItem(index, "product_name", event.target.value)
                        }
                        onPaste={(event) => {
                          const pastedValue = event.clipboardData.getData("text");

                          if (handleAffiliateSmartPaste(index, pastedValue)) {
                            event.preventDefault();
                          }
                        }}
                        className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-sm outline-none"
                      />
                      <input
                        type="url"
                        placeholder="Affiliate URL"
                        value={item.affiliate_url}
                        onChange={(event) =>
                          updateAffiliateItem(index, "affiliate_url", event.target.value)
                        }
                        onPaste={(event) => {
                          const pastedValue = event.clipboardData.getData("text");

                          if (handleAffiliateSmartPaste(index, pastedValue)) {
                            event.preventDefault();
                          }
                        }}
                        className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-sm outline-none"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Price"
                      value={item.price}
                      onChange={(event) =>
                        updateAffiliateItem(index, "price", event.target.value)
                      }
                      className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-sm outline-none"
                    />

                    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            handleAffiliateImageChange(
                              index,
                              event.target.files?.[0] ?? null,
                            )
                          }
                          className="block w-full text-sm"
                        />
                        <p className="text-xs text-[var(--muted)]">
                          {item.thumbnail_file?.name ??
                            (item.thumbnail_preview ? "Image attached" : "No image selected")}
                        </p>
                      </div>
                      {item.thumbnail_preview ? (
                        <button
                          type="button"
                          onClick={() => setPreviewImage(item.thumbnail_preview)}
                          className="rounded-2xl border border-[var(--border-soft)] px-4 py-3 text-sm font-semibold"
                        >
                          Preview
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeAffiliateItem(index)}
                        className="rounded-2xl border border-[var(--border-soft)] px-4 py-3 text-sm font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={handleOutfitSubmit}
                  disabled={isSavingOutfit}
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
                >
                  {isSavingOutfit
                    ? "Saving..."
                    : selectedOutfit
                      ? "Save outfit"
                      : "Create outfit"}
                </button>
                {selectedOutfit ? (
                  <button
                    type="button"
                    onClick={handleOutfitDelete}
                    disabled={isSavingOutfit}
                    className="rounded-2xl border border-[var(--border-soft)] px-4 py-3 text-sm font-semibold"
                  >
                    Delete outfit
                  </button>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">Create a collection first.</p>
        )}

        {message ? (
          <p className="mt-5 text-sm font-medium text-[var(--foreground)]">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{error}</p>
        ) : null}

        {previewImage ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.78)] p-4"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="relative w-full max-w-md rounded-[28px] bg-white p-3"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute right-3 top-3 z-10 rounded-full bg-black px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white"
              >
                Close
              </button>
              <Image
                src={previewImage}
                alt="Affiliate preview"
                width={850}
                height={1125}
                unoptimized
                className="w-full rounded-[22px] object-cover"
              />
            </div>
          </div>
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
