import {describe, expect, it} from "vitest";
import {parseNumstat, splitPatches} from "../src/diff";

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

    it("extracts the new path from a whole-file rename", () => {
        const output = "3\t1\told_name.txt => new_name.txt\n";
        expect(parseNumstat(output)).toEqual([{filename: "new_name.txt", additions: 3, deletions: 1}]);
    });

    it("extracts the new path from a compact directory rename", () => {
        const output = "2\t0\tsrc/{old.js => new.js}\n";
        expect(parseNumstat(output)).toEqual([{filename: "src/new.js", additions: 2, deletions: 0}]);
    });
});

describe("splitPatches", () => {
    it("splits a multi-file diff into one patch per file, keyed by the new filename", () => {
        const fullDiff = [
            "diff --git a/src/a.ts b/src/a.ts",
            "index 111..222 100644",
            "--- a/src/a.ts",
            "+++ b/src/a.ts",
            "@@ -1,1 +1,2 @@",
            " unchanged",
            "+added line",
            "diff --git a/src/b.ts b/src/b.ts",
            "index 333..444 100644",
            "--- a/src/b.ts",
            "+++ b/src/b.ts",
            "@@ -1,1 +1,1 @@",
            "-old line",
            "+new line",
        ].join("\n");
        const patches = splitPatches(fullDiff);
        expect(patches.get("src/a.ts")).toBe(["@@ -1,1 +1,2 @@", " unchanged", "+added line"].join("\n"));
        expect(patches.get("src/b.ts")).toBe(["@@ -1,1 +1,1 @@", "-old line", "+new line"].join("\n"));
    });

    it("does not produce a patch entry for a binary file", () => {
        const fullDiff = [
            "diff --git a/assets/logo.png b/assets/logo.png",
            "index 555..666 100644",
            "Binary files a/assets/logo.png and b/assets/logo.png differ",
        ].join("\n");
        expect(splitPatches(fullDiff).has("assets/logo.png")).toBe(false);
    });

    it("returns an empty map for an empty diff", () => {
        expect(splitPatches("").size).toBe(0);
    });
});
