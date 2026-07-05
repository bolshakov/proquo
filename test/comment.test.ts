import {describe, expect, it} from "vitest";
import {MARKER, renderComment} from "../src/comment";

const size = {effectiveLines: 312, excludedLines: 1204, excludedFiles: 2};
const smallPrice = {minutes: 84, splitNudge: null};

describe("renderComment", () => {
    it("contains the sticky marker", () => {
        expect(renderComment(size, smallPrice)).toContain(MARKER);
    });

    it("states effective size, burden, and exclusions", () => {
        const body = renderComment(size, smallPrice);
        expect(body).toContain("312 effective changed lines");
        expect(body).toContain("~84 min");
        expect(body).toContain("1,204 lines across 2 generated/lockfile files were excluded");
    });

    it("never mentions money", () => {
        expect(renderComment(size, smallPrice)).not.toContain("$");
    });

    it("omits the exclusion line when nothing was excluded", () => {
        const body = renderComment({effectiveLines: 50, excludedLines: 0, excludedFiles: 0}, smallPrice);
        expect(body).not.toContain("excluded");
    });

    it("adds the split nudge when present", () => {
        const body = renderComment(size, {
            minutes: 300,
            splitNudge: {halfMinutes: 100, savedMinutes: 100}
        });
        expect(body).toContain("two PRs of half the size would cost ~100 min each");
        expect(body).toContain("saving ~100 min");
    });

    it("handles an effectively empty diff", () => {
        const body = renderComment({effectiveLines: 0, excludedLines: 900, excludedFiles: 1}, {
            minutes: 0,
            splitNudge: null
        });
        expect(body).toContain("no effective source changes");
    });
});
