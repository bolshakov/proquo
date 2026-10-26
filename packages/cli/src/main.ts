import {execFileSync} from "node:child_process";
import {parseArgs} from "./args";
import {run} from "./run";

function gitNumstat(range: string | undefined): string {
    const args = ["diff", "--numstat"];
    if (range) args.push(range);
    return execFileSync("git", args, {encoding: "utf8"});
}

function gitFullDiff(range: string | undefined): string {
    const args = ["diff"];
    if (range) args.push(range);
    try {
        return execFileSync("git", args, {encoding: "utf8", maxBuffer: 1024 * 1024 * 50});
    } catch (error) {
        console.error("proquo: full diff fetch failed, falling back to per-file pricing:", error);
        return "";
    }
}

declare const PROQUO_VERSION: string;

const HELP = `Usage: proquo [options] [range]

Prices the review burden of a git diff.

Arguments:
  range       A git revision range such as main...HEAD. Defaults to the working-tree diff.

Options:
  --explain   Show a per-file calculation breakdown.
  --version   Print the release version.
  -h, --help  Show this help.
`;

function main(): void {
    const {range, explain, version, help} = parseArgs(process.argv.slice(2));
    if (help) {
        process.stdout.write(HELP);
        return;
    }
    if (version) {
        process.stdout.write(`${PROQUO_VERSION}\n`);
        return;
    }
    process.exitCode = run({
        gitNumstat,
        gitFullDiff,
        cwd: process.cwd(),
        range,
        explain,
        stdout: (text) => process.stdout.write(text),
        stderr: (text) => process.stderr.write(text),
    });
}

main();
