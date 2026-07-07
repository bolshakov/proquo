import {describe, expect, it} from "vitest";
import {renderReport} from "../src/report";
import type {Price} from "@proquo/core";

const greenPrice: Price = {lowerMinutes: 12, upperMinutes: 30, tier: "green", sessionFlag: false, splitNudge: false};
const yellowPrice: Price = {lowerMinutes: 39, upperMinutes: 96, tier: "yellow", sessionFlag: true, splitNudge: false};
const redPrice: Price = {lowerMinutes: 96, upperMinutes: 240, tier: "red", sessionFlag: true, splitNudge: true};

describe("renderReport", () => {
    it("reports effective lines and the evidence-based range", () => {
        const out = renderReport({effectiveLines: 100, excludedLines: 0, excludedFiles: 0, pricedFiles: 1}, greenPrice);
        expect(out).toContain("100 effective lines");
        expect(out).toContain("12–30 min");
    });

    it("uses the same tier-zone wording as the action for green", () => {
        const out = renderReport({effectiveLines: 100, excludedLines: 0, excludedFiles: 0, pricedFiles: 1}, greenPrice);
        expect(out).toContain("This is within the range where reviewers find the most issues per line");
        expect(out).not.toContain("evidence-based rates");
    });

    it("uses the same tier-zone wording as the action for yellow", () => {
        const out = renderReport({effectiveLines: 321, excludedLines: 0, excludedFiles: 0, pricedFiles: 3}, yellowPrice);
        expect(out).toContain("Beyond ~200 lines, reviewers tend to find fewer issues per line");
        expect(out).not.toContain("start to drop");
    });

    it("uses the same tier-zone wording as the action for red", () => {
        const out = renderReport({effectiveLines: 800, excludedLines: 0, excludedFiles: 0, pricedFiles: 3}, redPrice);
        expect(out).toContain("more than comfortably fits in a single review session");
        expect(out).not.toContain("more than fits one effective session");
    });

    it("reports no-range estimate when range bounds are equal", () => {
        const price = {lowerMinutes: 5, upperMinutes: 5, tier: "green", sessionFlag: false, splitNudge: false}
        const out = renderReport({effectiveLines: 100, excludedLines: 0, excludedFiles: 0, pricedFiles: 1}, price);
        expect(out).toContain("5 min");
    })

    it("notes excluded generated/lockfile lines when present", () => {
        const out = renderReport({effectiveLines: 100, excludedLines: 1050, excludedFiles: 2, pricedFiles: 1}, greenPrice);
        expect(out).toContain("1,050");
        expect(out).toContain("2 generated/lockfile files");
    });

    it("adds the session note to the footnote in yellow when it fires", () => {
        const out = renderReport({effectiveLines: 321, excludedLines: 0, excludedFiles: 0, pricedFiles: 3}, yellowPrice);
        expect(out).toContain("runs longer than the ~60-minute session");
    });

    it("shows the split nudge above the threshold without saved-minutes arithmetic", () => {
        const out = renderReport({effectiveLines: 800, excludedLines: 0, excludedFiles: 0, pricedFiles: 3}, redPrice);
        expect(out).toContain("Worth splitting?");
        expect(out).toContain("≤200-line PRs");
        expect(out).not.toContain("saving ~");
    });

    it("states negligible burden for an empty effective diff", () => {
        const out = renderReport(
            {effectiveLines: 0, excludedLines: 250, excludedFiles: 1, pricedFiles: 0},
            {lowerMinutes: 0, upperMinutes: 0, tier: "green", sessionFlag: false, splitNudge: false},
        );
        expect(out).toContain("negligible");
    });

    it("never mentions money", () => {
        const out = renderReport({effectiveLines: 800, excludedLines: 0, excludedFiles: 0, pricedFiles: 3}, redPrice);
        expect(out).not.toMatch(/[$€£]/);
        expect(out.toLowerCase()).not.toContain("dollar");
    });

    it("adds the file-spread note when priced files reach the threshold", () => {
        const out = renderReport({effectiveLines: 120, excludedLines: 0, excludedFiles: 0, pricedFiles: 10}, greenPrice);
        expect(out).toContain("Spread across many files.");
        expect(out).toContain("This PR changes 10 files");
        expect(out).toContain("more than about 9 in 10 PRs touch");
    });

    it("omits the file-spread note just below the threshold", () => {
        const out = renderReport({effectiveLines: 120, excludedLines: 0, excludedFiles: 0, pricedFiles: 9}, greenPrice);
        expect(out).not.toContain("Spread across many files");
    });

    it("omits the file-spread note for a zero-effective-line diff even above the threshold", () => {
        const out = renderReport(
            {effectiveLines: 0, excludedLines: 0, excludedFiles: 0, pricedFiles: 12},
            {lowerMinutes: 0, upperMinutes: 0, tier: "green", sessionFlag: false, splitNudge: false},
        );
        expect(out).toContain("negligible");
        expect(out).not.toContain("Spread across many files");
    });

    it("does not change the displayed price range based on file count", () => {
        const fewFiles = renderReport({effectiveLines: 312, excludedLines: 0, excludedFiles: 0, pricedFiles: 2}, yellowPrice);
        const manyFiles = renderReport({effectiveLines: 312, excludedLines: 0, excludedFiles: 0, pricedFiles: 40}, yellowPrice);
        expect(fewFiles).toContain("39–96 min");
        expect(manyFiles).toContain("39–96 min");
    });
});
