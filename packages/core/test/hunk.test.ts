import {describe, expect, it} from "vitest";
import {parseHunkLines} from "../src/hunk";

describe("parseHunkLines", () => {
    it("classifies added, deleted, and context lines and strips their diff-prefix character", () => {
        const patch = ["@@ -1,3 +1,4 @@", " unchanged line", "-old line", "+new line", "+another new line"].join(
            "\n",
        );
        expect(parseHunkLines(patch)).toEqual([
            {type: "context", content: "unchanged line"},
            {type: "del", content: "old line"},
            {type: "add", content: "new line"},
            {type: "add", content: "another new line"},
        ]);
    });

    it("ignores hunk headers and file-header lines", () => {
        const patch = ["--- a/file.ts", "+++ b/file.ts", "@@ -1,1 +1,1 @@", "+added"].join("\n");
        expect(parseHunkLines(patch)).toEqual([{type: "add", content: "added"}]);
    });

    it("handles multiple hunks in one patch", () => {
        const patch = ["@@ -1,1 +1,1 @@", "+first", "@@ -10,1 +10,1 @@", "+second"].join("\n");
        expect(parseHunkLines(patch)).toEqual([
            {type: "add", content: "first"},
            {type: "add", content: "second"},
        ]);
    });

    it("returns an empty array for an empty patch", () => {
        expect(parseHunkLines("")).toEqual([]);
    });
});
