import {explainExclusion, explainWeight, type PatternSource} from "./exclusions";
import {classifyPatchLines, languageFor} from "./comments";
import {DEFAULT_CONFIG, type ProquoConfig} from "./config";
import type {PrFile, SizeResult} from "./size";

export type FallbackReason = "no-patch" | "unsupported-language" | "classification-mismatch";

export interface ExcludedFileBreakdown {
    filename: string;
    rawLines: number;
    excluded: true;
    exclusionPattern: string;
    exclusionSource: PatternSource;
}

interface PricedFileBreakdownBase {
    filename: string;
    rawLines: number;
    excluded: false;
    weight: number;
    weightPattern?: string;
    weightSource?: PatternSource;
    weightedLines: number;
}

export type PricedFileBreakdown =
    | (PricedFileBreakdownBase & {commentLines: number; linesSaved: number; fallbackReason?: never})
    | (PricedFileBreakdownBase & {commentLines?: never; linesSaved?: never; fallbackReason: FallbackReason});

export type FileBreakdown = ExcludedFileBreakdown | PricedFileBreakdown;

export interface SizeExplanation {
    size: SizeResult;
    files: FileBreakdown[];
    configFileFound: boolean;
    customExcludeCount: number;
    customWeightCount: number;
    commentWeight: number;
}

type WeightedLinesExplanation =
    | {weightedLines: number; commentLines: number; linesSaved: number; fallbackReason?: never}
    | {weightedLines: number; commentLines?: never; linesSaved?: never; fallbackReason: FallbackReason};

function explainWeightedLines(file: PrFile, weight: number, config: ProquoConfig): WeightedLinesExplanation {
    const totalLines = file.additions + file.deletions;
    const flatWeightedLines = weight * totalLines;

    if (!file.patch) return {weightedLines: flatWeightedLines, fallbackReason: "no-patch"};

    const language = languageFor(file.filename);
    if (!language) return {weightedLines: flatWeightedLines, fallbackReason: "unsupported-language"};

    const classified = classifyPatchLines(file.patch, language);
    if (classified.length !== totalLines) {
        return {weightedLines: flatWeightedLines, fallbackReason: "classification-mismatch"};
    }

    const commentLines = classified.filter((line) => line.isComment === true).length;
    const weightedLines = classified.reduce(
        (sum, line) => sum + weight * (line.isComment === true ? config.commentWeight : 1),
        0,
    );
    return {weightedLines, commentLines, linesSaved: flatWeightedLines - weightedLines};
}

export function explainSize(files: PrFile[], config: ProquoConfig): SizeExplanation {
    const breakdown: FileBreakdown[] = [];
    let weightedSum = 0;
    let excludedLines = 0;
    let excludedFiles = 0;
    let pricedFiles = 0;

    for (const file of files) {
        const rawLines = file.additions + file.deletions;
        const exclusion = explainExclusion(file.filename, config);

        if (exclusion.excluded) {
            excludedLines += rawLines;
            excludedFiles += 1;
            breakdown.push({
                filename: file.filename,
                rawLines,
                excluded: true,
                exclusionPattern: exclusion.pattern,
                exclusionSource: exclusion.source,
            });
            continue;
        }

        pricedFiles += 1;
        const weightExplanation = explainWeight(file.filename, config);
        const weightedResult = explainWeightedLines(file, weightExplanation.weight, config);
        weightedSum += weightedResult.weightedLines;
        const priced = {
            filename: file.filename,
            rawLines,
            excluded: false as const,
            weight: weightExplanation.weight,
            weightPattern: weightExplanation.pattern,
            weightSource: weightExplanation.source,
        };
        if (weightedResult.fallbackReason !== undefined) {
            breakdown.push({
                ...priced,
                weightedLines: weightedResult.weightedLines,
                fallbackReason: weightedResult.fallbackReason,
            });
        } else {
            breakdown.push({
                ...priced,
                weightedLines: weightedResult.weightedLines,
                commentLines: weightedResult.commentLines,
                linesSaved: weightedResult.linesSaved,
            });
        }
    }

    return {
        size: {effectiveLines: Math.round(weightedSum), excludedLines, excludedFiles, pricedFiles},
        files: breakdown,
        // loadConfig() returns DEFAULT_CONFIG itself (same reference) when no .proquo.yml exists.
        configFileFound: config !== DEFAULT_CONFIG,
        customExcludeCount: config.exclude.length - DEFAULT_CONFIG.exclude.length,
        customWeightCount: config.weights.length - DEFAULT_CONFIG.weights.length,
        commentWeight: config.commentWeight,
    };
}
