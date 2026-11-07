export const projectId = "renderer-test-project";
const module = {
  type: "code",
  fileName: "page.js",
  imports: ["react", "@plasmicapp/query"],
  code: `
    const React = require("react");
    const { usePlasmicQueryData } = require("@plasmicapp/query");
    exports.default = function Page(props) {
      if (props.fail) throw new Error("Expected renderer failure");
      if (props.probeSeccomp) process.getuid();
      if (props.hang) { while (true) {} }
      const [count, setCount] = React.useState(0);
      const { data } = usePlasmicQueryData("renderer-data", async () => {
        if (typeof window !== "undefined") window.queryFetches++;
        const response = props.dataUrl ? await fetch(props.dataUrl, props.post ? {
          method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({label:props.label}),
        } : undefined) : undefined;
        const network = response ? await response.json() : undefined;
        return { label: props.label, zero: 0, disabled: false, empty: "", networkStatus: response?.status, network };
      });
      return React.createElement("main", null,
        React.createElement("h1", null, props.label),
        React.createElement("output", {"aria-label": "Query"}, JSON.stringify(data) ?? "loading"),
        React.createElement("button", { onClick: () => setCount(count + 1) }, "Count " + count)
      );
    };
  `,
};
const rootProvider = {
  type: "code",
  fileName: "root-provider.js",
  imports: [],
  code: "exports.default = function Root(props) { return props.children; };",
};
const bundle = {
  modules: { server: [module, rootProvider], browser: [module, rootProvider] },
  components: [
    {
      id: "renderer-page",
      name: "RendererPage",
      displayName: "Renderer page",
      projectId,
      entry: "page.js",
      usedComponents: [],
      cssFile: "page.css",
      isPage: true,
      isCode: false,
      isGlobalContextProvider: false,
    },
  ],
  projects: [
    {
      id: projectId,
      name: "Renderer test",
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
};
export const renderData = {
  bundle,
  entryCompMetas: bundle.components,
  remoteFontUrls: [],
};
