import {describe, expect, it} from "vitest";
import {parseNumstat} from "../src/diff";

describe("parseNumstat", () => {
    it("parses added and deleted counts with the filename", () => {
        const output = "12\t3\tsrc/main.ts\n0\t5\tREADME.md\n";
        expect(parseNumstat(output)).toEqual([
            {filename: "src/main.ts", additions: 12, deletions: 3},
            {filename: "README.md", additions: 0, deletions: 5},
        ]);
    });

    it("treats binary files (dash counts) as zero changed lines", () => {
        const output = "-\t-\tassets/logo.png\n";
        expect(parseNumstat(output)).toEqual([
            {filename: "assets/logo.png", additions: 0, deletions: 0},
        ]);
    });

    it("keeps tabs that appear inside a path", () => {
        const output = "1\t1\tweird\tname.ts\n";
        expect(parseNumstat(output)).toEqual([
            {filename: "weird\tname.ts", additions: 1, deletions: 1},
        ]);
    });

    it("ignores blank lines and returns an empty array for empty input", () => {
        expect(parseNumstat("")).toEqual([]);
        expect(parseNumstat("\n\n")).toEqual([]);
    });
});
