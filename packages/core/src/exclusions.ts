const LOCKFILE_BASENAMES = new Set([
    "package-lock.json",
    "npm-shrinkwrap.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Gemfile.lock",
    "Cargo.lock",
    "go.sum",
    "poetry.lock",
    "uv.lock",
    "composer.lock",
    "mix.lock",
    "Podfile.lock",
    "flake.lock",
]);

const EXCLUDED_DIR_SEGMENTS = new Set(["node_modules", "vendor", "dist", "build", "__generated__", "__snapshots__"]);

const EXCLUDED_SUFFIXES = [".min.js", ".min.css", ".map", ".snap", ".pb.go", "_pb2.py"];

export function isExcluded(filename: string): boolean {
    const segments = filename.split("/");
    const basename = segments[segments.length - 1];
    if (LOCKFILE_BASENAMES.has(basename)) return true;
    if (segments.slice(0, -1).some((s) => EXCLUDED_DIR_SEGMENTS.has(s))) return true;
    return EXCLUDED_SUFFIXES.some((suffix) => basename.endsWith(suffix));
}
