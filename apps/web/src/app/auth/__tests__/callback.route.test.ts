import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as callbackGET } from "../callback/route";
import { mkReq } from "@/tests/testUtils";

vi.mock("@/i18n/resolve-locale", () => ({ resolveLocale: async () => "no" }));
vi.mock("@/app/auth/actions/ensureDefaultRole", () => ({ ensureDefaultRole: vi.fn() }));

const exchangeCodeForSession = vi.fn();
vi.mock("@/utils/supabase/server", () => ({
    createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("/auth/callback", () => {
    it("no code → redirects with no_code", async () => {
        const res = await callbackGET(
            mkReq("http://localhost:3000/auth/callback?locale=no&next=/no/dashboard")
        );
        expect(res.headers.get("location")).toBe(
            "http://localhost:3000/auth/auth-code-error?reason=no_code&locale=no"
        );
    });

    it("exchange success → redirect to next", async () => {
        exchangeCodeForSession.mockResolvedValueOnce({ error: null });
        const res = await callbackGET(
            mkReq("http://localhost:3000/auth/callback?locale=no&next=/no/dashboard&code=abc")
        );
        expect(res.headers.get("location")).toBe("http://localhost:3000/no/dashboard");
    });

    it("exchange failure → exchange_failed", async () => {
        exchangeCodeForSession.mockResolvedValueOnce({ error: new Error("invalid_grant") });
        const res = await callbackGET(
            mkReq("http://localhost:3000/auth/callback?locale=no&next=/no/dashboard&code=abc")
        );
        expect(res.headers.get("location")).toBe(
            "http://localhost:3000/auth/auth-code-error?reason=exchange_failed&locale=no"
        );
    });
});
