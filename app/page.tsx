import Image from "next/image";
import { OutfitLookupExperience } from "@/components/outfit-lookup-experience";
import { VisitorCounter } from "@/components/visitor-counter";

export default function Home() {
  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute left-[-5rem] top-8 h-64 w-64 rounded-full bg-[rgba(0,0,0,0.07)] blur-3xl" />
        <div className="absolute right-[-4rem] top-10 h-72 w-72 rounded-full bg-[rgba(255,255,255,0.75)] blur-3xl" />
      </div>

      <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-6 sm:px-8 lg:px-10">
        <header className="animate-enter flex items-start justify-between gap-4 pb-8">
          <div className="ink-wash">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--muted)]">
              Son Creatives
            </p>
            <div className="mt-4 flex items-center gap-4">
              <Image
                src="/logo.svg"
                alt="Son Creatives logo"
                width={72}
                height={72}
                priority
                className="h-14 w-14 object-contain sm:h-16 sm:w-16"
              />
              <span className="pb-1 text-sm uppercase tracking-[0.42em] text-[var(--muted)]">
                Outfit Codes
              </span>
            </div>
          </div>
          <div className="pt-1">
            <VisitorCounter />
          </div>
        </header>

        <OutfitLookupExperience />
      </section>
    </main>
  );
}
