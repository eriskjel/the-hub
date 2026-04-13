import type { DrinkRarity } from "@/app/[locale]/(protected)/monster/types";
import type { MonsterFeedItem } from "@/app/[locale]/(protected)/monster/types";
import { displayFirstName } from "@/lib/monster/profileName";

/**
 * Supabase select string for a monster_opening row joined with its profile.
 * Shared by /api/monster/feed and /api/monster/highlights so both hit the
 * same column set (and both can be cast to `OpeningWithProfileRow`).
 */
export const OPENING_WITH_PROFILE_SELECT = `
  id,
  user_id,
  case_type,
  item,
  rarity,
  opened_at,
  profiles(username, full_name, avatar_url)
` as const;

export type OpeningWithProfileRow = {
    id: string;
    user_id: string;
    case_type: string;
    item: string;
    rarity: DrinkRarity;
    opened_at: string;
    profiles: {
        username: string | null;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
};

/** Normalize a DB row into the shape every monster feed UI consumes. */
export function toFeedItem(row: OpeningWithProfileRow): MonsterFeedItem {
    return {
        id: row.id,
        item: row.item,
        rarity: row.rarity,
        openedAt: row.opened_at,
        username: displayFirstName(row.profiles?.full_name, row.profiles?.username),
        avatarUrl: row.profiles?.avatar_url ?? null,
    };
}
