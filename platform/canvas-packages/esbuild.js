const esbuild = require("esbuild");
const alias = require("esbuild-plugin-alias");
const { externalGlobalPlugin } = require("esbuild-plugin-external-global");
const fs = require("fs");
const path = require("path");
const sha256 = require("sha256");
const hostlessPkgNames = require("./hostlessList.json");
const { reactCompilerPlugin } = require("./react-compiler.cjs");

// PNPM does not install dependences from the linked internal-react-slick, so resolve
// them from the locked react-slick installation from @plasmicpkgs/react-slick.
const registeredReactSlickDir = path.dirname(
  require.resolve("@plasmicpkgs/react-slick/package.json"),
);
const installedReactSlickDir = path.dirname(
  require.resolve("react-slick/package.json", {
    paths: [registeredReactSlickDir],
  }),
);
const reactSlickDependencyAliases = Object.fromEntries(
  ["json2mq", "lodash.debounce"].map((dependency) => [
    dependency,
    require.resolve(dependency, {
      paths: [installedReactSlickDir, __dirname],
    }),
  ]),
);

const inlineCssPlugin = () => {
  return {
    name: "esbuild-plugin-inline-css",
    setup(build) {
      build.onLoad({ filter: /\.(css)$/ }, async (args) => {
        const sourcePath = path.resolve(args.resolveDir, args.path);
        const sourceJS = await generateInjectCSS(sourcePath);
        return {
          contents: sourceJS,
          loader: "js",
        };
      });
    },
  };
};

async function generateInjectCSS(sourcePath) {
  const styleID = sha256(sourcePath);
  const sourceCSS = fs.readFileSync(sourcePath);

  return `(function(){
        if (!document.getElementById('${styleID}')) {
            var e = document.createElement('style');
            e.id = '${styleID}';
            e.textContent = ${JSON.stringify(sourceCSS.toString())};
            document.head.appendChild(e);
        }
    })();`;
}

const isProd = process.env.NODE_ENV === "production";
const maybeBuildIndex = parseInt(process.env.BUILD_INDEX);
const watchMode = !!process.env.ESBUILD_WATCH;

// @react/ui imports Antd's ESM component entry points. They must use the same
// ConfigProvider and CSS-in-JS cache as the ordinary `antd` imports.
const antd6Modules = {
  antd: "(__Sub.Antd6 ?? __CanvasPkgs.Antd6)",
  ...Object.fromEntries(
    [
      ["button", "Button"],
      ["config-provider", "ConfigProvider"],
      ["divider", "Divider"],
      ["dropdown", "Dropdown"],
      ["message", "message"],
      ["modal", "Modal"],
      ["notification", "notification"],
      ["tooltip", "Tooltip"],
    ].map(([entry, exported]) => [
      `antd/es/${entry}/index.js`,
      `(__Sub.Antd6 ?? __CanvasPkgs.Antd6).${exported}`,
    ]),
  ),
  "antd/es/locale/zh_CN": "(__Sub.Antd6 ?? __CanvasPkgs.Antd6).localeZhCN",
  "antd/es/locale/zh_CN.js": "(__Sub.Antd6 ?? __CanvasPkgs.Antd6).localeZhCN",
  "antd/lib/locale/en_US.js": "(__Sub.Antd6 ?? __CanvasPkgs.Antd6).localeEnUS",
  "antd/es/locale/en_US": "(__Sub.Antd6 ?? __CanvasPkgs.Antd6).localeEnUS",
  "antd/es/locale/en_US.js": "(__Sub.Antd6 ?? __CanvasPkgs.Antd6).localeEnUS",
};

// We will be bundling the canvas-packages in two different ways:
// 1. Accessing react/jsx-runtime from node_modules/jsx-runtime
// 2. Accessing react/jsx-runtime from __Sub.jsxRuntime
//
// Since the access to __Sub depends on the version of @plasmicapp/host, we need to keep
// both approaches so that older versions of @plasmicapp/host can still work with the
// canvas-packages.
//
// Use the same versioning for every code component bundle.
const clientEntries = [
  {
    pkg: "index",
  },
  { pkg: "antd6-runtime" },
  ...hostlessPkgNames.flatMap((pkg) => [
    {
      pkg,
    },
    {
      pkg,
      useSubJSXRuntime: true,
    },
  ]),
];

const clientConfigs = clientEntries.map(({ pkg, useSubJSXRuntime }) => ({
  entryPoints: [`./src/${pkg}.ts`],
  outfile: `./build/${pkg === "index" ? "client" : pkg}${
    useSubJSXRuntime ? "-v2" : ""
  }.js`,
  plugins: [
    reactCompilerPlugin(),
    externalGlobalPlugin({
      react: "__Sub.React",
      "react-dom": "__Sub.ReactDOM",
      "react-dom/client": "__Sub.ReactDOMClient",
      "@plasmicapp/host": "__Sub",
      "@plasmicapp/query": "__Sub.PlasmicQuery",
      ...(["antd", "antd5", "antd6", "overseas", "react-ui"].includes(pkg) ? antd6Modules : {}),
      ...(pkg.startsWith("commerce-")
        ? { "@plasmicpkgs/commerce": "__PlasmicCommerceCommon" }
        : {}),
      ...(useSubJSXRuntime
        ? {
            "react/jsx-runtime": "__Sub.jsxRuntime",
            "react/jsx-dev-runtime": "__Sub.jsxDevRuntime",
          }
        : {}),
    }),
    alias({
      // Bundle the public runtime while its React import resolves to __Sub.React.
      // The bare "react" external also covers subpaths unless resolved here.
      "react/compiler-runtime": require.resolve("react/compiler-runtime"),
      ...reactSlickDependencyAliases,
      "react-slick": path.join(
        process.cwd(),
        "node_modules/internal-react-slick/lib/index.js",
      ),
      "@ant-design/react-slick": path.join(
        process.cwd(),
        "node_modules/internal-react-slick/lib/index.js",
      ),
      "@plasmicapp/host/registerComponent": path.join(
        process.cwd(),
        "node_modules/@plasmicapp/host/registerComponent/dist/index.esm.js",
      ),
      "@plasmicapp/host/registerGlobalContext": path.join(
        process.cwd(),
        "node_modules/@plasmicapp/host/registerGlobalContext/dist/index.esm.js",
      ),
      "@plasmicapp/host/registerToken": path.join(
        process.cwd(),
        "node_modules/@plasmicapp/host/registerToken/dist/index.esm.js",
      ),
      "@plasmicapp/host/registerFunction": path.join(
        process.cwd(),
        "node_modules/@plasmicapp/host/registerFunction/dist/index.esm.js",
      ),
      ...(useSubJSXRuntime
        ? {}
        : {
            "react/jsx-runtime": path.join(
              process.cwd(),
              "node_modules/react/jsx-runtime.js",
            ),
            "react/jsx-dev-runtime": path.join(
              process.cwd(),
              "node_modules/react/jsx-dev-runtime.js",
            ),
          }),
    }),
    inlineCssPlugin(),
  ],
  external: [
    "react",
    "react-dom",
    "react-dom/client",
    "@plasmicapp/host",
    ...(["antd", "antd5", "antd6", "overseas", "react-ui"].includes(pkg)
      // The exact root import is provided by externalGlobalPlugin. Marking
      // "antd" external here also excludes every subpath, leaving unmapped
      // locale packs as require() calls in the browser bundle.
      ? Object.keys(antd6Modules).filter((name) => name !== "antd")
      : []),
    ...(pkg.startsWith("commerce-") ? ["@plasmicpkgs/commerce"] : []),
    ...(useSubJSXRuntime ? ["react/jsx-runtime", "react/jsx-dev-runtime"] : []),
  ],
  platform: "browser",
  target: "es2020",
  format: "iife",
  bundle: true,
  sourcemap: true,
  minify: isProd,
  watch: watchMode && {
    onRebuild(error) {
      if (error) {
        console.error("watch build failed:", error);
      } else {
        console.log("watch build succeeded");
      }
    },
  },
}));

// We also use esbuild to build server-side packages, which are used for upgrading
// hostless packages via PublishHostless or for creating new hostless packages
// for Playwright tests. All we need to do is to be able to run the
// registerAll() call to see and update component metadata -- we do not need to
// actually use or render the components! So we can just bundle them enough to
// do so, and don't have to worry about all the plugin package-swapping we have
// to do above for client packages.
const serverConfigs = hostlessPkgNames.map((pkg) => ({
  entryPoints: [`./src/${pkg}.ts`],
  outfile: `./build-server/${pkg}.js`,
  format: "cjs",
  platform: "node",
  target: "node14",
  bundle: true,
  minify: isProd,
}));

module.exports = { clientConfigs, serverConfigs };

if (require.main === module) {
  const configs = [
    ...(isNaN(maybeBuildIndex) ? clientConfigs : [clientConfigs[maybeBuildIndex]]),
    ...serverConfigs,
  ];
  Promise.allSettled(configs.map((config) => esbuild.build(config))).then((results) => {
    if (results.some((result) => result.status === "rejected")) {
      process.exitCode = 1;
    } else if (watchMode) {
      console.log("watching...");
    }
  });
}

