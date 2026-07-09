import {explainSize} from "./explain";
import type {ProquoConfig} from "./config";

export interface PrFile {
    filename: string;
    additions: number;
    deletions: number;
    patch?: string;
}

export interface SizeResult {
    effectiveLines: number;
    excludedLines: number;
    excludedFiles: number;
    pricedFiles: number;
}

export function effectiveSize(files: PrFile[], config: ProquoConfig): SizeResult {
    return explainSize(files, config).size;
}
