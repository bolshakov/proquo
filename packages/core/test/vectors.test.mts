import {readFileSync, readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";
import {describe, expect, it} from "vitest";
import {DEFAULT_CONFIG, effectiveSize, price} from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const vectorsDir = join(here, "..", "vectors");

interface Vector {
    description: string;
    files: {filename: string; additions: number; deletions: number}[];
    expected: {
        effectiveLines: number;
        excludedFiles: number;
        excludedLines: number;
        minutes: number;
        splitNudge: {halfMinutes: number; savedMinutes: number} | null;
    };
}

describe("golden pricing vectors", () => {
    const fileNames = readdirSync(vectorsDir).filter((f) => f.endsWith(".json"));

    it("finds at least one vector file", () => {
        expect(fileNames.length).toBeGreaterThan(0);
    });

    it.each(fileNames)("%s reproduces its recorded price", (fileName) => {
        const vector = JSON.parse(readFileSync(join(vectorsDir, fileName), "utf8")) as Vector;
        const size = effectiveSize(vector.files, DEFAULT_CONFIG);
        const result = price(size.effectiveLines);
        expect({
            effectiveLines: size.effectiveLines,
            excludedFiles: size.excludedFiles,
            excludedLines: size.excludedLines,
            minutes: result.minutes,
            splitNudge: result.splitNudge,
        }).toEqual(vector.expected);
    });
});
