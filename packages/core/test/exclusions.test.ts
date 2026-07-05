import {describe, expect, it} from "vitest";
import {isExcluded, weightFor} from "../src/exclusions";
import {DEFAULT_CONFIG, type ProquoConfig} from "../src/config";

describe("isExcluded", () => {
    it.each([
        "package-lock.json",
        "backend/Gemfile.lock",
        "yarn.lock",
        "pnpm-lock.yaml",
        "Cargo.lock",
        "go.sum",
        "poetry.lock",
        "uv.lock",
        "composer.lock",
    ])("excludes lockfile %s", (file) => {
        expect(isExcluded(file, DEFAULT_CONFIG)).toBe(true);
    });

    it.each([
        "vendor/lib/thing.go",
        "node_modules/pkg/index.js",
        "dist/bundle.js",
        "build/output.css",
        "__generated__/types.ts",
    ])("excludes vendored/generated path %s", (file) => {
        expect(isExcluded(file, DEFAULT_CONFIG)).toBe(true);
    });

    it.each(["app.min.js", "styles.min.css", "bundle.js.map", "test/__snapshots__/x.snap", "api.pb.go"])(
        "excludes generated artifact %s",
        (file) => {
            expect(isExcluded(file, DEFAULT_CONFIG)).toBe(true);
        },
    );

    it.each(["src/main.ts", "Gemfile", "app/models/user.rb", "README.md", "distributed/worker.py"])(
        "keeps normal source file %s",
        (file) => {
            expect(isExcluded(file, DEFAULT_CONFIG)).toBe(false);
        },
    );

    it("excludes a user-added pattern on top of the defaults", () => {
        const config: ProquoConfig = {
            exclude: [...DEFAULT_CONFIG.exclude, "**/*.generated.ts"],
            weights: DEFAULT_CONFIG.weights,
        };
        expect(isExcluded("src/api.generated.ts", config)).toBe(true);
        expect(isExcluded("package-lock.json", config)).toBe(true);
    });
});

describe("weightFor", () => {
    it.each([
        "src/pricing.test.ts",
        "packages/core/test/size.test.ts",
        "test/helpers.ts",
        "spec/widget_spec.rb",
        "__tests__/widget.tsx",
    ])("down-weights test file %s to 0.5 by default", (file) => {
        expect(weightFor(file, DEFAULT_CONFIG)).toBe(0.5);
    });

    it("weights a normal source file at 1", () => {
        expect(weightFor("src/pricing.ts", DEFAULT_CONFIG)).toBe(1);
    });

    it("a user weight rule takes priority over the default test-file rule", () => {
        const config: ProquoConfig = {
            exclude: DEFAULT_CONFIG.exclude,
            weights: [{pattern: "**/*.test.ts", weight: 0.2}, ...DEFAULT_CONFIG.weights],
        };
        expect(weightFor("src/pricing.test.ts", config)).toBe(0.2);
    });
});
