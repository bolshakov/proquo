import {readFileSync} from "node:fs";
import {build} from "esbuild";

const {version} = JSON.parse(readFileSync("package.json", "utf8"));

await build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    outfile: "bin/proquo.mjs",
    minify: true,
    define: {PROQUO_VERSION: JSON.stringify(version)},
    banner: {
        js: "#!/usr/bin/env node\nimport { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
});
