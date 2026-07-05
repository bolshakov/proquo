import {describe, expect, it} from "vitest";
import {effectiveSize} from "../src/size";

describe("effectiveSize", () => {
    it("sums additions and deletions of source files", () => {
        const result = effectiveSize([
            {filename: "src/a.ts", additions: 10, deletions: 5},
            {filename: "src/b.ts", additions: 20, deletions: 0},
        ]);
        expect(result).toEqual({effectiveLines: 35, excludedLines: 0, excludedFiles: 0});
    });

    it("routes excluded files into excluded counters", () => {
        const result = effectiveSize([
            {filename: "src/a.ts", additions: 10, deletions: 0},
            {filename: "package-lock.json", additions: 900, deletions: 300},
        ]);
        expect(result).toEqual({effectiveLines: 10, excludedLines: 1200, excludedFiles: 1});
    });

    it("returns zeros for an empty PR", () => {
        expect(effectiveSize([])).toEqual({effectiveLines: 0, excludedLines: 0, excludedFiles: 0});
    });
});
