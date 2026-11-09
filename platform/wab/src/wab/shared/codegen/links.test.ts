import { ensure } from "@/wab/shared/common";
import { transformSync } from "@babel/core";
import { parse } from "@babel/parser";
import { PlasmicPrepassContext, usePlasmicPrepass } from "@plasmicapp/query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import * as compilerRuntime from "react/compiler-runtime";
import fs from "fs";
import path from "path";
import { reactCompilerOptions } from "../../../../tools/react-compiler.mjs";
import { generateSiteFromBundle } from "@/wab/shared/__testonly__/site-tests-utils";
import { Bundle } from "@/wab/shared/bundler";
import _bundle from "@/wab/shared/codegen/__testonly__/bundles/links.json";
import {
  codegen,
  collectSnapshotForDir,
} from "@/wab/shared/codegen/__testonly__/codegen-tests-util";
import { Site } from "@/wab/shared/model/classes";
import "core-js";
import tmp from "tmp";

// This test can be used to test codegen for miscellaneous things. Currently it tests
// Link component (legacy/modern behavior) only
describe("codegen for Link component (legacy/modern behavior)", () => {
  let dir: tmp.DirResult;
  const site: Site = generateSiteFromBundle(_bundle as [string, Bundle][]);

  beforeEach(() => {
    dir = tmp.dirSync({ unsafeCleanup: true });
  });
  afterEach(() => {
    cleanup();
    dir.removeCallback();
  });

  it("should codegen correct contents for legacy Next.js < 13", async () => {
    await codegen(dir.name, site, {
      platform: "nextjs",
      platformVersion: "12.3.4",
      codegenScheme: "blackbox",
      stylesScheme: "css",
    });

    const expectedSnapshot = collectSnapshotForDir(dir.name);
    expect(expectedSnapshot).not.toContain("legacyBehavior");
    expect(expectedSnapshot).toContain('from "next/compat/router"');
  });

  it("should codegen correct contents for Next.js 13.0.0", async () => {
    await codegen(dir.name, site, {
      platform: "nextjs",
      platformVersion: "13.0.0",
      codegenScheme: "blackbox",
      stylesScheme: "css",
    });

    const expectedSnapshot = collectSnapshotForDir(dir.name);
    expect(expectedSnapshot).toContain("legacyBehavior={false}");
  });

  it("should codegen correct contents for Next.js >= 13", async () => {
    await codegen(dir.name, site, {
      platform: "nextjs",
      platformVersion: "^14",
      codegenScheme: "blackbox",
      stylesScheme: "css",
    });
    const expectedSnapshot = collectSnapshotForDir(dir.name);
    expect(expectedSnapshot).toContain("legacyBehavior={false}");
  });

  it("should codegen correct contents for Next.js latest", async () => {
    await codegen(dir.name, site, {
      platform: "nextjs",
      platformVersion: "latest",
      codegenScheme: "blackbox",
      stylesScheme: "css",
    });
    const expectedSnapshot = collectSnapshotForDir(dir.name);
    expect(expectedSnapshot).toContain("legacyBehavior={false}");
  });

  it("separates App Router navigation from query prepass in static native fibers", async () => {
    await codegen(dir.name, site, {
      platform: "nextjs", codegenScheme: "blackbox", stylesScheme: "css",
      platformOptions: { nextjs: { appDir: true } },
    });
    const generated = collectSnapshotForDir(dir.name);
    expect(generated).toContain('from "next/navigation"');
    expect(generated).toContain("usePlasmicPrepass()");
    expect(generated).toContain("__WithNextRouter");
    expect(generated).toContain("nextRouter={nextRouter}");
    expect(generated).not.toContain("function useNextRouter()");

    // Exercise the generated routing boundary itself, with only its model
    // renderer mocked. The framework hook requires a provider at runtime.
    const sourceFile = fs.readdirSync(dir.name).find((name) => name.startsWith("Plasmic") && name.endsWith(".tsx") && fs.readFileSync(path.join(dir.name, name), "utf8").includes("__WithNextRouter"));
    const source = fs.readFileSync(path.join(dir.name, ensure(sourceFile, "Generated App Router module")), "utf8");
    const functions = parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] }).program.body.filter((node) => node.type === "FunctionDeclaration");
    const boundary = ensure(functions.find((node) => node.id?.name.endsWith("__RenderFunc")), "Generated prepass boundary");
    const boundaryName = ensure(boundary.id, "Named router boundary").name;
    const routed = ensure(functions.find((node) => node.id?.name === `${boundaryName}__WithNextRouter`), "Generated native navigation fiber");
    const bodyName = `${boundaryName}__Body`;
    const compiled = transformSync(`${source.slice(ensure(boundary.start, "Boundary start"), ensure(boundary.end, "Boundary end"))}\n${source.slice(ensure(routed.start, "Navigation start"), ensure(routed.end, "Navigation end"))}\nexports.Boundary = ${boundaryName};`, {
      filename: "routing-boundary.tsx", babelrc: false, configFile: false,
      presets: ["@babel/preset-typescript", ["@babel/preset-react", { runtime: "classic" }]],
      plugins: [["babel-plugin-react-compiler", reactCompilerOptions()], "@babel/plugin-transform-modules-commonjs"],
    });
    const RouterContext = React.createContext<{ push(href: string): void } | undefined>(undefined);
    const routerRead = vi.fn();
    function useRouter() { const router = React.useContext(RouterContext); routerRead(); if (!router) { throw new Error("App router is not mounted"); } return router; }
    function Body({ nextRouter }: { nextRouter?: { push(href: string): void } }) { return React.createElement("button", { onClick: () => nextRouter?.push("/destination") }, "Navigate"); }
    const nativeModule = { exports: {} as { Boundary: React.ComponentType<Record<string, unknown>> } };
    const load = new Function("React", "useRouter", "usePlasmicPrepass", bodyName, "require", "exports", ensure(compiled?.code, "Compiled native router boundary"));
    load(React, useRouter, usePlasmicPrepass, Body, (name: string) => { if (name !== "react/compiler-runtime") { throw new Error(`Unexpected boundary import ${name}`); } return compilerRuntime; }, nativeModule.exports);
    const Boundary = nativeModule.exports.Boundary;
    const prepass = render(React.createElement(PlasmicPrepassContext, { cache: new Map() }, React.createElement(Boundary)));
    expect(screen.getByRole("button", { name: "Navigate" })).toBeTruthy();
    expect(routerRead).not.toHaveBeenCalled();
    prepass.unmount();
    const router = { push: vi.fn() };
    render(React.createElement(RouterContext.Provider, { value: router }, React.createElement(Boundary)));
    fireEvent.click(screen.getByRole("button", { name: "Navigate" }));
    expect(routerRead).toHaveBeenCalled(); expect(router.push).toHaveBeenCalledWith("/destination");
  });

  it("should codegen correct contents for React", async () => {
    await codegen(dir.name, site, {
      platform: "react",
      codegenScheme: "blackbox",
      stylesScheme: "css",
    });
    const expectedSnapshot = collectSnapshotForDir(dir.name);
    expect(expectedSnapshot).not.toContain("legacyBehavior");
  });
});
