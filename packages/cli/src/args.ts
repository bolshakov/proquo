export interface ParsedArgs {
    range: string | undefined;
    explain: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
    return {
        explain: argv.includes("--explain"),
        range: argv.find((arg) => arg !== "--explain"),
    };
}
