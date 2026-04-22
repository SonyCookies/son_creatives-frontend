"use client";

import { useEffect, useState } from "react";
import { fetchAllAdminOutfits, updateAdminOutfit } from "@/lib/firebase-service";
import type { Outfit } from "@/types/outfit";
import { Search, Star, Loader2, ImageOff } from "lucide-react";

export function AdminFeaturedManager() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    loadOutfits();
  }, []);

  async function loadOutfits(search?: string) {
    setIsLoading(true);
    try {
      const { data } = await fetchAllAdminOutfits(search);
      setOutfits(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleFeatured(outfit: Outfit) {
    if (togglingId === outfit.id) return;
    
    setTogglingId(outfit.id);
    try {
      const newStatus = !outfit.is_featured;
      await updateAdminOutfit(outfit.id, { is_featured: newStatus });
      setOutfits((prev) =>
        prev.map((o) => (o.id === outfit.id ? { ...o, is_featured: newStatus } : o))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  }

  const featuredCount = outfits.filter((o) => o.is_featured).length;

  return (
    <div className="space-y-8">
      {/* Header Controls */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Search by code (e.g. #AAA111)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadOutfits(searchQuery)}
            className="w-full rounded-2xl border border-[var(--border-soft)] bg-white py-3.5 pl-11 pr-4 text-sm outline-none focus:border-black transition-all shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-white px-5 py-3.5 shadow-sm">
          <div className="flex h-2 w-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--foreground)]">
            {featuredCount} Featured Outfits
          </span>
        </div>
      </div>

      {/* Main Grid */}
      {isLoading ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[32px] border border-dashed border-[var(--border-soft)] bg-white/20">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--muted)] opacity-50" />
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-[var(--muted)] opacity-50">
            Scanning Outfits...
          </p>
        </div>
      ) : outfits.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[32px] border border-dashed border-[var(--border-soft)] bg-white/20">
          <ImageOff className="h-8 w-8 text-[var(--muted)] opacity-50" />
          <p className="mt-4 text-sm font-medium text-[var(--muted)]">
            No outfits found matching your search.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {outfits.map((outfit) => (
            <div
              key={outfit.id}
              className={`group relative flex items-center justify-between overflow-hidden rounded-2xl border p-4 transition-all duration-300 ${
                outfit.is_featured
                  ? "border-black bg-white shadow-lg shadow-black/5"
                  : "border-[var(--border-soft)] bg-white/50 hover:bg-white hover:border-black/20"
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--muted)] opacity-50">
                  {outfit.formatted_code}
                </p>
                <h3 className="line-clamp-1 font-serif text-base tracking-tight text-[var(--foreground)]">
                  {outfit.title}
                </h3>
              </div>

              <button
                onClick={() => handleToggleFeatured(outfit)}
                disabled={togglingId === outfit.id}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-90 ${
                  outfit.is_featured
                    ? "bg-black text-white hover:bg-black/90"
                    : "bg-[var(--surface-muted)] text-[var(--muted)] hover:bg-black hover:text-white"
                }`}
                title={outfit.is_featured ? "Featured" : "Click to feature"}
              >
                {togglingId === outfit.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Star
                    className={`h-4 w-4 ${outfit.is_featured ? "fill-current" : ""}`}
                  />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
