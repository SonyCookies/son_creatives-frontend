import type { AffiliateItem } from "@/types/outfit";

type AffiliateItemCardProps = {
  item: AffiliateItem;
};

export function AffiliateItemCard({ item }: AffiliateItemCardProps) {
  return (
    <a
      href={item.affiliate_url}
      target="_blank"
      rel="noreferrer"
      className="group mb-4 flex w-full break-inside-avoid flex-col overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-white shadow-[0_20px_45px_-30px_rgba(0,0,0,0.22)] hover:-translate-y-1 hover:border-[rgba(0,0,0,0.28)]"
    >
      {item.thumbnail_url ? (
        <div className="overflow-hidden bg-[var(--surface-muted)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.thumbnail_url}
            alt={item.product_name}
            loading="lazy"
            className="block h-auto w-full transition duration-300 group-hover:scale-[1.03]"
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold leading-6 text-[var(--foreground)]">
            {item.product_name}
          </h3>
          {item.display_price ? (
            <span className="rounded-full bg-[rgba(0,0,0,0.06)] px-3 py-1 text-xs font-semibold text-[var(--accent-deep)]">
              {item.display_price}
            </span>
          ) : null}
        </div>

        <div className="mt-auto inline-flex items-center gap-2 rounded-full bg-[#ff5a36] px-3 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-18px_rgba(255,90,54,0.85)] transition duration-300 group-hover:bg-[#ff4720]">
          <span>Shop this item</span>
          <span aria-hidden="true">+</span>
        </div>
      </div>
    </a>
  );
}
