"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  createAdminCollection,
  createAdminOutfit,
  deleteAdminCollection,
  deleteAdminImage,
  deleteAdminOutfit,
  fetchAdminAffiliateItems,
  fetchAdminCollections,
  uploadAdminImage,
  updateAdminCollection,
  updateAdminOutfit,
  FirebaseError as ApiError,
} from "@/lib/firebase-service";
import type {
  AdminUpsertCollectionPayload,
  AdminUpsertOutfitPayload,
  AffiliateLibraryItem,
  OutfitCollection,
} from "@/types/outfit";
import {
  formatInputCode,
  formatOutfitCode,
  normalizeOutfitCode,
} from "@/lib/outfit-code";

type CollectionFormState = {
  code: string;
  title: string;
  description: string;
};

type OutfitAffiliateSelection = {
  library_item_id: string;
  library_item: AffiliateLibraryItem | null;
};

type OutfitFormState = {
  code: string;
  title: string;
  image_url: string;
  image_path: string;
  image_file: File | null;
  image_preview: string;
  description: string;
  is_featured: boolean;
  affiliate_items: OutfitAffiliateSelection[];
};

const emptyCollectionForm: CollectionFormState = {
  code: "",
  title: "",
  description: "",
};

const emptyOutfitForm = (): OutfitFormState => ({
  code: "",
  title: "",
  image_url: "",
  image_path: "",
  image_file: null,
  image_preview: "",
  description: "",
  is_featured: false,
  affiliate_items: [],
});

function createCollectionFormState(
  collection: OutfitCollection | null,
): CollectionFormState {
  if (!collection) {
    return emptyCollectionForm;
  }

  return {
    code: collection.formatted_code ?? collection.code ?? "",
    title: collection.title ?? "",
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
    code: outfit.formatted_code ?? outfit.code ?? "",
    title: outfit.title ?? "",
    image_url: outfit.image_url ?? "",
    image_path: outfit.image_path ?? "",
    image_file: null,
    image_preview: outfit.image_url ?? "",
    description: outfit.description ?? "",
    is_featured: !!outfit.is_featured,
    affiliate_items: outfit.affiliate_items
      .map((item) => ({
        library_item_id: item.library_item_id ?? item.id,
        library_item: item.library_item_id
          ? {
              id: item.library_item_id,
              product_name: item.product_name,
              affiliate_url: item.affiliate_url,
              price: item.price,
              display_price: item.display_price,
              thumbnail_url: item.thumbnail_url,
              thumbnail_path: item.thumbnail_path,
            }
          : null,
      }))
      .filter((item) => Boolean(item.library_item_id)),
  };
}

export function AdminDashboard() {
  const [collections, setCollections] = useState<OutfitCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    null,
  );
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);
  const [collectionSearch, setCollectionSearch] = useState("");
  const [appliedCollectionSearch, setAppliedCollectionSearch] = useState("");
  const [collectionForm, setCollectionForm] =
    useState<CollectionFormState>(emptyCollectionForm);
  const [outfitForm, setOutfitForm] = useState<OutfitFormState>(emptyOutfitForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [isSavingOutfit, setIsSavingOutfit] = useState(false);
  const [affiliateLibraryItems, setAffiliateLibraryItems] = useState<
    AffiliateLibraryItem[]
  >([]);
  const [affiliateLibrarySearch, setAffiliateLibrarySearch] = useState("");
  const [appliedAffiliateLibrarySearch, setAppliedAffiliateLibrarySearch] =
    useState("");
  const [isLoadingAffiliateLibrary, setIsLoadingAffiliateLibrary] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCollection =
    collections.find((collection) => String(collection.id) === selectedCollectionId) ??
    null;
  const selectedOutfit =
    selectedCollection?.outfits.find((outfit) => String(outfit.id) === selectedOutfitId) ??
    null;

  const affiliateLibraryMap = useMemo(
    () =>
      new Map(
        affiliateLibraryItems.map((item) => [String(item.id), item] as const),
      ),
    [affiliateLibraryItems],
  );

  const selectedAffiliateItems = useMemo(
    () =>
      outfitForm.affiliate_items.map((selection) => ({
        selection,
        libraryItem:
          affiliateLibraryMap.get(selection.library_item_id) ??
          selection.library_item ??
          null,
      })),
    [affiliateLibraryMap, outfitForm.affiliate_items],
  );

  function syncCollectionState(
    nextCollections: OutfitCollection[],
    nextCollectionId?: string | number | null,
    nextOutfitId?: string | number | null,
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

  async function loadCollections(options?: {
    search?: string;
    nextCollectionId?: string | number | null;
    nextOutfitId?: string | number | null;
  }) {
    const activeSearch = (options?.search ?? appliedCollectionSearch).trim();

    if (!activeSearch) {
      setCollections([]);
      setSelectedCollectionId(null);
      setSelectedOutfitId(null);
      setAppliedCollectionSearch("");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
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

  async function loadAffiliateLibrary(search?: string) {
    const activeSearch = search?.trim() ?? "";

    if (!activeSearch) {
      setAffiliateLibraryItems([]);
      setAppliedAffiliateLibrarySearch("");
      setIsLoadingAffiliateLibrary(false);
      return;
    }

    setIsLoadingAffiliateLibrary(true);
    setError(null);

    try {
      const payload = await fetchAdminAffiliateItems(activeSearch, 50);
      setAffiliateLibraryItems(payload.data);
      setAppliedAffiliateLibrarySearch(activeSearch);
    } catch (loadError) {
      setError(resolveErrorMessage(loadError));
    } finally {
      setIsLoadingAffiliateLibrary(false);
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
      code: normalizeOutfitCode(collectionForm.code),
      title: collectionForm.title || "",
      description: collectionForm.description || "",
    };

    try {
      if (selectedCollection) {
        await updateAdminCollection(String(selectedCollection.id), payload);
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
      await deleteAdminCollection(String(selectedCollection.id));
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
      let outfitImagePath = outfitForm.image_path;
      const replacedImagePath =
        outfitForm.image_file && outfitForm.image_path ? outfitForm.image_path : null;

      if (outfitForm.image_file) {
        const uploadedImage = await uploadAdminImage(outfitForm.image_file, "outfit");
        outfitImageUrl = uploadedImage.data.url;
        outfitImagePath = uploadedImage.data.path;
      }

      if (!outfitImageUrl) {
        setError("Please upload an outfit image.");
        setIsSavingOutfit(false);
        return;
      }

      const payload: AdminUpsertOutfitPayload = {
        code: normalizeOutfitCode(outfitForm.code),
        title: outfitForm.title || "",
        image_url: outfitImageUrl,
        image_path: outfitImagePath || null,
        description: outfitForm.description || "",
        is_featured: !!outfitForm.is_featured,
        outfit_collection_id: String(selectedCollection.id),
        affiliate_items: outfitForm.affiliate_items.map((item, index) => ({
          library_item_id: item.library_item_id,
          sort_order: index + 1,
        })),
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

      if (replacedImagePath && replacedImagePath !== outfitImagePath) {
        await deleteAdminImage(replacedImagePath).catch(console.error);
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
      await deleteAdminOutfit(String(selectedOutfit.id));
      setMessage("Outfit deleted.");
      setSelectedOutfitId(null);
      await loadCollections({
        search: appliedCollectionSearch,
        nextCollectionId: String(selectedCollection.id),
        nextOutfitId: null,
      });
    } catch (deleteError) {
      setError(resolveErrorMessage(deleteError));
    } finally {
      setIsSavingOutfit(false);
    }
  }

  function addAffiliateItemFromLibrary(item: AffiliateLibraryItem) {
    const alreadyAdded = outfitForm.affiliate_items.some(
      (affiliateItem) => affiliateItem.library_item_id === item.id,
    );

    if (alreadyAdded) {
      setMessage(`"${item.product_name}" is already in this outfit.`);
      return;
    }

    setOutfitForm((current) => ({
      ...current,
      affiliate_items: [
        ...current.affiliate_items,
        {
          library_item_id: item.id,
          library_item: item,
        },
      ],
    }));
    setMessage(`Added "${item.product_name}" to the outfit.`);
  }

  function removeAffiliateItem(index: number) {
    setOutfitForm((current) => ({
      ...current,
      affiliate_items: current.affiliate_items.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  }

  function moveAffiliateItem(index: number, direction: "up" | "down") {
    setOutfitForm((current) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= current.affiliate_items.length
      ) {
        return current;
      }

      const nextItems = [...current.affiliate_items];
      const [movedItem] = nextItems.splice(index, 1);
      nextItems.splice(targetIndex, 0, movedItem);

      return {
        ...current,
        affiliate_items: nextItems,
      };
    });
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
              placeholder="Search collection title or code"
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
                  : "Search by collection title or code to show results."}
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
                className={`group w-full rounded-[22px] border px-4 py-4 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                  selectedCollectionId === String(collection.id)
                    ? "border-black bg-black text-white shadow-xl shadow-black/10"
                    : "border-[var(--border-soft)] bg-white text-[var(--foreground)] hover:border-black/20"
                }`}
              >
                <p className="text-sm font-semibold">
                  {collection.formatted_code || formatOutfitCode(collection.code)}
                </p>
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
                setCollectionForm({
                  ...collectionForm,
                  code: formatInputCode(event.target.value),
                })
              }
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none focus:border-black"
            />
            <input
              type="text"
              placeholder="Collection title"
              value={collectionForm.title}
              onChange={(event) =>
                setCollectionForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
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
                    setOutfitForm({
                      ...outfitForm,
                      code: formatInputCode(event.target.value),
                    })
                  }
                  className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none focus:border-black"
                />
                <input
                  type="text"
                  placeholder="Outfit title"
                  value={outfitForm.title}
                  onChange={(event) =>
                    setOutfitForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
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
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
                    Affiliate items
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Outfits now use only linked affiliate-library items. Add them below and reorder as needed.
                  </p>
                </div>

                {selectedAffiliateItems.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-[var(--border-soft)] p-4 text-sm text-[var(--muted)]">
                    No affiliate items selected for this outfit yet.
                  </div>
                ) : null}

                {selectedAffiliateItems.map(({ selection, libraryItem }, index) => (
                  <div
                    key={`${selection.library_item_id}_${index}`}
                    className="flex flex-col gap-3 rounded-[20px] border border-[var(--border-soft)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-[var(--surface-muted)]">
                          {libraryItem?.thumbnail_url ? (
                            <Image
                              src={libraryItem.thumbnail_url}
                              alt={libraryItem.product_name}
                              fill
                              unoptimized
                              sizes="64px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                              No Img
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                            Item {index + 1}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                            {libraryItem?.product_name ?? "Missing affiliate item"}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {libraryItem?.display_price ??
                              (libraryItem ? "No price" : `Missing ID: ${selection.library_item_id}`)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {libraryItem?.thumbnail_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(libraryItem.thumbnail_url)}
                            className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                          >
                            Preview
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => moveAffiliateItem(index, "up")}
                          disabled={index === 0}
                          className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Move up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveAffiliateItem(index, "down")}
                          disabled={index === selectedAffiliateItems.length - 1}
                          className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Move down
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAffiliateItem(index)}
                          className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="space-y-3 rounded-[20px] border border-dashed border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                        Affiliate library
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Search saved affiliate items before adding them to this outfit.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void loadAffiliateLibrary(affiliateLibrarySearch);
                    }}
                    className="flex flex-col gap-2 sm:flex-row"
                  >
                    <input
                      type="text"
                      placeholder="Search saved affiliate items"
                      value={affiliateLibrarySearch}
                      onChange={(event) => setAffiliateLibrarySearch(event.target.value)}
                      className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isLoadingAffiliateLibrary}
                      className="rounded-2xl border border-black px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Search
                    </button>
                  </form>

                  {isLoadingAffiliateLibrary ? (
                    <p className="text-sm text-[var(--muted)]">Searching affiliate library...</p>
                  ) : null}

                  {!isLoadingAffiliateLibrary &&
                  !appliedAffiliateLibrarySearch.trim() ? (
                    <p className="text-sm text-[var(--muted)]">
                      Enter a product name or URL, then click Search to show matching affiliate items.
                    </p>
                  ) : null}

                  {!isLoadingAffiliateLibrary &&
                  appliedAffiliateLibrarySearch.trim() &&
                  affiliateLibraryItems.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                      No saved affiliate items match this search.
                    </p>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    {affiliateLibraryItems.map((libraryItem) => {
                      const alreadyAdded = outfitForm.affiliate_items.some(
                        (item) => item.library_item_id === libraryItem.id,
                      );

                      return (
                        <div
                          key={libraryItem.id}
                          className="flex gap-3 rounded-[18px] border border-[var(--border-soft)] bg-white p-3"
                        >
                          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[var(--surface-muted)]">
                            {libraryItem.thumbnail_url ? (
                              <Image
                                src={libraryItem.thumbnail_url}
                                alt={libraryItem.product_name}
                                fill
                                unoptimized
                                sizes="80px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                                No Img
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-semibold text-[var(--foreground)]">
                              {libraryItem.product_name}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {libraryItem.display_price ?? "No price"}
                            </p>
                            <button
                              type="button"
                              onClick={() => addAffiliateItemFromLibrary(libraryItem)}
                              disabled={alreadyAdded}
                              className="mt-3 rounded-full bg-black px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:bg-black/30"
                            >
                              {alreadyAdded ? "Added" : "Add to outfit"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
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
      </div>

      {typeof window !== "undefined" && previewImage
        ? createPortal(
            <div
              className="fixed inset-0 z-[999] flex items-center justify-center bg-[rgba(0,0,0,0.88)] p-4 sm:p-6"
              onClick={() => setPreviewImage(null)}
            >
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white"
              >
                Close
              </button>
              <div
                className="relative flex max-h-full w-full items-center justify-center"
                onClick={(event) => event.stopPropagation()}
              >
                <Image
                  src={previewImage}
                  alt="Affiliate preview"
                  width={850}
                  height={1125}
                  unoptimized
                  className="max-h-[92vh] w-auto max-w-full rounded-[24px] object-contain"
                />
              </div>
            </div>,
            document.body,
          )
        : null}
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
