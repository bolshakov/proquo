export interface HunkLine {
    type: "add" | "del" | "context";
    content: string;
    hunkIndex: number;
}

export function parseHunkLines(patch: string): HunkLine[] {
    const lines: HunkLine[] = [];
    let hunkIndex = -1;
    for (const rawLine of patch.split("\n")) {
        if (rawLine.startsWith("@@")) {
            hunkIndex += 1;
            continue;
        }
        if (hunkIndex === -1) continue;
        if (rawLine.startsWith("+")) {
            lines.push({type: "add", content: rawLine.slice(1), hunkIndex});
        } else if (rawLine.startsWith("-")) {
            lines.push({type: "del", content: rawLine.slice(1), hunkIndex});
        } else if (rawLine.startsWith(" ")) {
            lines.push({type: "context", content: rawLine.slice(1), hunkIndex});
        }
    }
    return lines;
}
