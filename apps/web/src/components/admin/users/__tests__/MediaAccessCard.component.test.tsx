import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setIntl } from "@/tests/testUtils";
import enMessages from "@/messages/en.json";
import MediaAccessCard from "../MediaAccessCard";
import type { MediaMember } from "@/lib/media/member";
import { mediaMemberAction } from "@/lib/admin/mediaMember.actions";

vi.mock("@/lib/admin/mediaMember.actions", () => ({ mediaMemberAction: vi.fn() }));

const USER_ID = "00000000-0000-0000-0000-0000000000b1";

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

function renderCard(m: MediaMember | null) {
    setIntl({ locale: "en", messages: enMessages });
    render(<MediaAccessCard userId={USER_ID} member={m} targetIsAdmin={false} />);
}

describe("MediaAccessCard", () => {
    it("labels its inputs", () => {
        renderCard(member());

        expect(screen.getByLabelText("Library account")).toHaveValue("fredrik");
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
        expect(alert).toHaveTextContent("That library account is already linked to another user.");
        const input = screen.getByLabelText("Library account");
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(input).toHaveAccessibleDescription(expect.stringContaining("already linked"));

        const formData = vi.mocked(mediaMemberAction).mock.calls[0][1] as FormData;
        expect(formData.get("intent")).toBe("update");
        expect(formData.get("userId")).toBe(USER_ID);
        expect(formData.get("libraryAccount")).toBe("fredrik");
    });

    it("edits or revokes an active member", () => {
        renderCard(member());

        expect(screen.getByText(/^Can request since/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save" })).toHaveValue("update");
        expect(screen.getByRole("button", { name: "Revoke access" })).toHaveValue("revoke");
    });
});
