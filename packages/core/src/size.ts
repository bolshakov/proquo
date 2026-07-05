import {isExcluded, weightFor} from "./exclusions";
import type {ProquoConfig} from "./config";

export interface PrFile {
    filename: string;
    additions: number;
    deletions: number;
}

export interface SizeResult {
    effectiveLines: number;
    excludedLines: number;
    excludedFiles: number;
}

export function effectiveSize(files: PrFile[], config: ProquoConfig): SizeResult {
    let weightedSum = 0;
    let excludedLines = 0;
    let excludedFiles = 0;
    for (const file of files) {
        const lines = file.additions + file.deletions;
        if (isExcluded(file.filename, config)) {
            excludedLines += lines;
            excludedFiles += 1;
        } else {
            weightedSum += weightFor(file.filename, config) * lines;
        }
    }
    return {effectiveLines: Math.round(weightedSum), excludedLines, excludedFiles};
}
