import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as githubGET } from "../github/route";
import { mkReq } from "@/tests/testUtils";

// Mock getSafeOrigin → always local origin for tests
vi.mock("@/utils/auth/getSafeOrigin", () => ({
    getSafeOrigin: () => "http://localhost:3000",
}));

// Mock resolveLocale → "no"
vi.mock("@/i18n/resolve-locale", () => ({
    resolveLocale: async () => "no",
}));

// Mock Supabase server client
const signInWithOAuth = vi.fn();
vi.mock("@/utils/supabase/server", () => ({
    createClient: async () => ({ auth: { signInWithOAuth } }),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("/auth/github", () => {
    it("redirects to provider when init succeeds", async () => {
        signInWithOAuth.mockResolvedValueOnce({
            data: { url: "https://github.com/login/oauth/authorize?..." },
            error: null,
        });

        const res = await githubGET(
            mkReq("http://localhost:3000/auth/github?locale=no&next=%2Fno%2Fdashboard")
        );
        const loc = res.headers.get("location");
        expect(loc).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize/);

        // Assert our redirectTo param was built (callback URL)
        expect(signInWithOAuth).toHaveBeenCalledWith({
            provider: "github",
            options: { redirectTo: expect.stringContaining("/auth/callback?") },
        });
    });

    it("redirects to error page on init failure", async () => {
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {}); // silence
        signInWithOAuth.mockResolvedValueOnce({ data: null, error: new Error("boom") });

        const res = await githubGET(
            mkReq("http://localhost:3000/auth/github?locale=no&next=%2Fno%2Fdashboard")
        );
        expect(res.headers.get("location")).toBe(
            "http://localhost:3000/auth/auth-code-error?reason=oauth_init_failed&locale=no"
        );

        errSpy.mockRestore();
    });

    it("sanitizes next param (blocks open redirect)", async () => {
        signInWithOAuth.mockResolvedValueOnce({
            data: { url: "https://github.com/login/oauth/authorize?..." },
            error: null,
        });
        await githubGET(mkReq("http://localhost:3000/auth/github?locale=no&next=//evil.com"));
        const call = signInWithOAuth.mock.calls[0][0];
        // the built redirectTo must contain a sanitized next
        const redirectTo = new URL(call.options.redirectTo);
        expect(redirectTo.searchParams.get("next")).toBe("/"); // fell back to "/"
    });
});
