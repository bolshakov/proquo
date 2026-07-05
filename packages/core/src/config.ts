import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {parse} from "yaml";

export interface WeightRule {
    pattern: string;
    weight: number;
}

export interface ProquoConfig {
    exclude: string[];
    weights: WeightRule[];
}

const DEFAULT_EXCLUDE = [
    "**/package-lock.json",
    "**/npm-shrinkwrap.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
    "**/Gemfile.lock",
    "**/Cargo.lock",
    "**/go.sum",
    "**/poetry.lock",
    "**/uv.lock",
    "**/composer.lock",
    "**/mix.lock",
    "**/Podfile.lock",
    "**/flake.lock",
    "**/node_modules/**",
    "**/vendor/**",
    "**/dist/**",
    "**/build/**",
    "**/__generated__/**",
    "**/__snapshots__/**",
    "**/*.min.js",
    "**/*.min.css",
    "**/*.map",
    "**/*.snap",
    "**/*.pb.go",
    "**/*_pb2.py",
];

const DEFAULT_TEST_WEIGHT = 0.5;

const DEFAULT_WEIGHTS: WeightRule[] = [
    {pattern: "**/*.test.*", weight: DEFAULT_TEST_WEIGHT},
    {pattern: "**/*.spec.*", weight: DEFAULT_TEST_WEIGHT},
    {pattern: "**/test/**", weight: DEFAULT_TEST_WEIGHT},
    {pattern: "**/tests/**", weight: DEFAULT_TEST_WEIGHT},
    {pattern: "**/spec/**", weight: DEFAULT_TEST_WEIGHT},
    {pattern: "**/__tests__/**", weight: DEFAULT_TEST_WEIGHT},
];

export const DEFAULT_CONFIG: ProquoConfig = {
    exclude: DEFAULT_EXCLUDE,
    weights: DEFAULT_WEIGHTS,
};

interface RawConfig {
    exclude?: unknown;
    weights?: unknown;
}

function validateExclude(raw: unknown): string[] {
    if (raw === undefined) return [];
    if (!Array.isArray(raw) || !raw.every((p) => typeof p === "string")) {
        throw new Error(".proquo.yml: `exclude` must be a list of strings");
    }
    return raw;
}

function validateWeights(raw: unknown): WeightRule[] {
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) {
        throw new Error(".proquo.yml: `weights` must be a list");
    }
    return raw.map((entry) => {
        if (
            typeof entry !== "object" ||
            entry === null ||
            typeof (entry as {pattern?: unknown}).pattern !== "string" ||
            typeof (entry as {weight?: unknown}).weight !== "number"
        ) {
            throw new Error(".proquo.yml: each `weights` entry needs a string `pattern` and numeric `weight`");
        }
        return entry as WeightRule;
    });
}

export function parseConfigFile(raw: string): {exclude: string[]; weights: WeightRule[]} {
    const parsed = (parse(raw) ?? {}) as RawConfig;
    return {
        exclude: validateExclude(parsed.exclude),
        weights: validateWeights(parsed.weights),
    };
}

export function mergeConfig(userConfig: {exclude: string[]; weights: WeightRule[]}): ProquoConfig {
    return {
        exclude: [...DEFAULT_CONFIG.exclude, ...userConfig.exclude],
        weights: [...userConfig.weights, ...DEFAULT_CONFIG.weights],
    };
}

export function loadConfig(repoRoot: string): ProquoConfig {
    const configPath = join(repoRoot, ".proquo.yml");
    if (!existsSync(configPath)) return DEFAULT_CONFIG;
    const raw = readFileSync(configPath, "utf8");
    return mergeConfig(parseConfigFile(raw));
}
