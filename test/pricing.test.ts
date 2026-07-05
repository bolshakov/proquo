import {describe, expect, it} from "vitest";
import {price} from "../src/pricing";

describe("price", () => {
    it("prices a small PR without a split nudge", () => {
        // minutes(100) = round(5 + 12.5 * 1.25) = 21, dollars = round(21 * 1.25) = 26
        expect(price(100, 1.25)).toEqual({minutes: 21, dollars: 26, splitNudge: null});
    });

    it("prices the 400-line quality-collapse point without a nudge", () => {
        // minutes(400) = round(5 + 50 * 2) = 105
        expect(price(400, 1.25)).toEqual({minutes: 105, dollars: 131, splitNudge: null});
    });

    it("adds a split nudge above 400 effective lines", () => {
        // minutes(800) = round(5 + 100 * 3) = 305, minutes(400) = 105, saved = 305 - 210 = 95
        expect(price(800, 1.25)).toEqual({
            minutes: 305,
            dollars: 381,
            splitNudge: {halfMinutes: 105, savedMinutes: 95},
        });
    });

    it("prices an empty diff at zero", () => {
        expect(price(0, 1.25)).toEqual({minutes: 0, dollars: 0, splitNudge: null});
    });
});
