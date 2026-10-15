import { renderPageHead } from "@/wab/shared/codegen/react-p/page-metadata";
import { makePlasmicComponentName } from "@/wab/shared/codegen/react-p/serialize-utils";
import { SerializerBaseContext } from "@/wab/shared/codegen/react-p/types";
import { ExportOpts } from "@/wab/shared/codegen/types";
import { ensure } from "@/wab/shared/common";
import { Component, PageMeta } from "@/wab/shared/model/classes";
import { transformSync } from "esbuild";
import fs from "fs";
import path from "path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mock } from "vitest-mock-extended";

const metadata = {
  title: "Audit Metadata 20261013",
  description: "Audit query, repeat and metadata acceptance.",
  ogImageSrc: "https://example.com/audit.png",
  alternates: { canonical: "https://example.com/audit" },
};
function context(platform: ExportOpts["platform"]) {
  const component = mock<Component>({
    name: "AuditPage",
    pageMeta: mock<PageMeta>({
      title: metadata.title,
      description: metadata.description,
      openGraphImage: metadata.ogImageSrc,
      canonical: metadata.alternates.canonical,
    }),
  });
  return mock<SerializerBaseContext>({
    component,
    exportOpts: mock<ExportOpts>({ platform, skipHead: false }),
    s3ImageLinks: {},
  });
}
function render(ctx: SerializerBaseContext, values = metadata) {
  const generated = renderPageHead(ctx, ctx.component);
  const { code } = transformSync(
    `function render() { return <html><head>${generated}</head><body><h1>C055 local metadata verification</h1></body></html>; }`,
    { loader: "jsx", jsxFactory: "React.createElement" },
  );
  const element = new Function(
    "React",
    "pageMetadata",
    makePlasmicComponentName(ctx.component),
    `${code}\nreturn render();`,
  )(React, values, { pageMetadata: values });
  const html = "<!doctype html>" + renderToStaticMarkup(element);
  return { html, document: new DOMParser().parseFromString(html, "text/html") };
}

for (const platform of ["nextjs", "gatsby"] as const) {
  it(`${platform} generated head renders standard and social metadata with current values`, () => {
    const ctx = context(platform);
    const { html, document } = render(ctx);
    expect(document.title).toBe(metadata.title);
    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(
      1,
    );
    expect(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content"),
    ).toBe(metadata.description);
    expect(document.querySelector('meta[property="description"]')).toBeNull();
    for (const key of ["title", "description", "image"]) {
      const value = key === "image" ? metadata.ogImageSrc : metadata[key];
      expect(
        document
          .querySelector(`meta[property="og:${key}"]`)
          ?.getAttribute("content"),
      ).toBe(value);
      expect(
        document
          .querySelector(`meta[name="twitter:${key}"]`)
          ?.getAttribute("content"),
      ).toBe(value);
    }
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe(metadata.alternates.canonical);
    const updated = {
      ...metadata,
      title: "Updated 中文",
      description: '中文 <tag> & "quoted" description',
    };
    const next = render(ctx, updated).document;
    expect(next.title).toBe(updated.title);
    expect(
      next.querySelector('meta[name="description"]')?.getAttribute("content"),
    ).toBe(updated.description);
    expect(
      next
        .querySelector('meta[property="og:description"]')
        ?.getAttribute("content"),
    ).toBe(updated.description);
    const evidence = process.env.PLASMIC_C055_EVIDENCE_DIR;
    if (evidence) {
      fs.mkdirSync(evidence, { recursive: true });
      fs.writeFileSync(
        path.join(evidence, `c055-${platform}-generated.html`),
        html,
      );
    }
  });
}
it("omits an unconfigured description and honors skipHead", () => {
  const ctx = context("nextjs");
  ensure(ctx.component.pageMeta, "AuditPage metadata must exist").description =
    "";
  expect(
    render(ctx).document.querySelector('meta[name="description"]'),
  ).toBeNull();
  ctx.exportOpts.skipHead = true;
  expect(renderPageHead(ctx, ctx.component)).toBe("");
});
