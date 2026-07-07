import {describe, expect, it} from "vitest";
import {classifyPatchLines, languageFor} from "../src/comments";

describe("languageFor", () => {
    it("maps common extensions to their language", () => {
        expect(languageFor("src/app.ts")).toBe("typescript");
        expect(languageFor("src/app.tsx")).toBe("tsx");
        expect(languageFor("src/app.js")).toBe("javascript");
        expect(languageFor("src/app.jsx")).toBe("jsx");
        expect(languageFor("main.go")).toBe("go");
        expect(languageFor("Main.java")).toBe("java");
        expect(languageFor("lib.rs")).toBe("rust");
        expect(languageFor("script.py")).toBe("python");
        expect(languageFor("script.rb")).toBe("ruby");
        expect(languageFor("app.c")).toBe("c");
        expect(languageFor("app.cpp")).toBe("cpp");
        expect(languageFor("config.yml")).toBe("yaml");
        expect(languageFor("config.yaml")).toBe("yaml");
    });

    it("returns null for unrecognized or extensionless files", () => {
        expect(languageFor("Dockerfile")).toBeNull();
        expect(languageFor("README.md")).toBeNull();
    });
});

describe("classifyPatchLines", () => {
    function patchOf(...lines: string[]): string {
        return lines.join("\n");
    }

    it("classifies a full-line // comment as comment-only", () => {
        const patch = patchOf("@@ -1,1 +1,1 @@", "+// just a comment");
        expect(classifyPatchLines(patch, "typescript")).toEqual([{type: "add", isComment: true}]);
    });

    it("classifies a line with trailing code before a comment as code, not comment", () => {
        const patch = patchOf("@@ -1,1 +1,1 @@", "+const x = 5; // set x");
        expect(classifyPatchLines(patch, "typescript")).toEqual([{type: "add", isComment: false}]);
    });

    it("does not treat // inside a string literal as a comment", () => {
        const patch = patchOf("@@ -1,1 +1,1 @@", '+const url = "https://example.com";');
        expect(classifyPatchLines(patch, "typescript")).toEqual([{type: "add", isComment: false}]);
    });

    it("classifies every line of a multi-line block comment as comment-only", () => {
        const patch = patchOf("@@ -1,3 +1,3 @@", "+/*", "+ * multi-line block comment", "+ */");
        expect(classifyPatchLines(patch, "typescript")).toEqual([
            {type: "add", isComment: true},
            {type: "add", isComment: true},
            {type: "add", isComment: true},
        ]);
    });

    it("uses context lines (not just changed lines) to track block-comment state across the hunk", () => {
        const patch = patchOf(
            "@@ -1,4 +1,5 @@",
            " /*",
            " * an existing block comment",
            "+ * a new line added inside it",
            " */",
        );
        expect(classifyPatchLines(patch, "typescript")).toEqual([{type: "add", isComment: true}]);
    });

    it("recognizes a JSX comment block, treating the wrapping braces as structural, not code", () => {
        const patch = patchOf("@@ -1,1 +1,1 @@", "+{/* a JSX comment */}");
        expect(classifyPatchLines(patch, "jsx")).toEqual([{type: "add", isComment: true}]);
    });

    it("supports Rust's nested block comments across multiple lines", () => {
        const patch = patchOf("@@ -1,3 +1,3 @@", "+/* outer", "+/* inner */", "+still inside outer */");
        expect(classifyPatchLines(patch, "rust")).toEqual([
            {type: "add", isComment: true},
            {type: "add", isComment: true},
            {type: "add", isComment: true},
        ]);
    });

    it("does not nest block comments for non-Rust C-family languages", () => {
        const patch = patchOf("@@ -1,3 +1,3 @@", "+/* outer", "+/* inner */", "+still inside outer */");
        expect(classifyPatchLines(patch, "go")).toEqual([
            {type: "add", isComment: true},
            {type: "add", isComment: true},
            {type: "add", isComment: false},
        ]);
    });

    it("classifies a Python # comment and protects # inside a string", () => {
        const patch = patchOf("@@ -1,2 +1,2 @@", "+# a real comment", '+value = "#not-a-comment"');
        expect(classifyPatchLines(patch, "python")).toEqual([
            {type: "add", isComment: true},
            {type: "add", isComment: false},
        ]);
    });

    it("classifies a Ruby # comment", () => {
        const patch = patchOf("@@ -1,1 +1,1 @@", "+# a comment");
        expect(classifyPatchLines(patch, "ruby")).toEqual([{type: "add", isComment: true}]);
    });

    it("only treats YAML # as a comment when preceded by whitespace or line start", () => {
        const patch = patchOf(
            "@@ -1,2 +1,2 @@",
            "+# a full-line comment",
            "+url: http://example.com#fragment",
        );
        expect(classifyPatchLines(patch, "yaml")).toEqual([
            {type: "add", isComment: true},
            {type: "add", isComment: false},
        ]);
    });

    it("ignores context lines and preserves add/del order", () => {
        const patch = patchOf("@@ -1,3 +1,3 @@", " unchanged", "-// removed comment", "+// added comment");
        expect(classifyPatchLines(patch, "typescript")).toEqual([
            {type: "del", isComment: true},
            {type: "add", isComment: true},
        ]);
    });

    it("treats a blank line as not a comment even inside a block comment", () => {
        const patch = patchOf("@@ -1,3 +1,3 @@", "+/*", "+", "+*/");
        expect(classifyPatchLines(patch, "typescript")).toEqual([
            {type: "add", isComment: true},
            {type: "add", isComment: false},
            {type: "add", isComment: true},
        ]);
    });

    it("does not leak an unresolved block comment from one hunk into a later hunk", () => {
        const patch = patchOf(
            "@@ -1,2 +1,2 @@",
            "+/* an unterminated comment carried by this hunk alone",
            "+still inside, per this hunk",
            "@@ -10,1 +10,1 @@",
            "+const x = 1;",
        );
        expect(classifyPatchLines(patch, "typescript")).toEqual([
            {type: "add", isComment: null},
            {type: "add", isComment: null},
            {type: "add", isComment: false},
        ]);
    });

    it("does not corrupt classification of later lines when an earlier line falsely opens a block comment", () => {
        const patch = patchOf("@@ -1,2 +1,2 @@", "+const pattern = /a\\/*b/;", "+const y = 2;");
        expect(classifyPatchLines(patch, "typescript")).toEqual([
            {type: "add", isComment: null},
            {type: "add", isComment: null},
        ]);
    });

    it("does not corrupt classification of a later comment when an unpaired quote leaves a string unresolved", () => {
        const patch = patchOf("@@ -1,2 +1,2 @@", "+const r = /'/;", "+// this is a real comment");
        expect(classifyPatchLines(patch, "typescript")).toEqual([
            {type: "add", isComment: null},
            {type: "add", isComment: null},
        ]);
    });

    it("keeps a YAML single-quoted string ending in a backslash from swallowing the next line's comment", () => {
        const patch = patchOf("@@ -1,2 +1,2 @@", "+path: 'C:\\'", "+# a real comment");
        expect(classifyPatchLines(patch, "yaml")).toEqual([
            {type: "add", isComment: false},
            {type: "add", isComment: true},
        ]);
    });
});
