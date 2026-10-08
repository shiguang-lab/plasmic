import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Pool } from "pg";
import { AddPreviewPublication1791417600000 } from "../../wab/src/wab/server/migrations/1791417600000-AddPreviewPublication.ts";
import { AddHostlessLibraryVersion1791417600001 } from "../../wab/src/wab/server/migrations/1791417600001-AddHostlessLibraryVersion.ts";

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
const bundle = (label) => ({
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
    projectId,
    entry: "page.js",
    usedComponents: [],
    cssFile: "page.css",
    isPage: true,
    isCode: false,
    isGlobalContextProvider: false,
  })),
  projects: [
    {
      id: projectId,
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
  await new AddPreviewPublication1791417600000().up({
    query: (sql) => pool.query(sql),
  });
  await pool.query('INSERT INTO "project" ("id") VALUES ($1)', [projectId]);
  await pool.query('CREATE TABLE "pkg_version" ("id" text PRIMARY KEY)');
  await new AddHostlessLibraryVersion1791417600001().up({ query: (sql) => pool.query(sql) });
  await pool.query('INSERT INTO "pkg_version" VALUES ($1)', ["library-version-test"]);
  await pool.query('INSERT INTO "hostless_library_version" VALUES ($1, $2::jsonb)', ["library-version-test", JSON.stringify({ digest: "fixed-code" })]);
  await assert.rejects(pool.query('INSERT INTO "hostless_library_version" VALUES ($1, $2::jsonb)', ["library-version-test", JSON.stringify({ digest: "replacement" })]), /duplicate key/);
  await pool.query('DELETE FROM "pkg_version" WHERE "id" = $1', ["library-version-test"]);
  assert.equal((await pool.query('SELECT count(*) FROM "hostless_library_version"')).rows[0].count, "0");
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
  const response = await fetch(
    `${origin}/s/${code}?code=business&path=custom&tag=a&tag=b`,
    { redirect: "manual" },
  );
  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    `/p/${code}/groups?code=business&path=custom&tag=a&tag=b`,
  );
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal((await fetch(`${origin}/s/missing123`)).status, 404);
  assert.equal((await fetch(`${origin}/p/${code}/missing`)).status, 404);
  assert.equal((await fetch(`${origin}/api/healthcheck`)).status, 200);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
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
  await page.goto(`${origin}/s/${code}?code=business&path=custom&tag=a&tag=b`);
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
    await page.waitForURL(`**/p/${code}/groups?status=library`);
    await page.goto(
      `${origin}/s/${code}?code=business&path=custom&tag=a&tag=b`,
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
  await page.waitForURL(`**/p/${code}/detail/42?status=active`);
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
  await page.waitForURL(`**/p/${code}/detail/99?status=mine`);
  await page.getByRole("link", { name: "Groups", exact: true }).click();
  await page.waitForURL(`**/p/${code}/groups?status=all`);

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
  assert.equal((await fetch(`${origin}/p/${code}/groups`)).status, 404);
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
    "PASS: migration, short links, CSS, forms, tabs, overlays, page links, navigation actions, dynamic route refresh, business queries, draft isolation, republish, unpublish and project deletion",
  );
} finally {
  await browser?.close();
  await pool.query(
    'DROP TABLE IF EXISTS "hostless_library_version", "pkg_version", "preview_publication", "project_revision", "project"',
  );
  await pool.end();
}
