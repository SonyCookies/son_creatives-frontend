"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav() {
  const pathname = usePathname();

  const links = [
    { name: "Collections", href: "/admin" },
    { name: "Featured", href: "/admin/featured" },
    { name: "Affiliate Items", href: "/admin/affiliate-items" },
    { name: "View All", href: "/admin/affiliate-items/all" },
  ];

  return (
    <nav className="flex w-full max-w-3xl flex-wrap items-center justify-center gap-2 rounded-[28px] border border-[var(--border-soft)] bg-white/60 p-2 backdrop-blur-md sm:w-auto sm:max-w-none sm:gap-1 sm:rounded-full sm:p-1">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`min-w-[calc(50%-0.25rem)] rounded-full px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] transition-all duration-300 sm:min-w-0 sm:px-4 sm:py-1.5 sm:text-xs sm:tracking-[0.2em] ${
              isActive
                ? "bg-black text-white shadow-md shadow-black/10"
                : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5"
            }`}
          >
            {link.name}
          </Link>
        );
      })}
    </nav>
  );
}
