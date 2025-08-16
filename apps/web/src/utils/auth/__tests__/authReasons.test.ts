import { describe, it, expect } from "vitest";
import {
    isAuthReasonToken,
    mapExchangeError,
    mapVerifyError,
    buildAuthErrorUrl,
} from "@/utils/auth/authReasons";

describe("authReasons", () => {
    it("mapExchangeError returns known tokens", () => {
        expect(isAuthReasonToken(mapExchangeError(new Error("invalid_grant")))).toBe(true);
        expect(isAuthReasonToken(mapExchangeError(new Error("code verifier mismatch")))).toBe(true);
        expect(isAuthReasonToken(mapExchangeError("whatever"))).toBe(true);
    });

    it("mapVerifyError returns known tokens", () => {
        expect(isAuthReasonToken(mapVerifyError(new Error("expired token")))).toBe(true);
        expect(isAuthReasonToken(mapVerifyError("random"))).toBe(true);
    });

    it("buildAuthErrorUrl builds expected URL", () => {
        const u = buildAuthErrorUrl(new URL("http://localhost:3000"), "no_code", "no");
        expect(u.toString()).toBe(
            "http://localhost:3000/auth/auth-code-error?reason=no_code&locale=no"
        );
    });
});
