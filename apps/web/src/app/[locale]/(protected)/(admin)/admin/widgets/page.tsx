export default async function UsersPage() {
    // mock data until you have a real endpoint
    const users = [
        { id: "1", email: "aliceeeeeeeeeeeee@example.com", role: "admin" },
        { id: "2", email: "bob@example.com", role: "user" },
        { id: "3", email: "carol@example.com", role: "editor" },
    ];

    return (
        <table className="w-full border-collapse text-sm">
            <thead>
                <tr className="border-b text-left">
                    <th className="py-2 pr-4">ID</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Role</th>
                </tr>
            </thead>
            <tbody>
                {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{u.id}</td>
                        <td className="py-2 pr-4">{u.email}</td>
                        <td className="py-2 pr-4">{u.role}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
