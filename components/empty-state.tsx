type EmptyStateProps = {
  title: string;
  description: string;
  badge: string;
};

export function EmptyState({ title, description, badge }: EmptyStateProps) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[rgba(0,0,0,0.16)] bg-[rgba(255,255,255,0.72)] px-6 py-12 text-center">
      <span className="rounded-full bg-[rgba(0,0,0,0.06)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--accent-deep)]">
        {badge}
      </span>
      <h2 className="mt-6 max-w-xl font-serif text-4xl tracking-[-0.03em] text-[var(--foreground)]">
        {title}
      </h2>
      <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">
        {description}
      </p>
    </div>
  );
}
