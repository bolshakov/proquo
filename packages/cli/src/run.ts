import {effectiveSize, loadConfig, price} from "@proquo/core";
import {parseNumstat} from "./diff";
import {renderReport} from "./report";

export interface RunDeps {
    gitNumstat(range: string | undefined): string;

    cwd: string;
    range: string | undefined;
    stdout(text: string): void;
}

export function run(deps: RunDeps): void {
    const config = loadConfig(deps.cwd);
    const files = parseNumstat(deps.gitNumstat(deps.range));
    const size = effectiveSize(files, config);
    deps.stdout(renderReport(size, price(size.effectiveLines)) + "\n");
}
