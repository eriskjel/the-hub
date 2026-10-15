export function UsersSkeletonRows({ rows = 10 }: { rows?: number }) {
    return Array.from({ length: rows }, (_, index) => (
        <tr key={index} aria-hidden="true" className="border-border border-t">
            <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className="bg-border h-10 w-10 shrink-0 rounded-full motion-safe:animate-pulse" />
                    <div className="space-y-2">
                        <div className="bg-border h-4 w-28 rounded motion-safe:animate-pulse" />
                        <div className="bg-border h-3 w-40 rounded motion-safe:animate-pulse" />
                    </div>
                </div>
            </td>
            <td className="px-5 py-4">
                <div className="bg-border h-5 w-14 rounded-full motion-safe:animate-pulse" />
            </td>
            <td className="hidden px-5 py-4 sm:table-cell">
                <div className="bg-border h-4 w-24 rounded motion-safe:animate-pulse" />
            </td>
            <td className="hidden px-5 py-4 lg:table-cell">
                <div className="bg-border h-4 w-20 rounded motion-safe:animate-pulse" />
            </td>
            <td className="px-5 py-4">
                <div className="bg-border ml-auto h-4 w-12 rounded motion-safe:animate-pulse" />
            </td>
        </tr>
    ));
}

export default function UsersTableSkeleton({ label }: { label: string }) {
    return (
        <div
            role="status"
            aria-label={label}
            className="border-border bg-surface overflow-hidden rounded-2xl border"
        >
            <span className="sr-only">{label}</span>
            <div
                aria-hidden="true"
                className="border-border flex h-24 items-center gap-3 border-b px-5"
            >
                <div className="bg-border h-10 w-full max-w-md rounded-lg motion-safe:animate-pulse" />
            </div>
            <div className="overflow-hidden" aria-hidden="true">
                <table className="w-full">
                    <tbody>
                        <UsersSkeletonRows />
                    </tbody>
                </table>
            </div>
            <div aria-hidden="true" className="border-border h-16 border-t" />
        </div>
    );
}
