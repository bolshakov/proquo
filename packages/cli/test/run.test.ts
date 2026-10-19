import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach, describe, expect, it, vi} from "vitest";
import {run} from "../src/run";

describe("run", () => {
    it("prices the diff and writes the report to stdout", () => {
        const stdout = vi.fn();
        run({
            gitNumstat: () => "80\t20\tsrc/a.ts\n500\t100\tpackage-lock.json\n",
            gitFullDiff: () => "",
            cwd: process.cwd(),
            range: undefined,
            stdout,
        });
        expect(stdout).toHaveBeenCalledTimes(1);
        const output: string = stdout.mock.calls[0][0];
        // 100 effective lines: lower = max(5, round(100/500*60=12)) = 12, upper = max(12, round(100/200*60=30)) = 30
        expect(output).toContain("100 effective lines");
        expect(output).toContain("12–30 min");
        expect(output).toContain("600 lines across 1 generated/lockfile file were excluded");
    });

    it("passes the requested range to git", () => {
        const gitNumstat = vi.fn().mockReturnValue("");
        const gitFullDiff = vi.fn().mockReturnValue("");
        run({gitNumstat, gitFullDiff, cwd: process.cwd(), range: "main...HEAD", stdout: vi.fn()});
        expect(gitNumstat).toHaveBeenCalledWith("main...HEAD");
        expect(gitFullDiff).toHaveBeenCalledWith("main...HEAD");
    });

    it("requests the working-tree diff when no range is given", () => {
        const gitNumstat = vi.fn().mockReturnValue("");
        const gitFullDiff = vi.fn().mockReturnValue("");
        run({gitNumstat, gitFullDiff, cwd: process.cwd(), range: undefined, stdout: vi.fn()});
        expect(gitNumstat).toHaveBeenCalledWith(undefined);
        expect(gitFullDiff).toHaveBeenCalledWith(undefined);
    });

    it("attaches patch text to files so comment lines are down-weighted", () => {
        const stdout = vi.fn();
        run({
            gitNumstat: () => "1\t0\tsrc/a.ts\n",
            gitFullDiff: () =>
                [
                    "diff --git a/src/a.ts b/src/a.ts",
                    "--- a/src/a.ts",
                    "+++ b/src/a.ts",
                    "@@ -1,1 +1,1 @@",
                    "+// just a comment",
                ].join("\n"),
            cwd: process.cwd(),
            range: undefined,
            stdout,
        });
        const output: string = stdout.mock.calls[0][0];
        expect(output).toContain("No effective source changes");
    });

    it("prints the calculation breakdown before the report when --explain is set", () => {
        const stdout = vi.fn();
        run({
            gitNumstat: () => "80\t20\tsrc/a.ts\n500\t100\tpackage-lock.json\n",
            gitFullDiff: () => "",
            cwd: process.cwd(),
            range: undefined,
            explain: true,
            stdout,
        });
        expect(stdout).toHaveBeenCalledTimes(1);
        const output: string = stdout.mock.calls[0][0];
        expect(output).toContain("Config: no .proquo.yml found");
        expect(output).toContain("src/a.ts  100 lines  weight 1 (no rule matched)");
        expect(output).toContain("package-lock.json  600 lines  EXCLUDED (default: **/package-lock.json)");
        expect(output).toContain("100 effective lines");
    });

    it("omits the breakdown when --explain is not set", () => {
        const stdout = vi.fn();
        run({
            gitNumstat: () => "80\t20\tsrc/a.ts\n",
            gitFullDiff: () => "",
            cwd: process.cwd(),
            range: undefined,
            stdout,
        });
        const output: string = stdout.mock.calls[0][0];
        expect(output).not.toContain("Config:");
    });
});

describe("run - failOn", () => {
    let dir: string;

    afterEach(() => {
        if (dir) rmSync(dir, {recursive: true, force: true});
    });

    function runIn(config: string | null, numstat: string) {
        dir = mkdtempSync(join(tmpdir(), "proquo-cli-"));
        if (config !== null) writeFileSync(join(dir, ".proquo.yml"), config);
        const stdout = vi.fn();
        const exitCode = run({gitNumstat: () => numstat, gitFullDiff: () => "", cwd: dir, range: undefined, stdout});
        return {exitCode, output: stdout.mock.calls.map((call) => call[0]).join("")};
    }

    it("exits 1 and says why when the diff reaches the failOn tier", () => {
        const {exitCode, output} = runIn("failOn: red\n", "450\t0\tsrc/a.ts\n");
        expect(exitCode).toBe(1);
        expect(output).toContain("450 effective lines");
        expect(output).toContain("failOn: red");
    });

    it("exits 0 when the diff stays below the failOn tier", () => {
        const {exitCode, output} = runIn("failOn: red\n", "300\t0\tsrc/a.ts\n");
        expect(exitCode).toBe(0);
        expect(output).not.toContain("failOn");
    });

    it("exits 0 on a red diff when failOn is not set", () => {
        expect(runIn(null, "450\t0\tsrc/a.ts\n").exitCode).toBe(0);
    });
});
