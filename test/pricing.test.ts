import {describe, expect, it} from "vitest";
import {price} from "../src/pricing";

describe("price", () => {
    it("prices a trivial PR at the one-minute floor", () => {
        // minutes(4) = round(0.5 * 1.01) = 1
        expect(price(4)).toEqual({minutes: 1, splitNudge: null});
    });

    it("never rounds a non-empty diff down to zero minutes", () => {
        expect(price(1).minutes).toBe(1);
    });

    it("prices a small PR without a split nudge", () => {
        // minutes(100) = round(12.5 * 1.25) = 16
        expect(price(100)).toEqual({minutes: 16, splitNudge: null});
    });

    it("prices the 400-line quality-collapse point without a nudge", () => {
        // minutes(400) = round(50 * 2) = 100
        expect(price(400)).toEqual({minutes: 100, splitNudge: null});
    });

    it("adds a split nudge above 400 effective lines", () => {
        // minutes(800) = round(100 * 3) = 300, minutes(400) = 100, saved = 300 - 200 = 100
        expect(price(800)).toEqual({
            minutes: 300,
            splitNudge: {halfMinutes: 100, savedMinutes: 100},
        });
    });

    it("prices an empty diff at zero", () => {
        expect(price(0)).toEqual({minutes: 0, splitNudge: null});
    });
});
