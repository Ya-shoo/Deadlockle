import type { Metadata } from "next";
import { SharePreviewGrid } from "@/components/SharePreviewGrid";

// Dev-only share-card review matrix. Renders every OG card variant in
// one grid against the local og-dev server (:8798) so design tweaks can
// be eyeballed across the full space — each mode's win/loss, modifier
// tallies, singular counts, daily sweep/mixed/all-missed — without
// hand-typing codes. The labeler layout's prod gate 404s this route in
// production builds.

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SharePreviewPage() {
  return <SharePreviewGrid />;
}
