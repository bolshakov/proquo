import {describe, expect, it} from "vitest";
import {parseArgs} from "../src/args";

describe("parseArgs", () => {
    it("returns no range and explain: false for an empty argv", () => {
        expect(parseArgs([])).toEqual({range: undefined, explain: false, version: false});
    });

    it("finds the range when --explain is absent", () => {
        expect(parseArgs(["HEAD~5..HEAD"])).toEqual({range: "HEAD~5..HEAD", explain: false, version: false});
    });

    it("detects --explain before the range argument", () => {
        expect(parseArgs(["--explain", "HEAD~5..HEAD"])).toEqual({range: "HEAD~5..HEAD", explain: true, version: false});
    });

    it("detects --explain after the range argument", () => {
        expect(parseArgs(["HEAD~5..HEAD", "--explain"])).toEqual({range: "HEAD~5..HEAD", explain: true, version: false});
    });

    it("detects --explain with no range argument", () => {
        expect(parseArgs(["--explain"])).toEqual({range: undefined, explain: true, version: false});
    });

    it("detects --version", () => {
        expect(parseArgs(["--version"])).toEqual({range: undefined, explain: false, version: true});
    });

    it("does not take --version for a range", () => {
        expect(parseArgs(["--version", "main...HEAD"])).toEqual({range: "main...HEAD", explain: false, version: true});
    });
});
