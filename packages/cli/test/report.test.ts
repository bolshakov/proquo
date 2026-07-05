import {describe, expect, it} from "vitest";
import {renderReport} from "../src/report";

describe("renderReport", () => {
    it("reports effective lines and the minute estimate", () => {
        const out = renderReport(
            {effectiveLines: 100, excludedLines: 0, excludedFiles: 0},
            {minutes: 16, splitNudge: null},
        );
        expect(out).toContain("100 effective changed lines");
        expect(out).toContain("~16 min");
    });

    it("notes excluded generated/lockfile lines when present", () => {
        const out = renderReport(
            {effectiveLines: 100, excludedLines: 1050, excludedFiles: 2},
            {minutes: 16, splitNudge: null},
        );
        expect(out).toContain("1050");
        expect(out).toContain("2 generated/lockfile files");
    });

    it("shows the split suggestion above the threshold", () => {
        const out = renderReport(
            {effectiveLines: 800, excludedLines: 0, excludedFiles: 0},
            {minutes: 300, splitNudge: {halfMinutes: 100, savedMinutes: 100}},
        );
        expect(out).toContain("~100 min each");
        expect(out).toContain("saving ~100 min");
    });

    it("states negligible burden for an empty effective diff", () => {
        const out = renderReport(
            {effectiveLines: 0, excludedLines: 250, excludedFiles: 1},
            {minutes: 0, splitNudge: null},
        );
        expect(out).toContain("negligible");
    });

    it("never mentions money", () => {
        const out = renderReport(
            {effectiveLines: 800, excludedLines: 0, excludedFiles: 0},
            {minutes: 300, splitNudge: {halfMinutes: 100, savedMinutes: 100}},
        );
        expect(out).not.toMatch(/[$€£]/);
        expect(out.toLowerCase()).not.toContain("cost");
        expect(out.toLowerCase()).not.toContain("dollar");
    });
});
