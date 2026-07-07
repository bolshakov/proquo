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
});
