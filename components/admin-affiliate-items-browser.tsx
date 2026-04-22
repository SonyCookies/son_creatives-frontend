"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { fetchAdminAffiliateItems, FirebaseError as ApiError } from "@/lib/firebase-service";
import type { AffiliateLibraryItem } from "@/types/outfit";

const FULL_LIBRARY_FETCH_LIMIT = 200;

export function AdminAffiliateItemsBrowser() {
  const [items, setItems] = useState<AffiliateLibraryItem[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadItems("");
  }, []);

  async function loadItems(nextSearch: string) {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await fetchAdminAffiliateItems(
        nextSearch,
        FULL_LIBRARY_FETCH_LIMIT,
      );
      setItems(payload.data);
      setAppliedSearch(nextSearch);
    } catch (loadError) {
      setError(resolveErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="surface-panel rounded-[28px] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
              Full Library
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Browse all affiliate items in one place.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void loadItems(search);
            }}
            className="flex w-full gap-2 sm:max-w-lg"
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
        </div>
      </div>

      {isLoading ? (
        <div className="surface-panel rounded-[28px] p-5">
          <p className="text-sm text-[var(--muted)]">Loading...</p>
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="surface-panel rounded-[28px] p-5">
          <p className="text-sm font-medium text-[var(--foreground)]">{error}</p>
        </div>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <div className="surface-panel rounded-[28px] p-5">
          <p className="text-sm text-[var(--muted)]">
            {appliedSearch.trim()
              ? "No matching affiliate items."
              : "No affiliate items yet."}
          </p>
        </div>
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="surface-panel overflow-hidden rounded-[24px] p-4"
            >
              <div className="flex gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[18px] bg-[var(--surface-muted)]">
                  {item.thumbnail_url ? (
                    <Image
                      src={item.thumbnail_url}
                      alt={item.product_name}
                      fill
                      unoptimized
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      No Img
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-base font-semibold text-[var(--foreground)]">
                    {item.product_name}
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {item.display_price ?? "No price"}
                  </p>
                  <a
                    href={item.affiliate_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex rounded-full border border-[var(--border-soft)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
                  >
                    Open Link
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
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
