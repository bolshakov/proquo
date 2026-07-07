import {describe, expect, it} from "vitest";
import {effectiveSize} from "../src/size";
import {DEFAULT_CONFIG, type ProquoConfig} from "../src/config";

describe("effectiveSize", () => {
    it("sums additions and deletions of source files", () => {
        const result = effectiveSize(
            [
                {filename: "src/a.ts", additions: 10, deletions: 5},
                {filename: "src/b.ts", additions: 20, deletions: 0},
            ],
            DEFAULT_CONFIG,
        );
        expect(result).toEqual({effectiveLines: 35, excludedLines: 0, excludedFiles: 0, pricedFiles: 2});
    });

    it("routes excluded files into excluded counters", () => {
        const result = effectiveSize(
            [
                {filename: "src/a.ts", additions: 10, deletions: 0},
                {filename: "package-lock.json", additions: 900, deletions: 300},
            ],
            DEFAULT_CONFIG,
        );
        expect(result).toEqual({effectiveLines: 10, excludedLines: 1200, excludedFiles: 1, pricedFiles: 1});
    });

    it("returns zeros for an empty PR", () => {
        expect(effectiveSize([], DEFAULT_CONFIG)).toEqual({
            effectiveLines: 0,
            excludedLines: 0,
            excludedFiles: 0,
            pricedFiles: 0,
        });
    });

    it("down-weights a test file per the default 0.5 test-file weight", () => {
        const result = effectiveSize(
            [
                {filename: "src/feature.ts", additions: 40, deletions: 0},
                {filename: "src/feature.test.ts", additions: 60, deletions: 0},
            ],
            DEFAULT_CONFIG,
        );
        // 40 * 1 + 60 * 0.5 = 70
        expect(result).toEqual({effectiveLines: 70, excludedLines: 0, excludedFiles: 0, pricedFiles: 2});
    });

    it("rounds the weighted sum to the nearest whole line", () => {
        const config: ProquoConfig = {
            exclude: DEFAULT_CONFIG.exclude,
            weights: [{pattern: "**/*.md", weight: 0.3}],
            commentWeight: DEFAULT_CONFIG.commentWeight,
        };
        const result = effectiveSize([{filename: "README.md", additions: 5, deletions: 0}], config);
        // 5 * 0.3 = 1.5 -> rounds to 2
        expect(result).toEqual({effectiveLines: 2, excludedLines: 0, excludedFiles: 0, pricedFiles: 1});
    });

    it("counts priced files separately from excluded files when both are present", () => {
        const result = effectiveSize(
            [
                {filename: "src/a.ts", additions: 1, deletions: 0},
                {filename: "src/b.ts", additions: 1, deletions: 0},
                {filename: "src/c.ts", additions: 1, deletions: 0},
                {filename: "package-lock.json", additions: 900, deletions: 0},
            ],
            DEFAULT_CONFIG,
        );
        expect(result.pricedFiles).toBe(3);
        expect(result.excludedFiles).toBe(1);
    });

    it("down-weights comment-only lines using the per-line patch when available", () => {
        const patch = ["@@ -1,2 +1,2 @@", "+// a comment", "+const x = 1;"].join("\n");
        const result = effectiveSize(
            [{filename: "src/a.ts", additions: 2, deletions: 0, patch}],
            DEFAULT_CONFIG,
        );
        // 1 comment line * 0.3 + 1 code line * 1 = 1.3 -> rounds to 1
        expect(result.effectiveLines).toBe(1);
    });

    it("falls back to the per-file weight when no patch is available", () => {
        const result = effectiveSize([{filename: "src/a.ts", additions: 2, deletions: 0}], DEFAULT_CONFIG);
        expect(result.effectiveLines).toBe(2);
    });

    it("falls back to the per-file weight when the language is unrecognized", () => {
        const patch = ["@@ -1,1 +1,1 @@", "+# not a real config"].join("\n");
        const result = effectiveSize(
            [{filename: "Dockerfile", additions: 1, deletions: 0, patch}],
            DEFAULT_CONFIG,
        );
        expect(result.effectiveLines).toBe(1);
    });

    it("falls back to the per-file weight when the patch line count doesn't match additions+deletions (e.g. a truncated GitHub patch)", () => {
        const patch = ["@@ -1,1 +1,1 @@", "+// only one line visible"].join("\n");
        const result = effectiveSize(
            [{filename: "src/a.ts", additions: 5, deletions: 0, patch}],
            DEFAULT_CONFIG,
        );
        expect(result.effectiveLines).toBe(5);
    });

    it("multiplies the file weight and the comment weight for a comment line in an already down-weighted file", () => {
        const patch = ["@@ -1,1 +1,1 @@", "+// a comment in a test file"].join("\n");
        const result = effectiveSize(
            [{filename: "src/a.test.ts", additions: 1, deletions: 0, patch}],
            DEFAULT_CONFIG,
        );
        // 1 line * 0.5 (test-file weight) * 0.3 (comment weight) = 0.15 -> rounds to 0
        expect(result.effectiveLines).toBe(0);
    });
});
