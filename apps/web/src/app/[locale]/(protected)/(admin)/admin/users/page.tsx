import UsersTable from "@/components/admin/UsersTable";
import type { ProfileWithAuth } from "@/types/users";

const users: ProfileWithAuth[] = [
    {
        id: "f5a135e8-c32f-4f0d-ae25-eb6cbaf0f455",
        username: "eriskjel",
        full_name: "Erik Skjellevik",
        avatar_url: "https://avatars.githubusercontent.com/u/98759397?v=4",
        age: null,
        gender: null,
        created_at: "2025-08-20T09:48:56.910Z",
        updated_at: "2025-09-15T10:31:57.460Z",
        auth: {
            id: "f5a135e8-c32f-4f0d-ae25-eb6cbaf0f455",
            email: "erik.skjellevik@lyse.net",
            role: "authenticated",
            last_sign_in_at: "2025-09-15T10:31:57.457Z",
            raw_app_meta_data: {
                role: "user",
                roles: ["admin"],
                provider: "github",
                providers: ["github"],
            },
            raw_user_meta_data: { preferred_username: "eriskjel" },
        },
    },
];

export default function UsersPage() {
    return (
        <div className="p-8">
            <h1 className="mb-4 text-2xl font-bold">Brukere</h1>
            <UsersTable users={users} pageSize={2} />
        </div>
    );
}
