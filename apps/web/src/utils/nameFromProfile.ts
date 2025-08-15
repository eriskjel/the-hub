import { Profile } from "@/types/database";

export function getNameFromProfile(profile: Profile | null) {
    return profile?.full_name ?? profile?.username ?? null;
}
