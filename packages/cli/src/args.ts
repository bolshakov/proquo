export interface ParsedArgs {
    range: string | undefined;
    explain: boolean;
    version: boolean;
    help: boolean;
}

const FLAGS = ["--explain", "--version", "--help", "-h"];

export function parseArgs(argv: string[]): ParsedArgs {
    return {
        explain: argv.includes("--explain"),
        version: argv.includes("--version"),
        help: argv.includes("--help") || argv.includes("-h"),
        range: argv.find((arg) => !FLAGS.includes(arg)),
    };
}
