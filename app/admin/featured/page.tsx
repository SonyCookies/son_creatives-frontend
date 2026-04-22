import Image from "next/image";
import Link from "next/link";
import { AdminAccess } from "@/components/admin-access";
import { AdminFeaturedManager } from "@/components/admin-featured-manager";

export default function AdminFeaturedPage() {
  return (
    <main className="relative flex-1 overflow-hidden">
      <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 pb-8">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.svg"
              alt="Son Creatives logo"
              width={68}
              height={68}
              priority
              className="h-14 w-14 object-contain"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--muted)]">
                Son Creatives Admin
              </p>
              <h1 className="mt-3 font-serif text-4xl tracking-[-0.04em] text-[var(--foreground)]">
                Featured
              </h1>
            </div>
          </div>
          <Link
            href="/"
            className="rounded-full border border-[var(--border-soft)] bg-white/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.25em] text-[var(--foreground)] shadow-sm"
          >
            Site
          </Link>
        </header>

        <AdminAccess>
          <AdminFeaturedManager />
        </AdminAccess>
      </section>
    </main>
  );
}
