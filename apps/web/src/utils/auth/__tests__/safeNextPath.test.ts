import { describe, it, expect } from "vitest";
import { safeNextPath } from "../../auth/safeNextPath";

describe("safeNextPath", () => {
    it("allows /no/dashboard", () => {
        expect(safeNextPath("/no/dashboard")).toBe("/no/dashboard");
    });
    it("blocks protocol-relative", () => {
        expect(safeNextPath("//evil.com")).toBe("/");
    });
    it("blocks schemes & encoded colon", () => {
        expect(safeNextPath("http://evil.com")).toBe("/");
        expect(safeNextPath("/x%3Ay")).toBe("/");
    });
});
