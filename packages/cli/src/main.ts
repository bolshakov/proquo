import {execFileSync} from "node:child_process";
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

function main(): void {
    run({
        gitNumstat,
        gitFullDiff,
        cwd: process.cwd(),
        range: process.argv[2],
        stdout: (text) => process.stdout.write(text),
    });
}

main();
