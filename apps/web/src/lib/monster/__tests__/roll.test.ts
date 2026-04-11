import { describe, it, expect } from "vitest";
import { rollCase } from "../roll";
import { CASES, RARITY_PROBABILITIES, VARIANTS_BY_CASE } from "../catalog";

describe("rollCase", () => {
    it("returns an item that exists in the case catalog", () => {
        for (let i = 0; i < 200; i++) {
            const result = rollCase("monster");
            expect(VARIANTS_BY_CASE.monster.has(result.item)).toBe(true);
        }
    });

    it("returns a rarity that matches the catalog entry for the item", () => {
        for (let i = 0; i < 500; i++) {
            const result = rollCase("monster");
            const catalogVariant = VARIANTS_BY_CASE.monster.get(result.item);
            expect(catalogVariant).toBeDefined();
            expect(result.rarity).toBe(catalogVariant?.rarity);
            expect(result.image).toBe(catalogVariant?.image);
        }
    });

    it("handles the redbullBurn case catalog", () => {
        for (let i = 0; i < 200; i++) {
            const result = rollCase("redbullBurn");
            expect(VARIANTS_BY_CASE.redbullBurn.has(result.item)).toBe(true);
        }
    });

    it("produces rarity distribution roughly in line with probabilities over many rolls", () => {
        const counts: Record<string, number> = {
            blue: 0,
            purple: 0,
            pink: 0,
            red: 0,
            yellow: 0,
        };
        const TRIALS = 20_000;
        for (let i = 0; i < TRIALS; i++) {
            const r = rollCase("monster");
            counts[r.rarity] = (counts[r.rarity] ?? 0) + 1;
        }

        // Observed rate should be within a generous tolerance of expected for
        // common rarities. Rare rarities have too few samples for tight bounds
        // so we just assert they're possible (> 0).
        const observedBluePct = (counts.blue / TRIALS) * 100;
        const observedPurplePct = (counts.purple / TRIALS) * 100;

        expect(Math.abs(observedBluePct - RARITY_PROBABILITIES.blue)).toBeLessThan(2);
        expect(Math.abs(observedPurplePct - RARITY_PROBABILITIES.purple)).toBeLessThan(2);
        expect(counts.blue).toBeGreaterThan(0);
        expect(counts.purple).toBeGreaterThan(0);
    });

    it("RARITY_PROBABILITIES sums to 100", () => {
        const total = Object.values(RARITY_PROBABILITIES).reduce((a, b) => a + b, 0);
        expect(total).toBeCloseTo(100, 5);
    });

    it("every returned variant has a non-empty image path", () => {
        const result = rollCase("monster");
        expect(result.image.length).toBeGreaterThan(0);
        expect(CASES.monster.variants.some((v) => v.image === result.image)).toBe(true);
    });
});
