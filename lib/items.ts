import itemsData from "@/data/items.json";

export type ItemSlot = "weapon" | "vitality" | "spirit";

export type Item = {
  key: string;
  name: string;
  slot: ItemSlot;
  tier: number | null;
  cost: number | null;
  icon: string | null;
  description?: string | null;
  wikiUrl?: string;
};

export const ITEMS: Item[] = itemsData as Item[];

export const ITEMS_BY_KEY: Record<string, Item> = Object.fromEntries(
  ITEMS.map((i) => [i.key, i]),
);

// Items eligible to be the daily Item-mode answer — must have an icon
// (otherwise blur reveal has nothing to show).
export const ITEM_ANSWER_POOL: Item[] = ITEMS.filter((i) => i.icon != null);
