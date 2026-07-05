import {build} from "esbuild";

await build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    outfile: "bin/proquo.mjs",
    minify: true,
    banner: {
        js: "#!/usr/bin/env node\nimport { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
});
