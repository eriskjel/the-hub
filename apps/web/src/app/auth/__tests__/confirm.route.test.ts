import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as confirmGET } from "../confirm/route";
import { mkReq } from "@/tests/testUtils";

vi.mock("@/i18n/resolve-locale", () => ({ resolveLocale: async () => "no" }));

const verifyOtp = vi.fn();
vi.mock("@/utils/supabase/server", () => ({
    createClient: async () => ({ auth: { verifyOtp } }),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("/auth/confirm", () => {
    it("missing token → no_token", async () => {
        const res = await confirmGET(
            mkReq("http://localhost:3000/auth/confirm?type=signup&locale=no")
        );
        expect(res.headers.get("location")).toBe(
            "http://localhost:3000/auth/auth-code-error?reason=no_token&locale=no"
        );
    });

    it("invalid type → invalid_type", async () => {
        const res = await confirmGET(
            mkReq("http://localhost:3000/auth/confirm?token_hash=abc&type=weird&locale=no")
        );
        expect(res.headers.get("location")).toBe(
            "http://localhost:3000/auth/auth-code-error?reason=invalid_type&locale=no"
        );
    });

    it("verify success → redirect to next", async () => {
        verifyOtp.mockResolvedValueOnce({ error: null });
        const res = await confirmGET(
            mkReq(
                "http://localhost:3000/auth/confirm?token_hash=abc&type=signup&locale=no&next=/no/dashboard"
            )
        );
        expect(res.headers.get("location")).toBe("http://localhost:3000/no/dashboard");
    });

    it("verify failure → verify_failed", async () => {
        verifyOtp.mockResolvedValueOnce({ error: new Error("expired") });
        const res = await confirmGET(
            mkReq("http://localhost:3000/auth/confirm?token_hash=abc&type=signup&locale=no")
        );
        expect(res.headers.get("location")).toBe(
            "http://localhost:3000/auth/auth-code-error?reason=verify_failed&locale=no"
        );
    });
});
