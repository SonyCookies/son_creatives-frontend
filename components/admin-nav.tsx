"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav() {
  const pathname = usePathname();

  const links = [
    { name: "Collections", href: "/admin" },
    { name: "Featured", href: "/admin/featured" },
    { name: "Affiliate Items", href: "/admin/affiliate-items" },
  ];

  return (
    <nav className="flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-white/50 p-1 backdrop-blur-md">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition-all duration-300 ${
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
