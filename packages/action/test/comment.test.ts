import {describe, expect, it} from "vitest";
import {
    buildPriceHistory,
    MARKER,
    parsePriceHistory,
    renderComment,
    snapshotFrom,
    type PriceHistory,
    type PriceSnapshot,
} from "../src/comment";
import type {Price, SizeResult} from "@proquo/core";

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

function snapshotFor(price: Price, size: SizeResult): PriceSnapshot {
    return snapshotFrom(price, size, "2024-01-01T00:00:00.000Z");
}

function historyFor(price: Price, size: SizeResult): PriceHistory {
    const snapshot = snapshotFor(price, size);
    return {version: 1, first: snapshot, current: snapshot, revisions: 1};
}

describe("renderComment", () => {
    it("contains the sticky marker", () => {
        expect(renderComment(size, greenPrice, historyFor(greenPrice, size))).toContain(MARKER);
    });

    it("renders the green zone with the evidence-based range", () => {
        const s = {effectiveLines: 50, excludedLines: 0, excludedFiles: 0, pricedFiles: 1};
        const body = renderComment(s, greenPrice, historyFor(greenPrice, s));
        expect(body).toContain("🟢 **50 effective lines**");
        expect(body).toContain("**6–15 min**");
        expect(body).toContain("This is within the range where reviewers find the most issues per line");
    });

    it("renders no-range estimate when range bounds are equal", () => {
        const price: Price = {lowerMinutes: 5, upperMinutes: 5, tier: "green", sessionFlag: false, splitNudge: false};
        const s = {effectiveLines: 50, excludedLines: 0, excludedFiles: 0, pricedFiles: 1};
        const body = renderComment(s, price, historyFor(price, s));
        expect(body).toContain("**5 min**");
    });

    it("renders the yellow zone", () => {
        const body = renderComment(size, yellowPrice, historyFor(yellowPrice, size));
        expect(body).toContain("🟡 **312 effective lines**");
        expect(body).toContain("**39–96 min**");
        expect(body).toContain("400 lines is the upper limit");
    });

    it("adds the session note to the footnote in yellow only when it fires", () => {
        const withSession = renderComment(size, yellowPrice, historyFor(yellowPrice, size));
        expect(withSession).toContain("runs longer than the ~60-minute session");

        const withoutSession = renderComment(size, yellowNoSessionPrice, historyFor(yellowNoSessionPrice, size));
        expect(withoutSession).not.toContain("runs longer than the ~60-minute session");
    });

    it("renders the red zone with the split nudge and no saved-minutes arithmetic", () => {
        const s = {effectiveLines: 800, excludedLines: 0, excludedFiles: 0, pricedFiles: 3};
        const body = renderComment(s, redPrice, historyFor(redPrice, s));
        expect(body).toContain("🔴 **800 effective lines**");
        expect(body).toContain("**96–240 min**");
        expect(body).toContain("Worth splitting?");
        expect(body).toContain("≤200-line PRs");
        expect(body).not.toContain("saving ~");
        expect(body).not.toMatch(/half.*min each/);
    });

    it("omits the split nudge outside the red zone", () => {
        const body = renderComment(size, yellowPrice, historyFor(yellowPrice, size));
        expect(body).not.toContain("Worth splitting?");
    });

    it("puts the explanation behind a collapsed details disclosure", () => {
        const body = renderComment(size, yellowPrice, historyFor(yellowPrice, size));
        expect(body).toContain("<details>");
        expect(body).toContain("<summary>");
        expect(body).toContain("</details>");
        expect(body).toContain("not how long a skim takes");
        expect(body).not.toContain("superlinear");
    });

    it("nests the session note inside the same disclosure, after the summary", () => {
        const body = renderComment(size, yellowPrice, historyFor(yellowPrice, size));
        const detailsStart = body.indexOf("<details>");
        const summaryEnd = body.indexOf("</summary>");
        const sessionNoteIndex = body.indexOf("runs longer than the ~60-minute session");
        const detailsEnd = body.indexOf("</details>");
        expect(detailsStart).toBeGreaterThanOrEqual(0);
        expect(sessionNoteIndex).toBeGreaterThan(summaryEnd);
        expect(sessionNoteIndex).toBeLessThan(detailsEnd);
    });

    it("never mentions money", () => {
        expect(renderComment(size, greenPrice, historyFor(greenPrice, size))).not.toContain("$");
    });

    it("states the exclusion line when files were excluded", () => {
        const body = renderComment(size, greenPrice, historyFor(greenPrice, size));
        expect(body).toContain("1,204 lines across 2 generated/lockfile files were excluded from the price");
    });

    it("omits the exclusion line when nothing was excluded", () => {
        const s = {effectiveLines: 50, excludedLines: 0, excludedFiles: 0, pricedFiles: 1};
        const body = renderComment(s, greenPrice, historyFor(greenPrice, s));
        expect(body).not.toContain("excluded");
    });

    it("handles an effectively empty diff", () => {
        const s = {effectiveLines: 0, excludedLines: 900, excludedFiles: 1, pricedFiles: 0};
        const p: Price = {lowerMinutes: 0, upperMinutes: 0, tier: "green", sessionFlag: false, splitNudge: false};
        const body = renderComment(s, p, historyFor(p, s));
        expect(body).toContain("no effective source changes");
    });

    it("embeds a machine-parsable price-history comment", () => {
        const history = historyFor(yellowPrice, size);
        const body = renderComment(size, yellowPrice, history);
        expect(body).toContain(`<!-- review-economy:price-data ${JSON.stringify(history)} -->`);
    });

    it("shows a delta line with the full previous range when the average dropped", () => {
        const body = renderComment(size, yellowPrice, historyFor(yellowPrice, size), {lowerMinutes: 70, upperMinutes: 130});
        expect(body).toContain("down from 70–130 min");
    });

    it("places the delta clause inline right after the current range", () => {
        const price: Price = {lowerMinutes: 20, upperMinutes: 50, tier: "yellow", sessionFlag: false, splitNudge: false};
        const s = {effectiveLines: 167, excludedLines: 0, excludedFiles: 0, pricedFiles: 2};
        const body = renderComment(s, price, historyFor(price, s), {lowerMinutes: 23, upperMinutes: 57});
        expect(body).toContain("**167 effective lines** — about **20–50 min** (down from 23–57 min) of focused review");
    });

    it("shows a delta line with the full previous range when the average rose", () => {
        const body = renderComment(size, yellowPrice, historyFor(yellowPrice, size), {lowerMinutes: 10, upperMinutes: 20});
        expect(body).toContain("up from 10–20 min");
    });

    it("omits the delta line when the average moved by 1% or less", () => {
        const body = renderComment(size, yellowPrice, historyFor(yellowPrice, size), {lowerMinutes: 68, upperMinutes: 68});
        expect(body).not.toMatch(/(down|up) from/);
    });

    it("omits the delta line when there is no previous price", () => {
        const body = renderComment(size, yellowPrice, historyFor(yellowPrice, size), null);
        expect(body).not.toMatch(/(down|up) from/);
    });

    it("omits the delta line for an effectively empty diff even with a previous price", () => {
        const s = {effectiveLines: 0, excludedLines: 0, excludedFiles: 0, pricedFiles: 0};
        const p: Price = {lowerMinutes: 0, upperMinutes: 0, tier: "green", sessionFlag: false, splitNudge: false};
        const body = renderComment(s, p, historyFor(p, s), {lowerMinutes: 40, upperMinutes: 66});
        expect(body).not.toMatch(/(down|up) from/);
    });

    it("adds the file-spread note when priced files reach the threshold", () => {
        const s = {effectiveLines: 120, excludedLines: 0, excludedFiles: 0, pricedFiles: 10};
        const body = renderComment(s, greenPrice, historyFor(greenPrice, s));
        expect(body).toContain("**Spread across many files.**");
        expect(body).toContain("This PR changes 10 files");
        expect(body).toContain("more than about 9 in 10 PRs touch");
    });

    it("omits the file-spread note just below the threshold", () => {
        const s = {effectiveLines: 120, excludedLines: 0, excludedFiles: 0, pricedFiles: 9};
        const body = renderComment(s, greenPrice, historyFor(greenPrice, s));
        expect(body).not.toContain("Spread across many files");
    });

    it("omits the file-spread note for a zero-effective-line diff even above the threshold", () => {
        const s = {effectiveLines: 0, excludedLines: 0, excludedFiles: 0, pricedFiles: 12};
        const p: Price = {lowerMinutes: 0, upperMinutes: 0, tier: "green", sessionFlag: false, splitNudge: false};
        const body = renderComment(s, p, historyFor(p, s));
        expect(body).toContain("no effective source changes");
        expect(body).not.toContain("Spread across many files");
    });

    it("shows the file-spread note regardless of tier", () => {
        const redSize = {effectiveLines: 800, excludedLines: 0, excludedFiles: 0, pricedFiles: 15};
        const redBody = renderComment(redSize, redPrice, historyFor(redPrice, redSize));
        expect(redBody).toContain("Spread across many files");

        const yellowSize = {effectiveLines: 312, excludedLines: 0, excludedFiles: 0, pricedFiles: 15};
        const yellowBody = renderComment(yellowSize, yellowPrice, historyFor(yellowPrice, yellowSize));
        expect(yellowBody).toContain("Spread across many files");
    });

    it("does not change the displayed price range based on file count", () => {
        const fewSize = {effectiveLines: 312, excludedLines: 0, excludedFiles: 0, pricedFiles: 2};
        const manySize = {effectiveLines: 312, excludedLines: 0, excludedFiles: 0, pricedFiles: 40};
        const fewFiles = renderComment(fewSize, yellowPrice, historyFor(yellowPrice, fewSize));
        const manyFiles = renderComment(manySize, yellowPrice, historyFor(yellowPrice, manySize));
        expect(fewFiles).toContain("**39–96 min**");
        expect(manyFiles).toContain("**39–96 min**");
    });
});

describe("parsePriceHistory", () => {
    it("round-trips through priceHistoryComment via renderComment", () => {
        const history = historyFor(yellowPrice, size);
        const body = renderComment(size, yellowPrice, history);
        expect(parsePriceHistory(body)).toEqual(history);
    });

    it("returns null when the comment has no price-data marker", () => {
        expect(parsePriceHistory("some unrelated comment body")).toBeNull();
    });

    it("returns null when the embedded data is malformed", () => {
        const body = "<!-- review-economy:price-data not-json -->";
        expect(parsePriceHistory(body)).toBeNull();
    });

    it("returns null for the old lowerMinutes/upperMinutes-only shape", () => {
        const body = '<!-- review-economy:price-data {"lowerMinutes":39,"upperMinutes":96} -->';
        expect(parsePriceHistory(body)).toBeNull();
    });

    it("returns null for an unknown version", () => {
        const history = {...historyFor(yellowPrice, size), version: 2};
        const body = `<!-- review-economy:price-data ${JSON.stringify(history)} -->`;
        expect(parsePriceHistory(body)).toBeNull();
    });

    it("returns null when a snapshot has an invalid tier", () => {
        const history = historyFor(yellowPrice, size);
        const corrupted = {...history, current: {...history.current, tier: "blue"}};
        const body = `<!-- review-economy:price-data ${JSON.stringify(corrupted)} -->`;
        expect(parsePriceHistory(body)).toBeNull();
    });

    it("returns null when a snapshot is missing a required field", () => {
        const history = historyFor(yellowPrice, size);
        const {pricedFiles, ...rest} = history.current;
        const corrupted = {...history, current: rest};
        const body = `<!-- review-economy:price-data ${JSON.stringify(corrupted)} -->`;
        expect(parsePriceHistory(body)).toBeNull();
    });
});

describe("buildPriceHistory", () => {
    it("starts a fresh history when there is no existing one", () => {
        const snapshot = snapshotFor(greenPrice, size);
        const history = buildPriceHistory(null, snapshot);
        expect(history).toEqual({version: 1, first: snapshot, current: snapshot, revisions: 1});
    });

    it("keeps the first snapshot and replaces current on a later run", () => {
        const firstSnapshot = snapshotFor(redPrice, size);
        const existing = buildPriceHistory(null, firstSnapshot);
        const laterSnapshot = snapshotFor(greenPrice, size);
        const history = buildPriceHistory(existing, laterSnapshot);
        expect(history).toEqual({version: 1, first: firstSnapshot, current: laterSnapshot, revisions: 2});
    });

    it("increments revisions on every subsequent run", () => {
        const snapshot = snapshotFor(greenPrice, size);
        const run1 = buildPriceHistory(null, snapshot);
        const run2 = buildPriceHistory(run1, snapshot);
        const run3 = buildPriceHistory(run2, snapshot);
        expect(run3.revisions).toBe(3);
    });
});
