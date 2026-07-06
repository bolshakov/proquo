import {describe, expect, it} from "vitest";
import {MARKER, renderComment} from "../src/comment";
import type {Price} from "@proquo/core";

const size = {effectiveLines: 312, excludedLines: 1204, excludedFiles: 2};

const greenPrice: Price = {lowerMinutes: 6, upperMinutes: 15, tier: "green", sessionFlag: false, splitNudge: false};
const yellowPrice: Price = {lowerMinutes: 39, upperMinutes: 96, tier: "yellow", sessionFlag: true, splitNudge: false};
const yellowNoSessionPrice: Price = {
    lowerMinutes: 20,
    upperMinutes: 45,
    tier: "yellow",
    sessionFlag: false,
    splitNudge: false,
};
const redPrice: Price = {lowerMinutes: 96, upperMinutes: 240, tier: "red", sessionFlag: true, splitNudge: true};

describe("renderComment", () => {
    it("contains the sticky marker", () => {
        expect(renderComment(size, greenPrice)).toContain(MARKER);
    });

    it("renders the green zone with the evidence-based range", () => {
        const body = renderComment({effectiveLines: 50, excludedLines: 0, excludedFiles: 0}, greenPrice);
        expect(body).toContain("🟢 **50 effective lines**");
        expect(body).toContain("**6–15 min**");
        expect(body).toContain("size band where reviewers catch the most defects per line");
    });

    it("renders no-range estimate when range bounds are equal", () => {
        const price = {lowerMinutes: 5, upperMinutes: 5, tier: "green", sessionFlag: false, splitNudge: false}
        const body = renderComment({effectiveLines: 50, excludedLines: 0, excludedFiles: 0}, price);
        expect(body).toContain("**5 min**");
    })

    it("renders the yellow zone", () => {
        const body = renderComment(size, yellowPrice);
        expect(body).toContain("🟡 **312 effective lines**");
        expect(body).toContain("**39–96 min**");
        expect(body).toContain("400 is the ceiling");
    });

    it("adds the session note to the footnote in yellow only when it fires", () => {
        const withSession = renderComment(size, yellowPrice);
        expect(withSession).toContain("runs longer than the ~60-minute session");

        const withoutSession = renderComment(size, yellowNoSessionPrice);
        expect(withoutSession).not.toContain("runs longer than the ~60-minute session");
    });

    it("renders the red zone with the split nudge and no saved-minutes arithmetic", () => {
        const body = renderComment({effectiveLines: 800, excludedLines: 0, excludedFiles: 0}, redPrice);
        expect(body).toContain("🔴 **800 effective lines**");
        expect(body).toContain("**96–240 min**");
        expect(body).toContain("Worth splitting?");
        expect(body).toContain("≤200-line PRs");
        expect(body).not.toContain("saving ~");
        expect(body).not.toMatch(/half.*min each/);
    });

    it("omits the split nudge outside the red zone", () => {
        const body = renderComment(size, yellowPrice);
        expect(body).not.toContain("Worth splitting?");
    });

    it("puts the explanation behind a collapsed details disclosure", () => {
        const body = renderComment(size, yellowPrice);
        expect(body).toContain("<details>");
        expect(body).toContain("<summary>");
        expect(body).toContain("</details>");
        expect(body).toContain("not how long a skim takes");
        expect(body).not.toContain("superlinear");
    });

    it("nests the session note inside the same disclosure, after the summary", () => {
        const body = renderComment(size, yellowPrice);
        const detailsStart = body.indexOf("<details>");
        const summaryEnd = body.indexOf("</summary>");
        const sessionNoteIndex = body.indexOf("runs longer than the ~60-minute session");
        const detailsEnd = body.indexOf("</details>");
        expect(detailsStart).toBeGreaterThanOrEqual(0);
        expect(sessionNoteIndex).toBeGreaterThan(summaryEnd);
        expect(sessionNoteIndex).toBeLessThan(detailsEnd);
    });

    it("never mentions money", () => {
        expect(renderComment(size, greenPrice)).not.toContain("$");
    });

    it("states the exclusion line when files were excluded", () => {
        const body = renderComment(size, greenPrice);
        expect(body).toContain("1,204 lines across 2 generated/lockfile files were excluded from the price");
    });

    it("omits the exclusion line when nothing was excluded", () => {
        const body = renderComment({effectiveLines: 50, excludedLines: 0, excludedFiles: 0}, greenPrice);
        expect(body).not.toContain("excluded");
    });

    it("handles an effectively empty diff", () => {
        const body = renderComment(
            {effectiveLines: 0, excludedLines: 900, excludedFiles: 1},
            {lowerMinutes: 0, upperMinutes: 0, tier: "green", sessionFlag: false, splitNudge: false},
        );
        expect(body).toContain("no effective source changes");
    });
});
