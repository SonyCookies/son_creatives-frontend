"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useState, useTransition } from "react";
import { AffiliateItemCard } from "@/components/affiliate-item-card";
import { CodeSearchForm } from "@/components/code-search-form";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import {
  fetchCodeLookup,
  fetchFeaturedOutfits,
  OutfitLookupError,
} from "@/lib/api";
import {
  formatOutfitCode,
  isValidOutfitCode,
  normalizeOutfitCode,
} from "@/lib/outfit-code";
import type { CodeLookupResponse, Outfit, OutfitCollection } from "@/types/outfit";

type LookupStatus = "idle" | "loading" | "success" | "not-found" | "error";

export function OutfitLookupExperience() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LookupStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<CodeLookupResponse | null>(null);
  const [activeCollectionOutfitId, setActiveCollectionOutfitId] = useState<number | null>(null);
  const [lastSubmittedCode, setLastSubmittedCode] = useState<string | null>(null);
  const [featuredOutfits, setFeaturedOutfits] = useState<Outfit[]>([]);
  const [isTransitionPending, startTransition] = useTransition();

  const isLoading = status === "loading" || isTransitionPending;

  useEffect(() => {
    let isMounted = true;

    void fetchFeaturedOutfits()
      .then((payload) => {
        if (isMounted) {
          setFeaturedOutfits(payload.data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setFeaturedOutfits([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function search(rawCode: string) {
    const normalizedCode = normalizeOutfitCode(rawCode);

    if (!normalizedCode || !isValidOutfitCode(normalizedCode)) {
      setStatus("error");
      setLookupResult(null);
      setErrorMessage("Please enter a valid code like AAA111 or 000000.");
      return;
    }

    setQuery(formatOutfitCode(normalizedCode));
    setLastSubmittedCode(normalizedCode);
    setStatus("loading");
    setErrorMessage(null);
    setLookupResult(null);
    setActiveCollectionOutfitId(null);

    try {
      const payload = await fetchCodeLookup(normalizedCode);

      startTransition(() => {
        setLookupResult(payload);
        setStatus("success");

        if (payload.type === "collection") {
          setActiveCollectionOutfitId(payload.data.outfits[0]?.id ?? null);
        }
      });
    } catch (error) {
      const message =
        error instanceof OutfitLookupError
          ? error.message
          : "Something went wrong while searching.";

      startTransition(() => {
        setLookupResult(null);
        setStatus(
          error instanceof OutfitLookupError && error.status === 404
            ? "not-found"
            : "error",
        );
        setErrorMessage(message);
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search(query);
  }

  function handleFeaturedClick(code: string) {
    setQuery(formatOutfitCode(code));
    void search(code);
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="surface-panel animate-enter rounded-[32px] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent-deep)]">
          Search by code
        </p>
        <h1 className="mt-4 font-serif text-4xl tracking-[-0.04em] text-[var(--foreground)] sm:text-5xl">
          Enter a code.
        </h1>

        <div className="mt-8">
          <CodeSearchForm
            value={query}
            isLoading={isLoading}
            errorMessage={status === "error" ? errorMessage : null}
            onValueChange={setQuery}
            onSubmit={handleSubmit}
          />
        </div>

        {featuredOutfits.length > 0 ? (
          <div className="mt-8 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              Featured codes
            </p>
            <div className="flex flex-wrap gap-3">
              {featuredOutfits.map((outfit) => (
                <button
                  key={outfit.id}
                  type="button"
                  onClick={() => handleFeaturedClick(outfit.code)}
                  className="rounded-full border border-[var(--border-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:-translate-y-0.5 hover:border-[rgba(0,0,0,0.28)]"
                >
                  {outfit.formatted_code}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="surface-panel animate-enter rounded-[32px] p-4 sm:p-6"
        style={{ animationDelay: "120ms" }}
      >
        {isLoading ? <LoadingSkeleton /> : null}

        {!isLoading && lookupResult?.type === "outfit" ? (
          <OutfitResultCard outfit={lookupResult.data} />
        ) : null}

        {!isLoading && lookupResult?.type === "collection" ? (
          <CollectionResultCard
            collection={lookupResult.data}
            activeOutfitId={activeCollectionOutfitId}
            onSelectOutfit={setActiveCollectionOutfitId}
          />
        ) : null}

        {!isLoading && !lookupResult && status === "idle" ? (
          <EmptyState
            badge="Ready"
            title="Search a collection or outfit code."
            description="You can search a collection like #000000 or an outfit like #AAA111."
          />
        ) : null}

        {!isLoading && !lookupResult && status === "not-found" ? (
          <EmptyState
            badge="Not found"
            title="Code not found."
            description={
              errorMessage ??
              `No result was found for ${lastSubmittedCode ? formatOutfitCode(lastSubmittedCode) : "that code"}.`
            }
          />
        ) : null}

        {!isLoading && !lookupResult && status === "error" ? (
          <EmptyState
            badge="Invalid"
            title="Enter a valid code."
            description={
              errorMessage ?? "Use a code like AAA111 or 000000."
            }
          />
        ) : null}
      </div>
    </section>
  );
}

function CollectionResultCard({
  collection,
  activeOutfitId,
  onSelectOutfit,
}: {
  collection: OutfitCollection;
  activeOutfitId: number | null;
  onSelectOutfit: (outfitId: number) => void;
}) {
  const activeOutfit =
    collection.outfits.find((outfit) => outfit.id === activeOutfitId) ??
    collection.outfits[0] ??
    null;

  return (
    <article className="space-y-6">
      <div className="space-y-3">
        <div className="inline-flex rounded-full border border-[var(--border-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
          {collection.formatted_code}
        </div>
        <h2 className="font-serif text-4xl tracking-[-0.03em] text-[var(--foreground)]">
          {collection.title}
        </h2>
        {collection.description ? (
          <p className="text-sm leading-7 text-[var(--muted)] sm:text-base">
            {collection.description}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {collection.outfits.map((outfit) => (
          <button
            key={outfit.id}
            type="button"
            onClick={() => onSelectOutfit(outfit.id)}
            className={`overflow-hidden rounded-[24px] border text-left ${
              activeOutfit?.id === outfit.id
                ? "border-black bg-black text-white"
                : "border-[var(--border-soft)] bg-white text-[var(--foreground)]"
            }`}
          >
            <div className="relative aspect-[4/5]">
              <Image
                src={outfit.image_url}
                alt={outfit.title}
                fill
                unoptimized
                sizes="(min-width: 1024px) 18rem, (min-width: 640px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="space-y-2 p-4">
              <p className="text-xs uppercase tracking-[0.24em] opacity-70">
                {outfit.formatted_code}
              </p>
              <p className="text-sm font-semibold">{outfit.title}</p>
            </div>
          </button>
        ))}
      </div>

      {activeOutfit ? (
        <div className="rounded-[28px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.76)] p-5">
          <div className="mb-5 flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Selected outfit
            </p>
            <h3 className="font-serif text-3xl tracking-[-0.03em] text-[var(--foreground)]">
              {activeOutfit.title}
            </h3>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {activeOutfit.formatted_code}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeOutfit.affiliate_items.map((item) => (
              <AffiliateItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function OutfitResultCard({ outfit }: { outfit: Outfit }) {
  return (
    <article className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative aspect-[850/1125] overflow-hidden rounded-[28px] bg-[var(--surface-muted)]">
        <Image
          src={outfit.image_url}
          alt={outfit.title}
          fill
          priority
          unoptimized
          sizes="(min-width: 1024px) 42vw, 100vw"
          className="object-cover"
        />

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(0,0,0,0.78)] via-[rgba(0,0,0,0.18)] to-transparent p-6 text-white">
          <div className="inline-flex rounded-full border border-white/20 bg-white/14 px-4 py-2 text-sm font-semibold">
            {outfit.formatted_code}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-serif text-4xl tracking-[-0.03em] text-[var(--foreground)]">
            {outfit.title}
          </h2>
          {outfit.collection ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              {outfit.collection.formatted_code}
            </p>
          ) : null}
          {outfit.description ? (
            <p className="mt-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
              {outfit.description}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-[24px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.76)] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Code
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              {outfit.formatted_code}
            </p>
          </div>
          <div className="rounded-[24px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.76)] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              Items
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              {outfit.affiliate_items.length}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {outfit.affiliate_items.map((item) => (
            <AffiliateItemCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </article>
  );
}
