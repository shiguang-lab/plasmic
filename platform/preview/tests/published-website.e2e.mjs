import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Pool } from "pg";
import { AddPreviewPublication1791417600000 } from "../../wab/src/wab/server/migrations/1791417600000-AddPreviewPublication.ts";
import { AddHostlessLibraryVersion1791417600001 } from "../../wab/src/wab/server/migrations/1791417600001-AddHostlessLibraryVersion.ts";
import { AddPresentationCode1793289600000 } from "../../wab/src/wab/server/migrations/1793289600000-AddPresentationCode.ts";

const connectionString = process.env.PREVIEW_TEST_DATABASE_URI;
assert(
  connectionString &&
    new URL(connectionString).pathname === "/plasmic_preview_test",
  "Use a disposable plasmic_preview_test database",
);
const origin = process.env.PREVIEW_TEST_ORIGIN ?? "http://127.0.0.1:3011";
const require = createRequire(
  new URL("../../wab/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const libraries = process.env.PREVIEW_TEST_LIBRARY_BUNDLE
  ? JSON.parse(await readFile(process.env.PREVIEW_TEST_LIBRARY_BUNDLE, "utf8"))
  : undefined;
const pool = new Pool({ connectionString });
const code = "0123456789";
const projectId = "browser-test-project";
const otherCode = "abcdefghij";
const otherProjectId = "other-browser-test-project";
const pages = ["/groups", "/detail/[id]"].map((path, index) => ({
  id: `page-${index}`,
  name: `Page${index}`,
  path,
}));
const componentCode = (label) => `
  if (typeof window === "undefined") throw new Error("Published code executed on server");
  const React = require("react"), NextLink = require("next/link"), Host = require("@plasmicapp/host");
  const h = React.createElement;
  exports.default = function Page() {
    const router = require("next/router").useRouter();
    const BusinessLink = Host.usePlasmicLink();
    const [value, setValue] = React.useState(""), [tab, setTab] = React.useState("All"), [open, setOpen] = React.useState(false);
    const content = h("main", null,
      h("h1", null, ${JSON.stringify(label)}),
      h("input", {"aria-label":"Filter",value,onChange:e=>setValue(e.target.value)}),
      h("output", {"aria-label":"Filter value"}, value),
      h("button", {onClick:()=>setTab("Mine")}, "My groups"), h("output", {"aria-label":"Current tab"}, tab),
      h("button", {onClick:()=>setOpen(true)}, "Create group"),
      open && h("div", {role:"dialog"}, "New group"),
      h(NextLink, {href:"/detail/42?status=active"}, "Details"),
      h(BusinessLink, {href:"/groups?status=all"}, "Groups"),
      h("button", {onClick:()=>router.push("/detail/99?status=mine")}, "Navigate action"),
      h(NextLink, {href:"?tag=a&tag=b#rules"}, "Query link"),
      h(NextLink, {href:"../groups"}, "Parent link"),
      h(NextLink, {href:{pathname:"/detail/[id]",query:{id:"encoded/value",tag:["a","b"]},hash:"rules"}}, "Object link"),
      h(NextLink, {href:"/groups?new=1",target:"_blank"}, "New tab"),
      h(NextLink, {href:${JSON.stringify(`${origin}/s/${otherCode}#/detail/7?source=other`)}}, "Other publication"),
      h("a", {href:${JSON.stringify(`/s/${otherCode}#/detail/7?source=other`)}}, "Native other publication"),
      h(NextLink, {href:${JSON.stringify(`/s/${code}`)}}, "Presentation entry"),
      h(NextLink, {href:"http://["}, "Malformed link"),
      h("a", {href:"/groups?native=1"}, "Native link"),
      h("a", {href:"/groups?native=blank",target:"_blank"}, "Native new tab"),
      h("a", {href:"/groups?native=middle"}, "Native middle click"),
      h(NextLink, {href:"/api/healthcheck",download:"health.json"}, "Download"),
      h("a", {href:"#rules"}, "Anchor link"),
      h(NextLink, {href:"#discount%"}, "Percent anchor"),
      h(NextLink, {href:"#%E8%A7%84%E5%88%99"}, "Encoded anchor"),
      h("section", {id:"rules"}, "Rules"),
      h("section", {id:"discount%"}, "Discount"),
      h("section", {id:"规则"}, "Chinese rules"),
      h("button", {onClick:()=>router.replace("/detail/100?replaced=yes")}, "Replace action"),
      h("output", {"aria-label":"As path"}, router.asPath),
      h("output", {"aria-label":"Route"}, router.pathname),
      h("output", {"aria-label":"Query"}, JSON.stringify(router.query))
    );
    ${
      libraries
        ? `const {AppShell, ActionGroup} = require("libraries.js");
      return h(AppShell, {language:"en",productName:"Published product",menuItems:[{key:"groups",label:"Library Groups",href:"/groups?status=library"}]},
        h(ActionGroup,{items:[{key:"real",label:"Library action"}],onAction:()=>setValue("Library action clicked")}),content);`
        : "return content;"
    }
  };
`;
const bundle = (label, publicationProjectId = projectId) => ({
  modules: {
    server: [],
    browser: [
      ...(libraries?.modules.browser ?? []),
      {
        type: "code",
        fileName: "page.js",
        imports: [
          "react",
          "next/router",
          "next/link",
          "@plasmicapp/host",
          ...(libraries ? ["libraries.js"] : []),
        ],
        code: componentCode(label),
      },
      {
        type: "code",
        fileName: "root-provider.js",
        imports: ["react", "@plasmicapp/host"],
        code: 'const React = require("react"), Host = require("@plasmicapp/host"); exports.default = function Root(props) { return React.createElement(Host.PlasmicLinkProvider, {Link: props.Link}, props.children); };',
      },
      {
        type: "asset",
        fileName: "page.css",
        source: "main { color: rgb(10, 20, 30); }",
      },
    ],
  },
  components: pages.map((page) => ({
    ...page,
    name: page.name,
    displayName: page.name,
    projectId: publicationProjectId,
    entry: "page.js",
    usedComponents: [],
    cssFile: "page.css",
    isPage: true,
    isCode: false,
    isGlobalContextProvider: false,
  })),
  projects: [
    {
      id: publicationProjectId,
      name: "Browser test",
      version: "1.0.0",
      indirect: false,
      remoteFonts: [],
      hasStyleTokenOverrides: false,
      styleTokensProviderFileName: "",
      globalContextsProviderFileName: "",
    },
  ],
  globalGroups: [],
  activeSplits: [],
  bundleKey: null,
  deferChunksByDefault: false,
  disableRootLoadingBoundaryByDefault: false,
});

let browser;
try {
  await pool.query(
    'CREATE TABLE "project" ("id" text PRIMARY KEY, "deletedAt" timestamptz, "permanentlyDeletedAt" timestamptz)',
  );
  await new AddPresentationCode1793289600000().up({
    query: (sql) => pool.query(sql),
  });
  await new AddPreviewPublication1791417600000().up({
    query: (sql) => pool.query(sql),
  });
  await pool.query('INSERT INTO "project" ("id") VALUES ($1)', [projectId]);
  const allocations = await Promise.all(
    ["first-code", "next--code"].map((candidate) =>
      pool.query(
        'UPDATE "project" SET "presentationCode" = COALESCE("presentationCode", $2) WHERE "id" = $1 RETURNING "presentationCode"',
        [projectId, candidate],
      ),
    ),
  );
  assert.equal(
    allocations[0].rows[0].presentationCode,
    allocations[1].rows[0].presentationCode,
  );
  await assert.rejects(
    pool.query(
      'INSERT INTO "project" ("id", "presentationCode") VALUES ($1, $2)',
      ["another-project", allocations[0].rows[0].presentationCode],
    ),
    /duplicate key/,
  );
  await pool.query('CREATE TABLE "pkg_version" ("id" text PRIMARY KEY)');
  await new AddHostlessLibraryVersion1791417600001().up({
    query: (sql) => pool.query(sql),
  });
  await pool.query('INSERT INTO "pkg_version" VALUES ($1)', [
    "library-version-test",
  ]);
  await pool.query(
    'INSERT INTO "hostless_library_version" VALUES ($1, $2::jsonb)',
    ["library-version-test", JSON.stringify({ digest: "fixed-code" })],
  );
  await assert.rejects(
    pool.query(
      'INSERT INTO "hostless_library_version" VALUES ($1, $2::jsonb)',
      ["library-version-test", JSON.stringify({ digest: "replacement" })],
    ),
    /duplicate key/,
  );
  await pool.query('DELETE FROM "pkg_version" WHERE "id" = $1', [
    "library-version-test",
  ]);
  assert.equal(
    (await pool.query('SELECT count(*) FROM "hostless_library_version"'))
      .rows[0].count,
    "0",
  );
  await pool.query(
    'INSERT INTO "preview_publication" VALUES ($1, $2, $3, true, $4, $5, $6, now())',
    [
      projectId,
      code,
      "1.0.0",
      "/groups",
      JSON.stringify(pages),
      JSON.stringify(bundle("Published v1")),
    ],
  );
  await pool.query('INSERT INTO "project" ("id") VALUES ($1)', [
    otherProjectId,
  ]);
  await pool.query(
    'INSERT INTO "preview_publication" VALUES ($1, $2, $3, true, $4, $5, $6, now())',
    [
      otherProjectId,
      otherCode,
      "1.0.0",
      "/groups",
      JSON.stringify(pages),
      JSON.stringify(bundle("Other published project", otherProjectId)),
    ],
  );
  const response = await fetch(
    `${origin}/s/${code}#/groups?code=business&path=custom&tag=a&tag=b`,
    { redirect: "manual" },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal((await fetch(`${origin}/s/missing123`)).status, 404);
  // The server resolves the publication; unknown hash routes are checked in the browser below.
  assert.equal((await fetch(`${origin}/s/${code}#/missing`)).status, 200);
  assert.equal((await fetch(`${origin}/api/healthcheck`)).status, 200);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(message.text());
    }
  });
  await page.goto(
    `${origin}/s/${code}#/groups?code=business&path=custom&tag=a&tag=b`,
  );
  try {
    await page.getByRole("heading", { name: "Published v1" }).waitFor();
  } catch (error) {
    console.error(await page.locator("body").innerText());
    throw error;
  }
  if (libraries) {
    await page
      .getByRole("button", { name: "Library action", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Filter value").textContent(),
      "Library action clicked",
    );
    await page
      .getByRole("link", { name: "Library Groups", exact: true })
      .first()
      .click();
    await page.waitForURL(`**/s/${code}#/groups?status=library`);
    await page.goto(
      `${origin}/s/${code}#/groups?code=business&path=custom&tag=a&tag=b`,
    );
    await page.getByRole("heading", { name: "Published v1" }).waitFor();
  }
  assert.equal(
    await page
      .locator("main")
      .last()
      .evaluate((element) => getComputedStyle(element).color),
    "rgb(10, 20, 30)",
  );
  assert.deepEqual(JSON.parse(await page.getByLabel("Query").textContent()), {
    code: "business",
    path: "custom",
    tag: ["a", "b"],
  });
  await page.getByLabel("Filter", { exact: true }).fill("Target groups");
  assert.equal(
    await page.getByLabel("Filter value").textContent(),
    "Target groups",
  );
  await page.getByRole("button", { name: "My groups" }).click();
  assert.equal(await page.getByLabel("Current tab").textContent(), "Mine");
  await page.getByRole("button", { name: "Create group" }).click();
  assert.equal(await page.getByRole("dialog").textContent(), "New group");
  await page.getByRole("link", { name: "Details", exact: true }).click();
  await page.waitForURL(`**/s/${code}#/detail/42?status=active`);
  await page
    .getByLabel("Route", { exact: true })
    .filter({ hasText: "/detail/[id]" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Route", { exact: true }).textContent(),
    "/detail/[id]",
  );
  assert.deepEqual(JSON.parse(await page.getByLabel("Query").textContent()), {
    id: "42",
    status: "active",
  });
  await page.reload();
  await page.getByRole("heading", { name: "Published v1" }).waitFor();
  await page.getByRole("button", { name: "Navigate action" }).click();
  await page.waitForURL(`**/s/${code}#/detail/99?status=mine`);
  await page.getByRole("link", { name: "Groups", exact: true }).click();
  await page.waitForURL(`**/s/${code}#/groups?status=all`);

  await page.getByRole("link", { name: "Query link", exact: true }).click();
  await page.waitForURL(`**/s/${code}#/groups?tag=a&tag=b#rules`);
  assert.deepEqual(JSON.parse(await page.getByLabel("Query").textContent()), {
    tag: ["a", "b"],
  });
  assert.equal(
    await page.getByLabel("As path").textContent(),
    "/groups?tag=a&tag=b#rules",
  );
  await page.getByRole("link", { name: "Object link", exact: true }).click();
  await page.waitForURL(
    `**/s/${code}#/detail/encoded%2Fvalue?tag=a&tag=b#rules`,
  );
  assert.deepEqual(JSON.parse(await page.getByLabel("Query").textContent()), {
    id: "encoded/value",
    tag: ["a", "b"],
  });
  await page.goBack();
  await page.waitForURL(`**/s/${code}#/groups?tag=a&tag=b#rules`);
  await page.goForward();
  await page.waitForURL(
    `**/s/${code}#/detail/encoded%2Fvalue?tag=a&tag=b#rules`,
  );
  await page
    .getByRole("button", { name: "Replace action", exact: true })
    .click();
  await page.waitForURL(`**/s/${code}#/detail/100?replaced=yes`);
  await page.goBack();
  await page.waitForURL(`**/s/${code}#/groups?tag=a&tag=b#rules`);
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "New tab", exact: true }).click(),
  ]);
  await popup.getByRole("heading", { name: "Published v1" }).waitFor();
  assert.ok(popup.url().endsWith(`/s/${code}#/groups?new=1`));
  await popup.close();
  for (const [name, query, options] of [
    ["Native new tab", "blank", {}],
    ["Native middle click", "middle", { button: "middle" }],
  ]) {
    const [nativePopup] = await Promise.all([
      page.context().waitForEvent("page"),
      page.getByRole("link", { name, exact: true }).click(options),
    ]);
    await nativePopup.getByRole("heading", { name: "Published v1" }).waitFor();
    assert.ok(nativePopup.url().endsWith(`/s/${code}#/groups?native=${query}`));
    await nativePopup.close();
  }
  assert.equal(
    await page
      .getByRole("link", { name: "Download", exact: true })
      .getAttribute("href"),
    "/api/healthcheck",
  );
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download", exact: true }).click(),
  ]);
  assert.equal(download.url(), `${origin}/api/healthcheck`);
  assert.equal(download.suggestedFilename(), "health.json");
  await page.getByRole("link", { name: "Native link", exact: true }).click();
  await page.waitForURL(`**/s/${code}#/groups?native=1`);
  await page.getByRole("link", { name: "Anchor link", exact: true }).click();
  await page.waitForURL(`**/s/${code}#/groups?native=1#rules`);
  const anchorLink = page.getByRole("link", {
    name: "Anchor link",
    exact: true,
  });
  await anchorLink.dispatchEvent("contextmenu", { button: 2 });
  const menuHref = await anchorLink.getAttribute("href");
  assert.equal(menuHref, `/s/${code}#/groups?native=1#rules`);
  const contextPage = await page.context().newPage();
  await contextPage.goto(new URL(menuHref, origin).href);
  await contextPage.getByRole("heading", { name: "Published v1" }).waitFor();
  await contextPage.close();
  // A relative link used in a context menu must resolve against the latest business route.
  await page.getByRole("link", { name: "Query link", exact: true }).click();
  await page.waitForURL(`**/s/${code}#/groups?tag=a&tag=b#rules`);
  await anchorLink.click();
  assert.ok(page.url().endsWith(`/s/${code}#/groups?tag=a&tag=b#rules`));
  await page.getByRole("link", { name: "Percent anchor", exact: true }).click();
  await page.waitForURL(`**/s/${code}#/groups?tag=a&tag=b#discount%`);
  await page.getByRole("link", { name: "Encoded anchor", exact: true }).click();
  await page.waitForURL(`**/s/${code}#/groups?tag=a&tag=b#%E8%A7%84%E5%88%99`);
  assert.equal(
    await page
      .getByRole("link", { name: "Malformed link", exact: true })
      .getAttribute("href"),
    "http://[",
  );
  for (const name of ["Other publication", "Native other publication"]) {
    await page.getByRole("link", { name, exact: true }).click();
    await page.waitForURL(`**/s/${otherCode}#/detail/7?source=other`);
    await page
      .getByRole("heading", { name: "Other published project", exact: true })
      .waitFor();
    assert.deepEqual(JSON.parse(await page.getByLabel("Query").textContent()), {
      id: "7",
      source: "other",
    });
    await page.goto(`${origin}/s/${code}#/groups`);
    await page
      .getByRole("heading", { name: "Published v1", exact: true })
      .waitFor();
  }
  await page.getByRole("link", { name: "Details", exact: true }).click();
  await page.waitForURL(`**/s/${code}#/detail/42?status=active`);
  await page
    .getByRole("link", { name: "Presentation entry", exact: true })
    .click();
  await page.waitForURL(`**/s/${code}#/groups`);
  for (const hash of ["#//", "#/\\"]) {
    await page.goto(`${origin}/s/${code}${hash}`);
    await page
      .getByRole("alert")
      .filter({ hasText: "Page not found" })
      .waitFor();
  }
  await page.goto(`${origin}/s/${code}#/missing`);
  await page.getByRole("alert").filter({ hasText: "Page not found" }).waitFor();
  await page.goto(`${origin}/s/${code}`);
  await page.waitForURL(`**/s/${code}#/groups`);

  if (process.env.PREVIEW_TEST_REPORT_DIR) {
    await mkdir(process.env.PREVIEW_TEST_REPORT_DIR, { recursive: true });
    await page.screenshot({
      path: `${process.env.PREVIEW_TEST_REPORT_DIR}/published-hash-routing.png`,
      fullPage: true,
    });
  }
  // New drafts live in project revisions, which this runtime never reads.
  await pool.query('CREATE TABLE "project_revision" ("model" text)');
  await pool.query('INSERT INTO "project_revision" VALUES ($1)', [
    "Unpublished draft",
  ]);
  await page.reload();
  await page.getByRole("heading", { name: "Published v1" }).waitFor();
  await pool.query(
    'UPDATE "preview_publication" SET "version" = $1, "bundle" = $2 WHERE "code" = $3',
    ["1.1.0", JSON.stringify(bundle("Published v2")), code],
  );
  await page.goto(`${origin}/s/${code}`);
  await page.getByRole("heading", { name: "Published v2" }).waitFor();
  await pool.query(
    'UPDATE "preview_publication" SET "enabled" = false, "bundle" = NULL WHERE "code" = $1',
    [code],
  );
  assert.equal((await fetch(`${origin}/s/${code}`)).status, 404);
  assert.equal((await fetch(`${origin}/s/${code}`)).status, 404);
  await pool.query(
    'UPDATE "preview_publication" SET "enabled" = true, "bundle" = $1 WHERE "code" = $2',
    [JSON.stringify(bundle("Published v2")), code],
  );
  await pool.query('UPDATE "project" SET "deletedAt" = now() WHERE "id" = $1', [
    projectId,
  ]);
  assert.equal((await fetch(`${origin}/s/${code}`)).status, 404);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: migrations, stable hash URLs, CSS, forms, tabs, overlays, page links, object links, encoded IDs, query/anchor navigation, back/forward, replace, new tabs, native links, downloads, context menus, cross-publication links, malformed URLs, missing pages, entry fallback, dynamic route refresh, repeated business queries, draft isolation, republish, unpublish and project deletion",
  );
} finally {
  await browser?.close();
  await pool.query(
    'DROP TABLE IF EXISTS "hostless_library_version", "pkg_version", "preview_publication", "project_revision", "project"',
  );
  await pool.end();
}
