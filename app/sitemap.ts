import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const BASE = "https://deadlockle.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes: Array<{ path: string; priority: number }> = [
    { path: "/", priority: 1.0 },
    { path: "/classic/", priority: 0.9 },
    { path: "/ability/", priority: 0.9 },
    { path: "/item/", priority: 0.9 },
    { path: "/quote/", priority: 0.9 },
    { path: "/mugshot/", priority: 0.9 },
    { path: "/how-to-play/", priority: 0.7 },
  ];
  return routes.map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency: "daily",
    priority,
  }));
}
