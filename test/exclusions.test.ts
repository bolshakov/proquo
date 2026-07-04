import {describe, expect, it} from "vitest";
import {isExcluded} from "../src/exclusions";

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
        expect(isExcluded(file)).toBe(true);
    });

    it.each([
        "vendor/lib/thing.go",
        "node_modules/pkg/index.js",
        "dist/bundle.js",
        "build/output.css",
        "__generated__/types.ts",
    ])("excludes vendored/generated path %s", (file) => {
        expect(isExcluded(file)).toBe(true);
    });

    it.each(["app.min.js", "styles.min.css", "bundle.js.map", "test/__snapshots__/x.snap", "api.pb.go"])(
        "excludes generated artifact %s",
        (file) => {
            expect(isExcluded(file)).toBe(true);
        },
    );

    it.each(["src/main.ts", "Gemfile", "app/models/user.rb", "README.md", "distributed/worker.py"])(
        "keeps normal source file %s",
        (file) => {
            expect(isExcluded(file)).toBe(false);
        },
    );
});
