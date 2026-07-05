import {minimatch} from "minimatch";
import type {ProquoConfig} from "./config";

export function isExcluded(filename: string, config: ProquoConfig): boolean {
    return config.exclude.some((pattern) => minimatch(filename, pattern));
}

export function weightFor(filename: string, config: ProquoConfig): number {
    const rule = config.weights.find((w) => minimatch(filename, w.pattern));
    return rule ? rule.weight : 1;
}
