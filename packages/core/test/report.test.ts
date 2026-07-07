import {describe, expect, it} from "vitest";
import {
    computeDelta,
    fileSpreadNote,
    footnoteParts,
    formatNumber,
    formatRange,
    tierTail,
} from "../src/report";
import type {Price} from "../src/pricing";

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
