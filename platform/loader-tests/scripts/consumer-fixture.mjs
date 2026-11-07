import { createServer } from "node:http";

export const fixtureProjectId = "cpa-consumer-fixture";
export const fixtureData = { zero: 0, disabled: false, empty: "" };

const page = {
  type: "code", fileName: "fixture-page.js", imports: ["react", "@plasmicapp/query"],
  code: `
    const React = require("react");
    const {usePlasmicQueryData} = require("@plasmicapp/query");
    exports.default = function FixturePage() {
      const [count, setCount] = React.useState(0);
      const {data} = usePlasmicQueryData("cpa-query", async () => {
        if (typeof window !== "undefined") window.cpaQueryCalls = (window.cpaQueryCalls || 0) + 1;
        return {zero:0,disabled:false,empty:"",source:typeof window === "undefined" ? "native-prepass" : "client"};
      });
      return React.createElement("main", null,
        React.createElement("h1", {className:"fixture-title"}, "Fixture Home"),
        React.createElement("output", {"aria-label":"Fixture data"}, data ? JSON.stringify(data) : "loading"),
        React.createElement("button", {onClick:()=>setCount(value=>value+1)}, "Count " + count)
      );
    };
  `,
};
const root = {
  type: "code", fileName: "root-provider.js", imports: [],
  code: "exports.default = function Root(props) { return props.children; };",
};
const serverQueries = {
  type: "code", fileName: "fixture-server-queries.js",
  imports: ["react", "@plasmicapp/loader-runtime-registry"],
  code: `
    const React = require("react");
    const registry = require("@plasmicapp/loader-runtime-registry");
    exports.requiredServerQueryFunctions = [{name:"getData",namespace:"fixture",alias:"__fn_fixture__getData"}];
    exports.getPlasmicQueriesData = async function() {
      if (typeof React.useState === "function") throw new Error("Expected native server React exports");
      return {"cpa-query": await registry.functions.__fn_fixture__getData()};
    };
    exports.generateMetadata = async function() {
      const data = await registry.functions.__fn_fixture__getData();
      return {title:"Fixture Home",description:data.requestId};
    };
  `,
};
const bundle = {
  modules: {
    server: [page, root, serverQueries],
    browser: [page, root, serverQueries, {
      type: "asset", fileName: "fixture.css", source: ".fixture-title { color: rgb(10, 20, 30); }",
    }],
  },
  components: [{
    id: "fixture-page", projectId: fixtureProjectId, name: "FixturePage", displayName: "FixturePage",
    path: "/", entry: "fixture-page.js", usedComponents: [], cssFile: "fixture.css",
    isPage: true, isCode: false, isGlobalContextProvider: false,
    pageMetadata: { path: "/", title: "Fixture Home", description: "Fixture metadata" },
    serverQueriesExecFuncFileName: "fixture-server-queries.js",
  }],
  projects: [{
    id: fixtureProjectId, name: "CPA consumer fixture", version: "1.0.0", indirect: false,
    remoteFonts: [], hasStyleTokenOverrides: false, styleTokensProviderFileName: "", globalContextsProviderFileName: "",
  }],
  globalGroups: [], activeSplits: [], bundleKey: null,
  deferChunksByDefault: false, disableRootLoadingBoundaryByDefault: false,
};

export async function startConsumerFixture() {
  const requests = [];
  const server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
    const path = new URL(request.url, "http://fixture").pathname;
    requests.push(path);
    response.setHeader("Content-Type", "application/json");
    if (path === "/api/v1/loader/code/published") {
      response.writeHead(302, { Location: "/api/v1/loader/code/published/fixture" }).end();
    } else if (path === "/api/v1/loader/code/preview" || path === "/api/v1/loader/code/published/fixture") {
      response.end(JSON.stringify(bundle));
    } else {
      response.writeHead(404).end(JSON.stringify({ error: "Unknown fixture request" }));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
