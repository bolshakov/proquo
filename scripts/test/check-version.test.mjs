import {describe, expect, it} from "vitest";
import {versionProblems} from "../check-version.mjs";

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
});
