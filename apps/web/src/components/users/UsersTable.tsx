"use client"

import { useState } from "react"
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from "@/components/ui/Table"
import { IconButton } from "@/components/ui/IconButton"
import { Edit, Trash2 } from "lucide-react"

type User = { id: number; name: string; email: string }

export default function UsersTable({
                                       users,
                                       pageSize = 5,
                                   }: {
    users: User[]
    pageSize?: number
}) {
    const [page, setPage] = useState(1)

    const totalPages = Math.ceil(users.length / pageSize)
    const startIndex = (page - 1) * pageSize
    const currentUsers = users.slice(startIndex, startIndex + pageSize)

    return (
        <div className="space-y-4">
            {/* Tabell */}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Navn</TableHead>
                        <TableHead>E-post</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {currentUsers.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell>{user.id}</TableCell>
                            <TableCell>{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell className="text-right space-x-2">
                                <IconButton>
                                    <Edit className="h-4 w-4" />
                                </IconButton>
                                <IconButton>
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                </IconButton>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Side {page} av {totalPages}
        </span>
                <div className="space-x-2">
                    <IconButton
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        disabled={page === 1}
                        className="px-3 py-1"
                    >
                        Forrige
                    </IconButton>
                    <IconButton
                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                        disabled={page === totalPages}
                        className="px-3 py-1"
                    >
                        Neste
                    </IconButton>
                </div>
            </div>
        </div>
    )
}
