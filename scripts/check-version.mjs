import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

const TAG_PATTERN = /^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

export function versionProblems(tag, manifests) {
    if (tag === undefined) {
        const [first, ...rest] = manifests;
        return rest
            .filter((manifest) => manifest.version !== first.version)
            .map((manifest) => `${manifest.name} is at ${manifest.version}, but ${first.name} is at ${first.version}`);
    }
    if (!TAG_PATTERN.test(tag)) return [`tag ${tag} is not in the form vX.Y.Z or vX.Y.Z-prerelease`];
    return manifests
        .filter((manifest) => `v${manifest.version}` !== tag)
        .map((manifest) => `${manifest.name} is at ${manifest.version}, but the tag is ${tag}`);
}

function readManifests(root) {
    const packagesDir = join(root, "packages");
    const paths = [
        join(root, "package.json"),
        ...readdirSync(packagesDir).map((dir) => join(packagesDir, dir, "package.json")),
    ];
    return paths.map((path) => JSON.parse(readFileSync(path, "utf8")));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const problems = versionProblems(process.argv[2], readManifests(root));
    for (const problem of problems) console.error(`::error::${problem}`);
    process.exitCode = problems.length > 0 ? 1 : 0;
}
