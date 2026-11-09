import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { compileReactSource } from "../react-compiler-transform.cjs";

const wab = path.resolve(__dirname, "../..");
it("compiles email components and rejects conditional Hooks, skipped fibers, factories and alias classes", () => {
  const filename = path.join(wab, "src/wab/server/emails/CompilerContract.tsx");
  expect(compileReactSource('import React from "react"; export function EmailContract({name}: {name: string}) { return <div>{name}</div>; }', filename)).toContain('from "react/compiler-runtime"');
  for (const code of [
    'import {useState} from "react"; export function Conditional({on}) { if(on) {const [n]=useState(0);return <p>{n}</p>;}return null;}',
    'export function Skipped() {"use no memo"; return <p>Skipped</p>;}',
    'import React from "react"; type Props = {name: string}; export function makeEmail(): React.ComponentType<Props> { return props => <p>{props.name}</p>; }',
    'import {Component as C} from "react"; export class AliasBoundary extends C { render() {return <p>Class</p>;} }',
  ]) { expect(() => compileReactSource(code, filename)).toThrow(); }
});

it.each(["development", "production"])("executes compiled email SSR through the actual backend loader with one CJS/ESM React owner (%s)", (mode) => {
  const script = `
    const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
    const {createRequire} = require("node:module");
    (async () => {
      const React = require("react");
      const ownerPath = fs.realpathSync("node_modules/react/index.js");
      assert.equal(require.cache[ownerPath].exports, React);
      for (const manifest of ["../../packages/host/package.json", "../../packages/react-web/package.json"]) {
        assert.equal(createRequire(path.resolve(manifest))("react"), React);
      }
      assert.equal((await import("react")).default, React);
      assert.equal((await import("react-dom/server")).renderToStaticMarkup, require("react-dom/server").renderToStaticMarkup);
      const components = require("./src/wab/server/emails/components");
      assert.equal((await import("./src/wab/server/emails/components.tsx")).default.EmailText, components.EmailText);
      assert(components.EmailText.toString().includes("import_compiler_runtime"), "The execution loader must return a genuinely compiled email fiber");
      const {generateEmailHtml} = require("./src/wab/server/emails/tools/generate");
      const {verifyEmailHtml} = require("./src/wab/server/emails/email-html");
      const {emailCompilerProps} = require("./src/wab/server/emails/__testonly__/compiler-contract-props");
      const html = await generateEmailHtml("Comments", emailCompilerProps);
      for(const text of ["Compiler email project", "Mention author", "Comment author", "Reply author", "Reaction author", "Resolver", "Reopener", "resolved", "reopened"]) {assert(html.includes(text), text);}
      assert(!html.includes("Switched to client rendering"));
      assert(!html.includes("data-msg="));
      verifyEmailHtml(html);
      fs.writeFileSync(${JSON.stringify(path.join("/tmp/plasmic-react19-release-20261108", "email-ssr-"))} + ${JSON.stringify(mode)} + ".html", html);
      console.log(JSON.stringify({htmlBytes:html.length, canonicalReact:ownerPath, realServerText:true}));
    })().catch(error=>{console.error(error); process.exitCode=1;});
  `;
  const output = execFileSync(process.execPath, ["-r", "./tools/backend-register.cjs", "-e", script], {cwd:wab, env:{...process.env, NODE_ENV:mode}, encoding:"utf8", timeout:60_000});
  const result = JSON.parse(output.trim());
  assert(result.htmlBytes > 2500, "The SSR contract must contain the full notification body");
  expect(result.realServerText).toBe(true);
});
