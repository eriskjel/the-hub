import { fireEvent, render as renderUI, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { setIntl } from "@/tests/testUtils";
import enMessages from "@/messages/en.json";
import MediaAccessCard from "../MediaAccessCard";
import type { MediaMember } from "@/lib/media/member";
import { mediaMemberAction } from "@/lib/admin/mediaMember.actions";

vi.mock("@/lib/admin/mediaMember.actions", () => ({ mediaMemberAction: vi.fn() }));

const USER_ID = "00000000-0000-0000-0000-0000000000b1";

function render(ui: ReactNode) {
    const client = new QueryClient();
    return renderUI(ui, {
        wrapper: ({ children }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
    });
}

function member(overrides: Partial<MediaMember> = {}): MediaMember {
    return {
        userId: USER_ID,
        libraryAccount: "fredrik",
        weeklyQuota: 5,
        grantedAt: "2026-10-07T12:00:00Z",
        revokedAt: null,
        ...overrides,
    };
}

function card(m: MediaMember | null) {
    return <MediaAccessCard userId={USER_ID} member={m} targetIsAdmin={false} />;
}

function renderCard(m: MediaMember | null) {
    setIntl({ locale: "en", messages: enMessages });
    return render(card(m));
}

describe("MediaAccessCard for an admin", () => {
    it("says admins always have access, with nothing to grant", () => {
        setIntl({ locale: "en", messages: enMessages });
        render(<MediaAccessCard userId={USER_ID} member={null} targetIsAdmin />);

        expect(
            screen.getByText("Admins always have access, with no weekly limit.")
        ).toBeInTheDocument();
        expect(screen.queryByRole("button")).toBeNull();
        expect(screen.queryByRole("textbox")).toBeNull();
    });
});

describe("MediaAccessCard", () => {
    it.each([
        { status: "saved" },
        { status: "error", error: "changed" },
        { status: "error", error: "already_active" },
    ] as const)("invalidates cached user lists when access changed: %o", async (outcome) => {
        setIntl({ locale: "en", messages: enMessages });
        const client = new QueryClient();
        const invalidate = vi.spyOn(client, "invalidateQueries");
        vi.mocked(mediaMemberAction).mockResolvedValueOnce(outcome);
        renderUI(<QueryClientProvider client={client}>{card(member())}</QueryClientProvider>);
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin-users"] }));
        client.clear();
    });
    it("labels its inputs", () => {
        renderCard(member());

        expect(screen.getByLabelText("Streaming username")).toHaveValue("fredrik");
        expect(screen.getByLabelText("Requests per week")).toHaveValue(5);
    });

    it("offers a grant to someone without access", () => {
        renderCard(null);

        expect(screen.getByText("No access")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Allow requests" })).toHaveValue("grant");
        expect(screen.queryByRole("button", { name: "Revoke access" })).toBeNull();
    });

    it("offers a grant again after access was revoked", () => {
        renderCard(member({ revokedAt: "2026-10-08T12:00:00Z" }));

        expect(screen.getByText(/^Access revoked/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Allow requests" })).toHaveValue("grant");
    });

    it("sends the button's intent and announces a field error", async () => {
        vi.mocked(mediaMemberAction).mockResolvedValueOnce({
            status: "error",
            error: "account_taken",
        });
        renderCard(member());

        fireEvent.click(screen.getByRole("button", { name: "Save" }));

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent(
            "That streaming username is already linked to another user."
        );
        const input = screen.getByLabelText("Streaming username");
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(input).toHaveAccessibleDescription(expect.stringContaining("already linked"));

        const formData = vi.mocked(mediaMemberAction).mock.calls[0][1] as FormData;
        expect(formData.get("intent")).toBe("update");
        expect(formData.get("userId")).toBe(USER_ID);
        expect(formData.get("grantedAt")).toBe(member().grantedAt);
        expect(formData.get("libraryAccount")).toBe("fredrik");
    });

    it("shows the stored values again when the membership changes", () => {
        const { rerender } = renderCard(member());
        fireEvent.change(screen.getByLabelText("Streaming username"), {
            target: { value: "draft" },
        });

        // E.g. a refresh after someone else changed it.
        rerender(card(member({ libraryAccount: "other", weeklyQuota: 9 })));

        expect(screen.getByLabelText("Streaming username")).toHaveValue("other");
        expect(screen.getByLabelText("Requests per week")).toHaveValue(9);
    });

    it("keeps the admin's input while the membership is unchanged", () => {
        const { rerender } = renderCard(member());
        fireEvent.change(screen.getByLabelText("Streaming username"), {
            target: { value: "draft" },
        });

        rerender(card(member()));

        expect(screen.getByLabelText("Streaming username")).toHaveValue("draft");
    });

    it("edits or revokes an active member", () => {
        renderCard(member());

        expect(screen.getByText(/^Can request since/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save" })).toHaveValue("update");
        expect(screen.getByRole("button", { name: "Revoke access" })).toHaveValue("revoke");
    });
});
