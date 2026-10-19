import {explainSize, loadConfig, price, reachesFailOn, renderBreakdown} from "@proquo/core";
import {parseNumstat, splitPatches} from "./diff";
import {renderReport} from "./report";

export interface RunDeps {
    gitNumstat(range: string | undefined): string;

    gitFullDiff(range: string | undefined): string;

    cwd: string;
    range: string | undefined;
    explain?: boolean;
    stdout(text: string): void;
}

export function run(deps: RunDeps): number {
    const config = loadConfig(deps.cwd);
    const files = parseNumstat(deps.gitNumstat(deps.range));
    const patches = splitPatches(deps.gitFullDiff(deps.range));
    const filesWithPatches = files.map((file) => ({...file, patch: patches.get(file.filename)}));

    const explanation = explainSize(filesWithPatches, config);
    const computedPrice = price(explanation.size.effectiveLines);
    const report = renderReport(explanation.size, computedPrice);
    const output = deps.explain ? `${renderBreakdown(explanation).join("\n")}\n\n${report}` : report;
    const fails = reachesFailOn(computedPrice.tier, config.failOn);
    const failLine = fails
        ? `\n\nproquo: this diff is in the ${computedPrice.tier} tier, and .proquo.yml sets failOn: ${config.failOn}`
        : "";
    deps.stdout(output + failLine + "\n");
    return fails ? 1 : 0;
}
