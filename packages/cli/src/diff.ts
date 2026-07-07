import type {PrFile} from "@proquo/core";

function newPathFromNumstatFilename(raw: string): string {
    const braceMatch = /^(.*)\{(.*) => (.*)\}(.*)$/.exec(raw);
    if (braceMatch) {
        const [, prefix, , after, suffix] = braceMatch;
        return `${prefix}${after}${suffix}`;
    }
    const wholeMatch = /^(.*) => (.*)$/.exec(raw);
    if (wholeMatch) return wholeMatch[2];
    return raw;
}

export function parseNumstat(output: string): PrFile[] {
    const files: PrFile[] = [];
    for (const line of output.split("\n")) {
        if (line.trim() === "") continue;
        const parts = line.split("\t");
        if (parts.length < 3) continue;
        const additions = parts[0] === "-" ? 0 : Number(parts[0]);
        const deletions = parts[1] === "-" ? 0 : Number(parts[1]);
        if (Number.isNaN(additions) || Number.isNaN(deletions)) continue;
        const filename = newPathFromNumstatFilename(parts.slice(2).join("\t"));
        files.push({filename, additions, deletions});
    }
    return files;
}

export function splitPatches(fullDiff: string): Map<string, string> {
    const patches = new Map<string, string>();
    let currentFile: string | null = null;
    let currentLines: string[] = [];

    const flush = () => {
        if (currentFile !== null) {
            patches.set(currentFile, currentLines.join("\n"));
        }
        currentFile = null;
        currentLines = [];
    };

    for (const line of fullDiff.split("\n")) {
        if (line.startsWith("diff --git ")) {
            flush();
            continue;
        }
        if (line.startsWith("+++ b/")) {
            currentFile = line.slice("+++ b/".length);
            continue;
        }
        if (currentFile !== null && (currentLines.length > 0 || line.startsWith("@@"))) {
            currentLines.push(line);
        }
    }
    flush();

    return patches;
}
