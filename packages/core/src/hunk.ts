export interface HunkLine {
    type: "add" | "del" | "context";
    content: string;
}

export function parseHunkLines(patch: string): HunkLine[] {
    const lines: HunkLine[] = [];
    for (const rawLine of patch.split("\n")) {
        if (rawLine.startsWith("@@") || rawLine.startsWith("+++") || rawLine.startsWith("---")) continue;
        if (rawLine.startsWith("+")) {
            lines.push({type: "add", content: rawLine.slice(1)});
        } else if (rawLine.startsWith("-")) {
            lines.push({type: "del", content: rawLine.slice(1)});
        } else if (rawLine.startsWith(" ")) {
            lines.push({type: "context", content: rawLine.slice(1)});
        }
    }
    return lines;
}
