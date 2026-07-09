import {describe, expect, it} from "vitest";
import {
    computeDelta,
    fileSpreadNote,
    footnoteParts,
    formatNumber,
    formatRange,
    renderBreakdown,
    tierTail,
} from "../src/report";
import type {Price} from "../src/pricing";
import type {SizeExplanation} from "../src/explain";

const yellowWithSession: Price = {lowerMinutes: 39, upperMinutes: 96, tier: "yellow", sessionFlag: true, splitNudge: false};
const yellowNoSession: Price = {lowerMinutes: 20, upperMinutes: 45, tier: "yellow", sessionFlag: false, splitNudge: false};
const greenPrice: Price = {lowerMinutes: 6, upperMinutes: 15, tier: "green", sessionFlag: false, splitNudge: false};
const redPrice: Price = {lowerMinutes: 96, upperMinutes: 240, tier: "red", sessionFlag: true, splitNudge: true};

describe("formatNumber", () => {
    it("adds thousands separators", () => {
        expect(formatNumber(1204)).toBe("1,204");
    });
});

describe("formatRange", () => {
    it("renders a single value when bounds are equal", () => {
        expect(formatRange(5, 5)).toBe("5 min");
    });

    it("renders a dash-separated range when bounds differ", () => {
        expect(formatRange(39, 96)).toBe("39–96 min");
    });
});

describe("fileSpreadNote", () => {
    it("returns null below the threshold", () => {
        expect(fileSpreadNote(120, 9)).toBeNull();
    });

    it("returns lead/body text at the threshold", () => {
        const note = fileSpreadNote(120, 10);
        expect(note).not.toBeNull();
        expect(note!.lead).toBe("Spread across many files.");
        expect(note!.body).toContain("This PR changes 10 files");
        expect(note!.body).toContain("more than about 9 in 10 PRs touch");
    });

    it("returns null for an effectively empty diff even above the threshold", () => {
        expect(fileSpreadNote(0, 12)).toBeNull();
    });
});

describe("footnoteParts", () => {
    it("returns only the base note outside yellow", () => {
        expect(footnoteParts(greenPrice)).toEqual([expect.stringContaining("careful defect-finding")]);
        expect(footnoteParts(redPrice)).toEqual([expect.stringContaining("careful defect-finding")]);
    });

    it("appends the session note in yellow only when the session flag fires", () => {
        expect(footnoteParts(yellowWithSession)).toHaveLength(2);
        expect(footnoteParts(yellowWithSession)[1]).toContain("runs longer than the ~60-minute session");
        expect(footnoteParts(yellowNoSession)).toHaveLength(1);
    });
});

describe("tierTail", () => {
    it("returns the canonical green-zone sentence", () => {
        expect(tierTail("green")).toBe(
            " (based on 200–500 lines/hour). This is within the range where reviewers find the most issues " +
                "per line, and small changes usually receive feedback the fastest.",
        );
    });

    it("returns the canonical yellow-zone sentence", () => {
        expect(tierTail("yellow")).toBe(
            ". Beyond ~200 lines, reviewers tend to find fewer issues per line, and 400 lines is the upper " +
                "limit recommended by the largest industry study on code reviews.",
        );
    });

    it("returns the canonical red-zone sentence", () => {
        expect(tierTail("red")).toBe(
            ", more than comfortably fits in a single review session. Beyond 400 lines, review effectiveness " +
                "drops and reviewers tend to leave fewer useful comments per line.",
        );
    });
});

describe("computeDelta", () => {
    it("returns null when there is no previous price", () => {
        expect(computeDelta(yellowWithSession, null)).toBeNull();
        expect(computeDelta(yellowWithSession, undefined)).toBeNull();
    });

    it("returns null when the average is unchanged", () => {
        expect(computeDelta(yellowWithSession, {lowerMinutes: 39, upperMinutes: 96})).toBeNull();
    });

    it("returns null when the average moved by 1% or less", () => {
        // previous avg 68, current avg (39+96)/2=67.5 -> 0.74% move
        expect(computeDelta(yellowWithSession, {lowerMinutes: 68, upperMinutes: 68})).toBeNull();
    });

    it("reports a down delta with the full previous range", () => {
        // previous avg 100, current avg 67.5 -> well past the 1% gate
        expect(computeDelta(yellowWithSession, {lowerMinutes: 70, upperMinutes: 130})).toEqual({
            direction: "down",
            previous: {lowerMinutes: 70, upperMinutes: 130},
        });
    });

    it("reports an up delta with the full previous range", () => {
        expect(computeDelta(yellowWithSession, {lowerMinutes: 10, upperMinutes: 20})).toEqual({
            direction: "up",
            previous: {lowerMinutes: 10, upperMinutes: 20},
        });
    });

    it("does not divide by zero when the previous average is zero", () => {
        expect(computeDelta(greenPrice, {lowerMinutes: 0, upperMinutes: 0})).toEqual({
            direction: "up",
            previous: {lowerMinutes: 0, upperMinutes: 0},
        });
    });
});

describe("renderBreakdown", () => {
    it("renders the config summary line when no .proquo.yml was found", () => {
        const explanation: SizeExplanation = {
            size: {effectiveLines: 0, excludedLines: 0, excludedFiles: 0, pricedFiles: 0},
            files: [],
            configFileFound: false,
            customExcludeCount: 0,
            customWeightCount: 0,
            commentWeight: 0.3,
        };
        expect(renderBreakdown(explanation)[0]).toBe(
            "Config: no .proquo.yml found — using built-in defaults (commentWeight 0.3)",
        );
    });

    it("renders the config summary line with custom counts when a .proquo.yml was found", () => {
        const explanation: SizeExplanation = {
            size: {effectiveLines: 0, excludedLines: 0, excludedFiles: 0, pricedFiles: 0},
            files: [],
            configFileFound: true,
            customExcludeCount: 2,
            customWeightCount: 1,
            commentWeight: 0.4,
        };
        expect(renderBreakdown(explanation)[0]).toBe(
            "Config: .proquo.yml found — 2 custom exclude patterns, 1 custom weight rule, commentWeight 0.4",
        );
    });

    it("renders an excluded file with its matched pattern and source", () => {
        const explanation: SizeExplanation = {
            size: {effectiveLines: 0, excludedLines: 120, excludedFiles: 1, pricedFiles: 0},
            files: [
                {
                    filename: "docs/__generated__/x.json",
                    rawLines: 120,
                    excluded: true,
                    exclusionPattern: "**/__generated__/**",
                    exclusionSource: "default",
                },
            ],
            configFileFound: false,
            customExcludeCount: 0,
            customWeightCount: 0,
            commentWeight: 0.3,
        };
        const lines = renderBreakdown(explanation);
        expect(lines).toContain(
            "docs/__generated__/x.json  120 lines  EXCLUDED (default: **/__generated__/**)",
        );
    });

    it("renders a priced file with weight, comment down-weighting, and the weighted total", () => {
        const explanation: SizeExplanation = {
            size: {effectiveLines: 1, excludedLines: 0, excludedFiles: 0, pricedFiles: 1},
            files: [
                {
                    filename: "src/a.test.ts",
                    rawLines: 2,
                    excluded: false,
                    weight: 0.5,
                    weightPattern: "**/*.test.*",
                    weightSource: "default",
                    commentLines: 1,
                    linesSaved: 0.35,
                    weightedLines: 0.65,
                },
            ],
            configFileFound: false,
            customExcludeCount: 0,
            customWeightCount: 0,
            commentWeight: 0.3,
        };
        const lines = renderBreakdown(explanation);
        expect(lines).toContain(
            "src/a.test.ts  2 lines  weight 0.5 (default: **/*.test.*), 1 comment line down-weighted (saved 0.35) → 0.65",
        );
    });

    it("omits the comment clause entirely when a classified file has zero comment lines", () => {
        const explanation: SizeExplanation = {
            size: {effectiveLines: 2, excludedLines: 0, excludedFiles: 0, pricedFiles: 1},
            files: [
                {
                    filename: "src/a.ts",
                    rawLines: 2,
                    excluded: false,
                    weight: 1,
                    commentLines: 0,
                    linesSaved: 0,
                    weightedLines: 2,
                },
            ],
            configFileFound: false,
            customExcludeCount: 0,
            customWeightCount: 0,
            commentWeight: 0.3,
        };
        const lines = renderBreakdown(explanation);
        expect(lines).toContain("src/a.ts  2 lines  weight 1 (no rule matched) → 2.00");
    });

    it("renders a priced file with no matched weight rule as \"no rule matched\"", () => {
        const explanation: SizeExplanation = {
            size: {effectiveLines: 2, excludedLines: 0, excludedFiles: 0, pricedFiles: 1},
            files: [
                {filename: "src/a.ts", rawLines: 2, excluded: false, weight: 1, weightedLines: 2, fallbackReason: "no-patch"},
            ],
            configFileFound: false,
            customExcludeCount: 0,
            customWeightCount: 0,
            commentWeight: 0.3,
        };
        const lines = renderBreakdown(explanation);
        expect(lines).toContain(
            "src/a.ts  2 lines  weight 1 (no rule matched), comment down-weighting skipped (no patch available) → 2.00",
        );
    });

    it("labels an \"unsupported-language\" fallback", () => {
        const explanation: SizeExplanation = {
            size: {effectiveLines: 1, excludedLines: 0, excludedFiles: 0, pricedFiles: 1},
            files: [
                {
                    filename: "Dockerfile",
                    rawLines: 1,
                    excluded: false,
                    weight: 1,
                    weightedLines: 1,
                    fallbackReason: "unsupported-language",
                },
            ],
            configFileFound: false,
            customExcludeCount: 0,
            customWeightCount: 0,
            commentWeight: 0.3,
        };
        const lines = renderBreakdown(explanation);
        expect(lines).toContain(
            "Dockerfile  1 lines  weight 1 (no rule matched), comment down-weighting skipped (unsupported language) → 1.00",
        );
    });

    it("labels a \"classification-mismatch\" fallback", () => {
        const explanation: SizeExplanation = {
            size: {effectiveLines: 5, excludedLines: 0, excludedFiles: 0, pricedFiles: 1},
            files: [
                {
                    filename: "src/a.ts",
                    rawLines: 5,
                    excluded: false,
                    weight: 1,
                    weightedLines: 5,
                    fallbackReason: "classification-mismatch",
                },
            ],
            configFileFound: false,
            customExcludeCount: 0,
            customWeightCount: 0,
            commentWeight: 0.3,
        };
        const lines = renderBreakdown(explanation);
        expect(lines).toContain(
            "src/a.ts  5 lines  weight 1 (no rule matched), comment down-weighting skipped (partial patch) → 5.00",
        );
    });

    it("pluralizes \"comment lines\" when more than one comment line was down-weighted", () => {
        const explanation: SizeExplanation = {
            size: {effectiveLines: 1, excludedLines: 0, excludedFiles: 0, pricedFiles: 1},
            files: [
                {
                    filename: "src/a.test.ts",
                    rawLines: 4,
                    excluded: false,
                    weight: 0.5,
                    weightPattern: "**/*.test.*",
                    weightSource: "default",
                    commentLines: 2,
                    linesSaved: 0.7,
                    weightedLines: 1.3,
                },
            ],
            configFileFound: false,
            customExcludeCount: 0,
            customWeightCount: 0,
            commentWeight: 0.3,
        };
        const lines = renderBreakdown(explanation);
        expect(lines).toContain(
            "src/a.test.ts  4 lines  weight 0.5 (default: **/*.test.*), 2 comment lines down-weighted (saved 0.70) → 1.30",
        );
    });
});
