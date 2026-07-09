import {minimatch} from "minimatch";
import {DEFAULT_CONFIG, type ProquoConfig} from "./config";

export function isExcluded(filename: string, config: ProquoConfig): boolean {
    return explainExclusion(filename, config).excluded;
}

export function weightFor(filename: string, config: ProquoConfig): number {
    return explainWeight(filename, config).weight;
}

export type PatternSource = "config" | "default";

export type ExclusionExplanation =
    | {excluded: false}
    | {excluded: true; pattern: string; source: PatternSource};

export function explainExclusion(filename: string, config: ProquoConfig): ExclusionExplanation {
    const pattern = config.exclude.find((p) => minimatch(filename, p));
    if (!pattern) return {excluded: false};
    const source: PatternSource = DEFAULT_CONFIG.exclude.includes(pattern) ? "default" : "config";
    return {excluded: true, pattern, source};
}

export interface WeightExplanation {
    weight: number;
    pattern?: string;
    source?: PatternSource;
}

export function explainWeight(filename: string, config: ProquoConfig): WeightExplanation {
    const rule = config.weights.find((w) => minimatch(filename, w.pattern));
    if (!rule) return {weight: 1};
    const source: PatternSource = DEFAULT_CONFIG.weights.some(
        (d) => d.pattern === rule.pattern && d.weight === rule.weight,
    )
        ? "default"
        : "config";
    return {weight: rule.weight, pattern: rule.pattern, source};
}
