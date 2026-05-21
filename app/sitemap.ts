import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const BASE = "https://deadlockle.com";

type ChangeFreq = MetadataRoute.Sitemap[number]["changeFrequency"];

type Route = { path: string; priority: number; changeFrequency: ChangeFreq };

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes: Route[] = [
    // Daily-rotating play loop — fresh content every 2:15am Pacific.
    { path: "/", priority: 1.0, changeFrequency: "daily" },
    { path: "/classic/", priority: 0.9, changeFrequency: "daily" },
    { path: "/ability/", priority: 0.9, changeFrequency: "daily" },
    { path: "/item/", priority: 0.9, changeFrequency: "daily" },
    { path: "/sound/", priority: 0.9, changeFrequency: "daily" },
    { path: "/mugshot/", priority: 0.9, changeFrequency: "daily" },
    // Reference content — changes only on deploys.
    { path: "/guides/", priority: 0.8, changeFrequency: "monthly" },
    { path: "/guides/classic/", priority: 0.7, changeFrequency: "monthly" },
    { path: "/guides/ability/", priority: 0.7, changeFrequency: "monthly" },
    { path: "/guides/mugshot/", priority: 0.7, changeFrequency: "monthly" },
    { path: "/guides/sound/", priority: 0.7, changeFrequency: "monthly" },
    { path: "/guides/item/", priority: 0.7, changeFrequency: "monthly" },
    { path: "/how-to-play/", priority: 0.7, changeFrequency: "monthly" },
  ];
  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
