import {execFileSync} from "node:child_process";
import {effectiveSize, loadConfig, price} from "@proquo/core";
import {parseNumstat} from "./diff";
import {renderReport} from "./report";

function gitNumstat(range: string | undefined): string {
    const args = ["diff", "--numstat"];
    if (range) args.push(range);
    return execFileSync("git", args, {encoding: "utf8"});
}

function main(): void {
    const range = process.argv[2];
    const config = loadConfig(process.cwd());
    const files = parseNumstat(gitNumstat(range));
    const size = effectiveSize(files, config);
    process.stdout.write(renderReport(size, price(size.effectiveLines)) + "\n");
}

main();
