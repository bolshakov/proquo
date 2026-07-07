import {describe, expect, it} from "vitest";
import {MARKER, parsePreviousPrice, renderComment} from "../src/comment";
import type {Price} from "@proquo/core";

const size = {effectiveLines: 312, excludedLines: 1204, excludedFiles: 2, pricedFiles: 5};

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
        const body = renderComment({effectiveLines: 50, excludedLines: 0, excludedFiles: 0, pricedFiles: 1}, greenPrice);
        expect(body).toContain("🟢 **50 effective lines**");
        expect(body).toContain("**6–15 min**");
        expect(body).toContain("This is within the range where reviewers find the most issues per line");
    });

    it("renders no-range estimate when range bounds are equal", () => {
        const price = {lowerMinutes: 5, upperMinutes: 5, tier: "green", sessionFlag: false, splitNudge: false}
        const body = renderComment({effectiveLines: 50, excludedLines: 0, excludedFiles: 0, pricedFiles: 1}, price);
        expect(body).toContain("**5 min**");
    })

    it("renders the yellow zone", () => {
        const body = renderComment(size, yellowPrice);
        expect(body).toContain("🟡 **312 effective lines**");
        expect(body).toContain("**39–96 min**");
        expect(body).toContain("400 lines is the upper limit");
    });

    it("adds the session note to the footnote in yellow only when it fires", () => {
        const withSession = renderComment(size, yellowPrice);
        expect(withSession).toContain("runs longer than the ~60-minute session");

        const withoutSession = renderComment(size, yellowNoSessionPrice);
        expect(withoutSession).not.toContain("runs longer than the ~60-minute session");
    });

    it("renders the red zone with the split nudge and no saved-minutes arithmetic", () => {
        const body = renderComment({effectiveLines: 800, excludedLines: 0, excludedFiles: 0, pricedFiles: 3}, redPrice);
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
        const body = renderComment({effectiveLines: 50, excludedLines: 0, excludedFiles: 0, pricedFiles: 1}, greenPrice);
        expect(body).not.toContain("excluded");
    });

    it("handles an effectively empty diff", () => {
        const body = renderComment(
            {effectiveLines: 0, excludedLines: 900, excludedFiles: 1, pricedFiles: 0},
            {lowerMinutes: 0, upperMinutes: 0, tier: "green", sessionFlag: false, splitNudge: false},
        );
        expect(body).toContain("no effective source changes");
    });

    it("embeds a machine-parsable price-data comment", () => {
        const body = renderComment(size, yellowPrice);
        expect(body).toContain('<!-- review-economy:price-data {"lowerMinutes":39,"upperMinutes":96} -->');
    });

    it("shows a delta line with the full previous range when the average dropped", () => {
        // previous avg (70+130)/2=100, current avg (39+96)/2=67.5 -> 32.5% down, well past the 1% gate
        const body = renderComment(size, yellowPrice, {lowerMinutes: 70, upperMinutes: 130});
        expect(body).toContain("down from 70–130 min");
    });

    it("places the delta clause inline right after the current range", () => {
        const price: Price = {lowerMinutes: 20, upperMinutes: 50, tier: "yellow", sessionFlag: false, splitNudge: false};
        const body = renderComment(
            {effectiveLines: 167, excludedLines: 0, excludedFiles: 0, pricedFiles: 2},
            price,
            {lowerMinutes: 23, upperMinutes: 57},
        );
        expect(body).toContain("**167 effective lines** — about **20–50 min** (down from 23–57 min) of focused review");
    });

    it("shows a delta line with the full previous range when the average rose", () => {
        // previous avg (10+20)/2=15, current avg 67.5 -> well past the 1% gate
        const body = renderComment(size, yellowPrice, {lowerMinutes: 10, upperMinutes: 20});
        expect(body).toContain("up from 10–20 min");
    });

    it("omits the delta line when the average moved by 1% or less", () => {
        // previous avg 68, current avg 67.5 -> 0.74% move
        const body = renderComment(size, yellowPrice, {lowerMinutes: 68, upperMinutes: 68});
        expect(body).not.toMatch(/(down|up) from/);
    });

    it("omits the delta line when there is no previous price", () => {
        const body = renderComment(size, yellowPrice, null);
        expect(body).not.toMatch(/(down|up) from/);
    });

    it("omits the delta line for an effectively empty diff even with a previous price", () => {
        const body = renderComment(
            {effectiveLines: 0, excludedLines: 0, excludedFiles: 0, pricedFiles: 0},
            {lowerMinutes: 0, upperMinutes: 0, tier: "green", sessionFlag: false, splitNudge: false},
            {lowerMinutes: 40, upperMinutes: 66},
        );
        expect(body).not.toMatch(/(down|up) from/);
    });

    it("adds the file-spread note when priced files reach the threshold", () => {
        const body = renderComment({effectiveLines: 120, excludedLines: 0, excludedFiles: 0, pricedFiles: 10}, greenPrice);
        expect(body).toContain("**Spread across many files.**");
        expect(body).toContain("This PR changes 10 files");
        expect(body).toContain("more than about 9 in 10 PRs touch");
    });

    it("omits the file-spread note just below the threshold", () => {
        const body = renderComment({effectiveLines: 120, excludedLines: 0, excludedFiles: 0, pricedFiles: 9}, greenPrice);
        expect(body).not.toContain("Spread across many files");
    });

    it("omits the file-spread note for a zero-effective-line diff even above the threshold", () => {
        const body = renderComment(
            {effectiveLines: 0, excludedLines: 0, excludedFiles: 0, pricedFiles: 12},
            {lowerMinutes: 0, upperMinutes: 0, tier: "green", sessionFlag: false, splitNudge: false},
        );
        expect(body).toContain("no effective source changes");
        expect(body).not.toContain("Spread across many files");
    });

    it("shows the file-spread note regardless of tier", () => {
        const redBody = renderComment({effectiveLines: 800, excludedLines: 0, excludedFiles: 0, pricedFiles: 15}, redPrice);
        expect(redBody).toContain("Spread across many files");

        const yellowBody = renderComment({effectiveLines: 312, excludedLines: 0, excludedFiles: 0, pricedFiles: 15}, yellowPrice);
        expect(yellowBody).toContain("Spread across many files");
    });

    it("does not change the displayed price range based on file count", () => {
        const fewFiles = renderComment({effectiveLines: 312, excludedLines: 0, excludedFiles: 0, pricedFiles: 2}, yellowPrice);
        const manyFiles = renderComment({effectiveLines: 312, excludedLines: 0, excludedFiles: 0, pricedFiles: 40}, yellowPrice);
        expect(fewFiles).toContain("**39–96 min**");
        expect(manyFiles).toContain("**39–96 min**");
    });
});

describe("parsePreviousPrice", () => {
    it("reads the embedded price-data comment", () => {
        const body = renderComment(size, yellowPrice);
        expect(parsePreviousPrice(body)).toEqual({lowerMinutes: 39, upperMinutes: 96});
    });

    it("returns null when the comment has no price-data marker", () => {
        expect(parsePreviousPrice("some unrelated comment body")).toBeNull();
    });

    it("returns null when the embedded data is malformed", () => {
        const body = "<!-- review-economy:price-data not-json -->";
        expect(parsePreviousPrice(body)).toBeNull();
    });
});
