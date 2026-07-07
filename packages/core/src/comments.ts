import {parseHunkLines, type HunkLine} from "./hunk";

export type SupportedLanguage =
    | "javascript"
    | "typescript"
    | "jsx"
    | "tsx"
    | "python"
    | "ruby"
    | "go"
    | "java"
    | "c"
    | "cpp"
    | "rust"
    | "yaml";

interface LineCommentRule {
    token: string;
    requiresLeadingSpace: boolean;
}

interface BlockCommentRule {
    open: string;
    close: string;
    nestable: boolean;
}

interface CommentRules {
    lineComment?: LineCommentRule;
    blockComment?: BlockCommentRule;
    stringDelimiters: string[];
    // Structural characters that neither start code nor a comment - e.g. the braces wrapping a
    // JSX comment ({/* ... */}) would otherwise register as "code", masking a comment-only line.
    neutralChars?: string[];
    // YAML single-quoted scalars have no backslash-escape syntax - `\` is a literal character there.
    noEscapeDelimiters?: string[];
}

function cFamily(opts: {nestable?: boolean; neutralChars?: string[]} = {}): CommentRules {
    return {
        lineComment: {token: "//", requiresLeadingSpace: false},
        blockComment: {open: "/*", close: "*/", nestable: opts.nestable ?? false},
        stringDelimiters: ["'", '"', "`"],
        neutralChars: opts.neutralChars,
    };
}

function hashFamily(stringDelimiters: string[]): CommentRules {
    return {
        lineComment: {token: "#", requiresLeadingSpace: false},
        stringDelimiters,
    };
}

const RULES: Record<SupportedLanguage, CommentRules> = {
    javascript: cFamily(),
    typescript: cFamily(),
    jsx: cFamily({neutralChars: ["{", "}"]}),
    tsx: cFamily({neutralChars: ["{", "}"]}),
    go: cFamily(),
    java: cFamily(),
    c: cFamily(),
    cpp: cFamily(),
    rust: cFamily({nestable: true}),
    python: hashFamily(["'", '"']),
    ruby: hashFamily(["'", '"']),
    yaml: {
        lineComment: {token: "#", requiresLeadingSpace: true},
        stringDelimiters: ["'", '"'],
        noEscapeDelimiters: ["'"],
    },
};

const EXTENSION_TO_LANGUAGE: Record<string, SupportedLanguage> = {
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".mts": "typescript",
    ".cts": "typescript",
    ".jsx": "jsx",
    ".tsx": "tsx",
    ".py": "python",
    ".rb": "ruby",
    ".rbs": "ruby",
    ".rbi": "ruby",
    ".go": "go",
    ".java": "java",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".hpp": "cpp",
    ".rs": "rust",
    ".yml": "yaml",
    ".yaml": "yaml",
};

export function languageFor(filename: string): SupportedLanguage | null {
    const match = /\.[^./]+$/.exec(filename);
    if (!match) return null;
    return EXTENSION_TO_LANGUAGE[match[0].toLowerCase()] ?? null;
}

type ScanState =
    | {kind: "normal"}
    | {kind: "string"; delimiter: string}
    | {kind: "lineComment"}
    | {kind: "blockComment"; depth: number};

function classifyLines(hunkLines: HunkLine[], rules: CommentRules): Array<boolean | null> {
    const results: Array<boolean | null> = [];
    let index = 0;

    while (index < hunkLines.length) {
        const hunkIndex = hunkLines[index].hunkIndex;
        let state: ScanState = {kind: "normal"};
        const hunkResults: boolean[] = [];

        while (index < hunkLines.length && hunkLines[index].hunkIndex === hunkIndex) {
            const line = hunkLines[index].content;
            if (state.kind === "lineComment") state = {kind: "normal"};
            let hasCode = false;
            let hasComment = false;
            let i = 0;

            while (i < line.length) {
                const ch = line[i];

                if (state.kind === "normal") {
                    if (rules.blockComment && line.startsWith(rules.blockComment.open, i)) {
                        state = {kind: "blockComment", depth: 1};
                        hasComment = true;
                        i += rules.blockComment.open.length;
                        continue;
                    }
                    if (
                        rules.lineComment &&
                        line.startsWith(rules.lineComment.token, i) &&
                        (!rules.lineComment.requiresLeadingSpace || i === 0 || /\s/.test(line[i - 1]))
                    ) {
                        state = {kind: "lineComment"};
                        hasComment = true;
                        i += rules.lineComment.token.length;
                        continue;
                    }
                    if (rules.stringDelimiters.includes(ch)) {
                        state = {kind: "string", delimiter: ch};
                        hasCode = true;
                        i += 1;
                        continue;
                    }
                    if (rules.neutralChars?.includes(ch)) {
                        i += 1;
                        continue;
                    }
                    if (!/\s/.test(ch)) hasCode = true;
                    i += 1;
                } else if (state.kind === "string") {
                    hasCode = true;
                    if (ch === "\\" && !rules.noEscapeDelimiters?.includes(state.delimiter)) {
                        i += 2;
                        continue;
                    }
                    if (ch === state.delimiter) state = {kind: "normal"};
                    i += 1;
                } else if (state.kind === "lineComment") {
                    hasComment = true;
                    i += 1;
                } else {
                    hasComment = true;
                    const block = rules.blockComment!;
                    if (block.nestable && line.startsWith(block.open, i)) {
                        state = {kind: "blockComment", depth: state.depth + 1};
                        i += block.open.length;
                        continue;
                    }
                    if (line.startsWith(block.close, i)) {
                        const depth: number = state.depth - 1;
                        state = depth > 0 ? {kind: "blockComment", depth} : {kind: "normal"};
                        i += block.close.length;
                        continue;
                    }
                    i += 1;
                }
            }

            hunkResults.push(hasComment && !hasCode);
            index += 1;
        }

        // A trailing lineComment always resolves cleanly at end-of-line; blockComment and string do not.
        const trustworthy = state.kind === "normal" || state.kind === "lineComment";
        for (const r of hunkResults) results.push(trustworthy ? r : null);
    }

    return results;
}

export function classifyPatchLines(
    patch: string,
    language: SupportedLanguage,
): Array<{type: "add" | "del"; isComment: boolean | null}> {
    const hunkLines = parseHunkLines(patch);
    const flags = classifyLines(hunkLines, RULES[language]);
    const results: Array<{type: "add" | "del"; isComment: boolean | null}> = [];
    hunkLines.forEach((line, index) => {
        if (line.type === "context") return;
        results.push({type: line.type, isComment: flags[index]});
    });
    return results;
}
