import {isExcluded} from "./exclusions";

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

export function effectiveSize(files: PrFile[]): SizeResult {
    const result: SizeResult = {effectiveLines: 0, excludedLines: 0, excludedFiles: 0};
    for (const file of files) {
        const lines = file.additions + file.deletions;
        if (isExcluded(file.filename)) {
            result.excludedLines += lines;
            result.excludedFiles += 1;
        } else {
            result.effectiveLines += lines;
        }
    }
    return result;
}
