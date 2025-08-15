export type UUID = string;

export type Profile = {
    id: UUID;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    age: number | null;
    gender: string | null;
    created_at: string;
    updated_at: string;
};

// Payloads for insert/update with supabase-js
export type ProfileInsert =
    // id is required because RLS "insert own profile" checks auth.uid() = id
    Pick<Profile, "id" | "username" | "full_name" | "avatar_url" | "age" | "gender">;

export type ProfileUpdate =
    // id is immutable; created_at/updated_at are DB-managed
    Partial<Pick<Profile, "username" | "full_name" | "avatar_url" | "age" | "gender">>;
