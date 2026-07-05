import {describe, expect, it} from "vitest";
import {renderReport} from "../src/report";
import type {Price} from "@proquo/core";

const greenPrice: Price = {lowerMinutes: 12, upperMinutes: 30, tier: "green", sessionFlag: false, splitNudge: false};
const yellowPrice: Price = {lowerMinutes: 39, upperMinutes: 96, tier: "yellow", sessionFlag: true, splitNudge: false};
const redPrice: Price = {lowerMinutes: 96, upperMinutes: 240, tier: "red", sessionFlag: true, splitNudge: true};

describe("renderReport", () => {
    it("reports effective lines and the evidence-based range", () => {
        const out = renderReport({effectiveLines: 100, excludedLines: 0, excludedFiles: 0}, greenPrice);
        expect(out).toContain("100 effective lines");
        expect(out).toContain("12–30 min");
    });

    it("notes excluded generated/lockfile lines when present", () => {
        const out = renderReport({effectiveLines: 100, excludedLines: 1050, excludedFiles: 2}, greenPrice);
        expect(out).toContain("1,050");
        expect(out).toContain("2 generated/lockfile files");
    });

    it("appends the session clause in yellow when it fires", () => {
        const out = renderReport({effectiveLines: 321, excludedLines: 0, excludedFiles: 0}, yellowPrice);
        expect(out).toContain("longer than the ~60-minute pass");
    });

    it("shows the split nudge above the threshold without saved-minutes arithmetic", () => {
        const out = renderReport({effectiveLines: 800, excludedLines: 0, excludedFiles: 0}, redPrice);
        expect(out).toContain("Worth splitting?");
        expect(out).toContain("≤200-line PRs");
        expect(out).not.toContain("saving ~");
    });

    it("states negligible burden for an empty effective diff", () => {
        const out = renderReport(
            {effectiveLines: 0, excludedLines: 250, excludedFiles: 1},
            {lowerMinutes: 0, upperMinutes: 0, tier: "green", sessionFlag: false, splitNudge: false},
        );
        expect(out).toContain("negligible");
    });

    it("never mentions money", () => {
        const out = renderReport({effectiveLines: 800, excludedLines: 0, excludedFiles: 0}, redPrice);
        expect(out).not.toMatch(/[$€£]/);
        expect(out.toLowerCase()).not.toContain("dollar");
    });
});
