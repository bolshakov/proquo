import {spawnSync} from "node:child_process";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {afterEach, describe, expect, it} from "vitest";
import {versionProblems} from "../check-version.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const script = join(root, "scripts", "check-version.mjs");
const repoVersion = (await import(join(root, "package.json"), {with: {type: "json"}})).default.version;

const manifests = (root, cli) => [
    {name: "proquo-monorepo", version: root},
    {name: "proquo", version: cli},
];

describe("versionProblems", () => {
    it("reports nothing when every manifest matches the tag", () => {
        expect(versionProblems("v2.2.0", manifests("2.2.0", "2.2.0"))).toEqual([]);
    });

    it("reports a manifest that differs from the tag", () => {
        expect(versionProblems("v2.2.0", manifests("2.2.0", "2.1.0"))).toEqual([
            "proquo is at 2.1.0, but the tag is v2.2.0",
        ]);
    });

    it("checks the manifests against each other when there is no tag", () => {
        expect(versionProblems(undefined, manifests("2.2.0", "2.1.0"))).toEqual([
            "proquo is at 2.1.0, but proquo-monorepo is at 2.2.0",
        ]);
        expect(versionProblems(undefined, manifests("2.2.0", "2.2.0"))).toEqual([]);
    });

    it("rejects a tag that is not vX.Y.Z", () => {
        expect(versionProblems("v2", manifests("2.0.0", "2.0.0"))).toEqual([
            "tag v2 is not in the form vX.Y.Z or vX.Y.Z-prerelease",
        ]);
    });

    it("accepts a prerelease tag", () => {
        expect(versionProblems("v2.2.0-rc.1", manifests("2.2.0-rc.1", "2.2.0-rc.1"))).toEqual([]);
    });

    it("names every manifest that differs from the tag", () => {
        const all = [
            {name: "a", version: "2.1.0"},
            {name: "b", version: "2.2.0"},
            {name: "c", version: "2.0.0"},
        ];
        expect(versionProblems("v2.2.0", all)).toEqual([
            "a is at 2.1.0, but the tag is v2.2.0",
            "c is at 2.0.0, but the tag is v2.2.0",
        ]);
    });

    it("compares later manifests against the first when there is no tag", () => {
        const all = [
            {name: "a", version: "2.1.0"},
            {name: "b", version: "2.2.0"},
            {name: "c", version: "2.2.0"},
        ];
        expect(versionProblems(undefined, all)).toEqual([
            "b is at 2.2.0, but a is at 2.1.0",
            "c is at 2.2.0, but a is at 2.1.0",
        ]);
    });

    it.each(["2.2.0", "v2.2", "v2.2.0.1", "v2.2.0-"])("rejects the malformed tag %s", (tag) => {
        expect(versionProblems(tag, manifests("2.2.0", "2.2.0"))).toEqual([
            `tag ${tag} is not in the form vX.Y.Z or vX.Y.Z-prerelease`,
        ]);
    });
});

describe("check-version script", () => {
    const scratch = [];
    afterEach(() => {
        while (scratch.length > 0) rmSync(scratch.pop(), {recursive: true, force: true});
    });

    const runScript = (path, ...args) => spawnSync("node", [path, ...args], {encoding: "utf8"});

    it("exits 0 when the packages agree and there is no tag", () => {
        expect(runScript(script).status).toBe(0);
    });

    it("exits 0 when the tag is the repository version", () => {
        expect(runScript(script, `v${repoVersion}`).status).toBe(0);
    });

    it("exits 1 with a workflow error annotation when the tag differs", () => {
        const result = runScript(script, "v9.9.9");
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(`::error::proquo-monorepo is at ${repoVersion}, but the tag is v9.9.9`);
    });

    it("exits 1 for a malformed tag", () => {
        expect(runScript(script, "v2").status).toBe(1);
    });

    it("still checks when it is started through a symlink", () => {
        const dir = mkdtempSync(join(tmpdir(), "check-version-"));
        scratch.push(dir);
        const link = join(dir, "check-version.mjs");
        symlinkSync(script, link);
        expect(runScript(link, "v9.9.9").status).toBe(1);
    });

    it("ignores files that sit next to the package directories", () => {
        const dir = mkdtempSync(join(tmpdir(), "check-version-"));
        scratch.push(dir);
        mkdirSync(join(dir, "scripts"));
        mkdirSync(join(dir, "packages", "a"), {recursive: true});
        writeFileSync(join(dir, "package.json"), JSON.stringify({name: "root", version: "1.0.0"}));
        writeFileSync(join(dir, "packages", "a", "package.json"), JSON.stringify({name: "a", version: "1.0.0"}));
        writeFileSync(join(dir, "packages", ".DS_Store"), "");
        const copy = join(dir, "scripts", "check-version.mjs");
        writeFileSync(copy, readFileSync(script, "utf8"));
        expect(runScript(copy, "v1.0.0").status).toBe(0);
    });
});
