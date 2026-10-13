import { describe, expect, it } from "vitest";
import { LIBRARY_ACCOUNT_PATTERN } from "../member";

describe("LIBRARY_ACCOUNT_PATTERN", () => {
    // Browsers compile an input's `pattern` like this, and skip it if it doesn't compile.
    const asBrowser = () => new RegExp(`^(?:${LIBRARY_ACCOUNT_PATTERN})$`, "v");

    it("is a valid HTML pattern", () => {
        expect(asBrowser).not.toThrow();
    });

    it.each(["fredrik", "a-b.c_d", "A1", "x".repeat(64)])("accepts %j", (account) => {
        expect(asBrowser().test(account)).toBe(true);
    });

    it.each(["", "eve smith", "a/b", "ålesund", "x".repeat(65)])("rejects %j", (account) => {
        expect(asBrowser().test(account)).toBe(false);
    });
});
