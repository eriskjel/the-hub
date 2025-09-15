// app/[locale]/admin/users/page.tsx
import UsersTable from "@/components/users/UsersTable";

const users = [
    { id: 1, name: "Ola Nordmann", email: "ola@norge.no" },
    { id: 2, name: "Kari Nordmann", email: "kari@norge.no" },
    { id: 3, name: "Per Hansen", email: "per@norge.no" },
    { id: 4, name: "Lise Johansen", email: "lise@norge.no" },
];

export default function UsersPage() {
    return (
        <div className="p-8">
            <h1 className="mb-4 text-2xl font-bold">Brukere</h1>
            <UsersTable users={users} pageSize={2} />
        </div>
    );
}
