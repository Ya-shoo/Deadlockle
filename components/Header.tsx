import Link from "next/link";
import { Brand } from "./Brand";
import { DevHubHeader } from "./DevHubHeader";
import { HeaderProgress } from "./HeaderProgress";
import { NextResetCountdown } from "./NextResetCountdown";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Deadlockle brand on the left; the dev-hub chip slots in
            beside it but only renders on /labeler/* sub-routes
            (decided in the chip client component via usePathname). On
            every other route it returns null and the header is
            unchanged. */}
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Deadlockle home">
            <Brand size="sm" />
          </Link>
          <DevHubHeader />
        </div>
        <div className="flex items-center gap-5 sm:gap-7">
          <NextResetCountdown
            label="next "
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-info"
          />
          <HeaderProgress />
        </div>
      </div>
    </header>
  );
}
