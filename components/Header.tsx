import Link from "next/link";
import { Brand } from "./Brand";
import { HeaderGuideLink } from "./HeaderGuideLink";
import { HeaderProgress } from "./HeaderProgress";

export function Header() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" aria-label="Deadlockle home">
          <Brand size="sm" />
        </Link>
        <div className="flex items-center gap-5 sm:gap-7">
          <HeaderGuideLink />
          <HeaderProgress />
        </div>
      </div>
    </header>
  );
}
