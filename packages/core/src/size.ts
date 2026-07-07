import {isExcluded, weightFor} from "./exclusions";
import {classifyPatchLines, languageFor} from "./comments";
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

function weightedLinesFor(file: PrFile, fileWeight: number, config: ProquoConfig): number {
    const totalLines = file.additions + file.deletions;
    const language = file.patch ? languageFor(file.filename) : null;
    if (!file.patch || !language) return fileWeight * totalLines;

    const classified = classifyPatchLines(file.patch, language);
    if (classified.length !== totalLines) {
        // A partial patch would under-count, so fall back to the safe per-file weight.
        return fileWeight * totalLines;
    }

    return classified.reduce(
        (sum, line) => sum + fileWeight * (line.isComment ? config.commentWeight : 1),
        0,
    );
}

export function effectiveSize(files: PrFile[], config: ProquoConfig): SizeResult {
    let weightedSum = 0;
    let excludedLines = 0;
    let excludedFiles = 0;
    let pricedFiles = 0;
    for (const file of files) {
        const lines = file.additions + file.deletions;
        if (isExcluded(file.filename, config)) {
            excludedLines += lines;
            excludedFiles += 1;
            continue;
        }
        pricedFiles += 1;
        weightedSum += weightedLinesFor(file, weightFor(file.filename, config), config);
    }
    return {effectiveLines: Math.round(weightedSum), excludedLines, excludedFiles, pricedFiles};
}
