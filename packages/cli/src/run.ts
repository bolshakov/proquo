import {explainSize, loadConfig, price, renderBreakdown} from "@proquo/core";
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

export function run(deps: RunDeps): void {
    const config = loadConfig(deps.cwd);
    const files = parseNumstat(deps.gitNumstat(deps.range));
    const patches = splitPatches(deps.gitFullDiff(deps.range));
    const filesWithPatches = files.map((file) => ({...file, patch: patches.get(file.filename)}));

    const explanation = explainSize(filesWithPatches, config);
    const report = renderReport(explanation.size, price(explanation.size.effectiveLines));
    const output = deps.explain ? `${renderBreakdown(explanation).join("\n")}\n\n${report}` : report;
    deps.stdout(output + "\n");
}
