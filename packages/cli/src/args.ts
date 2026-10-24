export interface ParsedArgs {
    range: string | undefined;
    explain: boolean;
    version: boolean;
}

const FLAGS = ["--explain", "--version"];

export function parseArgs(argv: string[]): ParsedArgs {
    return {
        explain: argv.includes("--explain"),
        version: argv.includes("--version"),
        range: argv.find((arg) => !FLAGS.includes(arg)),
    };
}
