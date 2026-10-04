// Generate registration thumbnails from the installed Ant Design icons.
const { createRequire } = require("node:module");
const { writeFileSync } = require("node:fs");
const path = require("node:path");
const requireAntd = createRequire(
  path.resolve(__dirname, "../../plasmicpkgs/antd-icons/package.json"),
);
const requireIcons = createRequire(
  requireAntd.resolve("@ant-design/icons/package.json"),
);
const icons = requireIcons("@ant-design/icons-svg");
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
function svg(node) {
  const attrs = Object.entries(node.attrs)
    .map(([key, value]) => ` ${key}="${escape(value)}"`)
    .join("");
  return `<${node.tag}${attrs}>${(node.children ?? []).map(svg).join("")}</${node.tag}>`;
}
const catalog = Object.entries(icons)
  .filter(
    ([, icon]) =>
      icon && ["outlined", "filled", "twotone"].includes(icon.theme),
  )
  .map(([name, definition]) => {
    const node =
      typeof definition.icon === "function"
        ? definition.icon("currentColor", "#e6f4ff")
        : definition.icon;
    node.attrs = {
      ...node.attrs,
      xmlns: "http://www.w3.org/2000/svg",
      width: "1em",
      height: "1em",
      fill: "currentColor",
    };
    return { name, theme: definition.theme, svg: svg(node) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(
  path.resolve(
    __dirname,
    "../../plasmicpkgs/antd-icons/src/catalog.json",
  ),
  JSON.stringify(catalog) + "\n",
);
console.log(`Generated ${catalog.length} Ant Design icons.`);
