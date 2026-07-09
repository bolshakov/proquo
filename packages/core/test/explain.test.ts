import {describe, expect, it} from "vitest";
import {explainSize} from "../src/explain";
import {effectiveSize} from "../src/size";
import {DEFAULT_CONFIG, mergeConfig, type ProquoConfig} from "../src/config";

describe("explainSize", () => {
    it("records an excluded file's matched pattern and source", () => {
        const result = explainSize(
            [{filename: "package-lock.json", additions: 900, deletions: 300}],
            DEFAULT_CONFIG,
        );
        expect(result.files).toEqual([
            {
                filename: "package-lock.json",
                rawLines: 1200,
                excluded: true,
                exclusionPattern: "**/package-lock.json",
                exclusionSource: "default",
            },
        ]);
        expect(result.size).toEqual({effectiveLines: 0, excludedLines: 1200, excludedFiles: 1, pricedFiles: 0});
    });

    it("records a priced file's weight, source, comment count, and lines saved", () => {
        const patch = ["@@ -1,2 +1,2 @@", "+// a comment", "+const x = 1;"].join("\n");
        const result = explainSize(
            [{filename: "src/a.test.ts", additions: 2, deletions: 0, patch}],
            DEFAULT_CONFIG,
        );
        // weight 0.5 (test file); comment line 0.5*0.3=0.15, code line 0.5*1=0.5 -> weightedLines 0.65
        // flat weight would have been 0.5*2=1, so linesSaved = 1 - 0.65 = 0.35
        expect(result.files).toEqual([
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
        ]);
    });

    it("tags a fallback file with fallbackReason \"no-patch\" and omits commentLines/linesSaved", () => {
        const result = explainSize([{filename: "src/a.ts", additions: 2, deletions: 0}], DEFAULT_CONFIG);
        expect(result.files).toEqual([
            {
                filename: "src/a.ts",
                rawLines: 2,
                excluded: false,
                weight: 1,
                weightedLines: 2,
                fallbackReason: "no-patch",
            },
        ]);
    });

    it("tags a fallback file with fallbackReason \"unsupported-language\"", () => {
        const patch = ["@@ -1,1 +1,1 @@", "+# not a real config"].join("\n");
        const result = explainSize(
            [{filename: "Dockerfile", additions: 1, deletions: 0, patch}],
            DEFAULT_CONFIG,
        );
        expect(result.files[0].fallbackReason).toBe("unsupported-language");
        expect(result.files[0].weightedLines).toBe(1);
    });

    it("tags a fallback file with fallbackReason \"classification-mismatch\" for a truncated patch", () => {
        const patch = ["@@ -1,1 +1,1 @@", "+// only one line visible"].join("\n");
        const result = explainSize(
            [{filename: "src/a.ts", additions: 5, deletions: 0, patch}],
            DEFAULT_CONFIG,
        );
        expect(result.files[0].fallbackReason).toBe("classification-mismatch");
        expect(result.files[0].weightedLines).toBe(5);
    });

    it("reports configFileFound: false and zero custom counts for the pure default config", () => {
        const result = explainSize([], DEFAULT_CONFIG);
        expect(result.configFileFound).toBe(false);
        expect(result.customExcludeCount).toBe(0);
        expect(result.customWeightCount).toBe(0);
        expect(result.commentWeight).toBe(DEFAULT_CONFIG.commentWeight);
    });

    it("reports configFileFound: true and non-zero custom counts for a merged config", () => {
        const merged: ProquoConfig = mergeConfig({
            exclude: ["**/*.generated.ts"],
            weights: [{pattern: "**/e2e/**", weight: 0.3}],
        });
        const result = explainSize([], merged);
        expect(result.configFileFound).toBe(true);
        expect(result.customExcludeCount).toBe(1);
        expect(result.customWeightCount).toBe(1);
    });

    it("matches effectiveSize's aggregate result exactly for a mixed fixture", () => {
        const patch = ["@@ -1,2 +1,2 @@", "+// a comment", "+const x = 1;"].join("\n");
        const files = [
            {filename: "src/feature.ts", additions: 40, deletions: 0},
            {filename: "src/feature.test.ts", additions: 2, deletions: 0, patch},
            {filename: "package-lock.json", additions: 900, deletions: 300},
        ];
        expect(explainSize(files, DEFAULT_CONFIG).size).toEqual(effectiveSize(files, DEFAULT_CONFIG));
    });
});
