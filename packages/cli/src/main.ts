import {execFileSync} from "node:child_process";
import {run} from "./run";

function gitNumstat(range: string | undefined): string {
    const args = ["diff", "--numstat"];
    if (range) args.push(range);
    return execFileSync("git", args, {encoding: "utf8"});
}

function main(): void {
    run({
        gitNumstat,
        cwd: process.cwd(),
        range: process.argv[2],
        stdout: (text) => process.stdout.write(text),
    });
}

main();
