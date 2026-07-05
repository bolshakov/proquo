import {describe, expect, it} from "vitest";
import {MARKER, renderComment} from "../src/comment";

const size = {effectiveLines: 312, excludedLines: 1204, excludedFiles: 2};
const smallPrice = {minutes: 84, dollars: 105, splitNudge: null};

describe("renderComment", () => {
    it("contains the sticky marker", () => {
        expect(renderComment(size, smallPrice)).toContain(MARKER);
    });

    it("states effective size, burden, and exclusions", () => {
        const body = renderComment(size, smallPrice);
        expect(body).toContain("312 effective changed lines");
        expect(body).toContain("~84 min");
        expect(body).toContain("$105");
        expect(body).toContain("1,204 lines across 2 generated/lockfile files were excluded");
    });

    it("omits the exclusion line when nothing was excluded", () => {
        const body = renderComment({effectiveLines: 50, excludedLines: 0, excludedFiles: 0}, smallPrice);
        expect(body).not.toContain("excluded");
    });

    it("adds the split nudge when present", () => {
        const body = renderComment(size, {
            minutes: 305,
            dollars: 381,
            splitNudge: {halfMinutes: 105, savedMinutes: 95}
        });
        expect(body).toContain("two PRs of half the size would cost ~105 min each");
        expect(body).toContain("saving ~95 min");
    });

    it("handles an effectively empty diff", () => {
        const body = renderComment({effectiveLines: 0, excludedLines: 900, excludedFiles: 1}, {
            minutes: 0,
            dollars: 0,
            splitNudge: null
        });
        expect(body).toContain("no effective source changes");
    });
});
