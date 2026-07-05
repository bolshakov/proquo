import type {PrFile} from "@proquo/core";

export function parseNumstat(output: string): PrFile[] {
    const files: PrFile[] = [];
    for (const line of output.split("\n")) {
        if (line.trim() === "") continue;
        const parts = line.split("\t");
        if (parts.length < 3) continue;
        const additions = parts[0] === "-" ? 0 : Number(parts[0]);
        const deletions = parts[1] === "-" ? 0 : Number(parts[1]);
        if (Number.isNaN(additions) || Number.isNaN(deletions)) continue;
        const filename = parts.slice(2).join("\t");
        files.push({filename, additions, deletions});
    }
    return files;
}
