// Generate the registration inventory without duplicating official SVG paths.
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
const catalog = Object.entries(icons)
  .filter(
    ([, icon]) =>
      icon && ["outlined", "filled", "twotone"].includes(icon.theme),
  )
  .map(([name, definition]) => ({ name, theme: definition.theme }))
  .sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(
  path.resolve(__dirname, "../../plasmicpkgs/antd-icons/src/catalog.json"),
  JSON.stringify(catalog) + "\n",
);
console.log(`Generated ${catalog.length} Ant Design icons.`);
