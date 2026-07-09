import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {DEFAULT_CONFIG, loadConfig, mergeConfig, parseConfigFile} from "../src/config";

describe("parseConfigFile", () => {
    it("returns empty exclude/weights for an empty file", () => {
        expect(parseConfigFile("")).toEqual({exclude: [], weights: []});
    });

    it("parses a valid exclude list", () => {
        expect(parseConfigFile('exclude:\n  - "**/*.generated.ts"\n')).toEqual({
            exclude: ["**/*.generated.ts"],
            weights: [],
        });
    });

    it("parses a valid weights list", () => {
        expect(parseConfigFile('weights:\n  - pattern: "**/e2e/**"\n    weight: 0.3\n')).toEqual({
            exclude: [],
            weights: [{pattern: "**/e2e/**", weight: 0.3}],
        });
    });

    it("throws when exclude is not a list of strings", () => {
        expect(() => parseConfigFile("exclude: 5\n")).toThrow(/exclude/);
        expect(() => parseConfigFile("exclude:\n  - 5\n")).toThrow(/exclude/);
    });

    it("throws when a weights entry is missing a numeric weight", () => {
        expect(() => parseConfigFile('weights:\n  - pattern: "**/e2e/**"\n    weight: "fast"\n')).toThrow(
            /weights/,
        );
    });

    it("throws when a weights entry is missing a string pattern", () => {
        expect(() => parseConfigFile("weights:\n  - pattern: 5\n    weight: 0.3\n")).toThrow(/weights/);
    });

    it("throws when a weights entry has a negative weight", () => {
        expect(() => parseConfigFile('weights:\n  - pattern: "**/e2e/**"\n    weight: -1\n')).toThrow(/weights/);
    });

    it("throws when a weights entry has a non-finite weight", () => {
        expect(() => parseConfigFile('weights:\n  - pattern: "**/e2e/**"\n    weight: .nan\n')).toThrow(/weights/);
    });

    it("throws on malformed YAML", () => {
        expect(() => parseConfigFile("exclude: [\n")).toThrow();
    });
});

describe("mergeConfig", () => {
    it("appends user exclude patterns after the built-in defaults", () => {
        const merged = mergeConfig({exclude: ["**/*.generated.ts"], weights: []});
        expect(merged.exclude).toEqual([...DEFAULT_CONFIG.exclude, "**/*.generated.ts"]);
    });

    it("prepends user weight rules before the built-in defaults", () => {
        const userRule = {pattern: "**/e2e/**", weight: 0.3};
        const merged = mergeConfig({exclude: [], weights: [userRule]});
        expect(merged.weights).toEqual([userRule, ...DEFAULT_CONFIG.weights]);
    });
});

describe("parseConfigFile - commentWeight", () => {
    it("parses a valid commentWeight", () => {
        expect(parseConfigFile("commentWeight: 0.4\n")).toEqual({
            exclude: [],
            weights: [],
            commentWeight: 0.4,
        });
    });

    it("leaves commentWeight undefined when absent", () => {
        expect(parseConfigFile("").commentWeight).toBeUndefined();
    });

    it("throws when commentWeight is not a non-negative number", () => {
        expect(() => parseConfigFile("commentWeight: fast\n")).toThrow(/commentWeight/);
        expect(() => parseConfigFile("commentWeight: -1\n")).toThrow(/commentWeight/);
    });

    it("throws when commentWeight is greater than 1", () => {
        expect(() => parseConfigFile("commentWeight: 1.5\n")).toThrow(/commentWeight/);
    });
});

describe("mergeConfig - commentWeight", () => {
    it("uses the user's commentWeight when provided", () => {
        const merged = mergeConfig({exclude: [], weights: [], commentWeight: 0.4});
        expect(merged.commentWeight).toBe(0.4);
    });

    it("falls back to the default commentWeight when not provided", () => {
        const merged = mergeConfig({exclude: [], weights: []});
        expect(merged.commentWeight).toBe(DEFAULT_CONFIG.commentWeight);
    });
});

describe("DEFAULT_CONFIG - commentWeight", () => {
    it("defaults commentWeight to 0.3", () => {
        expect(DEFAULT_CONFIG.commentWeight).toBe(0.3);
    });
});

describe("loadConfig", () => {
    let dir: string;

    afterEach(() => {
        if (dir) rmSync(dir, {recursive: true, force: true});
    });

    it("returns the exact DEFAULT_CONFIG object reference when .proquo.yml is missing", () => {
        dir = mkdtempSync(join(tmpdir(), "proquo-config-"));
        expect(loadConfig(dir)).toBe(DEFAULT_CONFIG);
    });

    it("merges a real .proquo.yml file with the defaults", () => {
        dir = mkdtempSync(join(tmpdir(), "proquo-config-"));
        writeFileSync(join(dir, ".proquo.yml"), 'exclude:\n  - "**/*.generated.ts"\n');
        const config = loadConfig(dir);
        expect(config.exclude).toEqual([...DEFAULT_CONFIG.exclude, "**/*.generated.ts"]);
        expect(config.weights).toEqual(DEFAULT_CONFIG.weights);
    });

    it("throws when .proquo.yml is malformed", () => {
        dir = mkdtempSync(join(tmpdir(), "proquo-config-"));
        writeFileSync(join(dir, ".proquo.yml"), "exclude: [\n");
        expect(() => loadConfig(dir)).toThrow();
    });
});
