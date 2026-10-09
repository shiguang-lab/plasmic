import { messages } from "@/wab/client/i18n/locales";
import { parse } from "@babel/parser";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { capitalize, underscored } from "underscore.string";

it("covers built-in Ant Design property labels, descriptions and choice captions", () => {
  const directory = path.resolve(process.cwd(), "../../plasmicpkgs/antd6/src");
  const missing = new Set<string>();
  const types = new Set([
    "string",
    "number",
    "boolean",
    "object",
    "array",
    "color",
    "slot",
    "href",
    "choice",
    "eventHandler",
  ]);
  const technicalChoices = new Set([
    "403",
    "404",
    "500",
    "PDF",
    "hex",
    "hsb",
    "rgb",
    "svg",
  ]);
  const caption = (value: string) => {
    if (!technicalChoices.has(value) && !Object.hasOwn(messages.en, value)) {
      missing.add(value);
    }
  };
  const humanize = (value: string) =>
    capitalize(underscored(value).replace(/_/g, " ").trim()).replace(
      /\bid\b/gi,
      "ID",
    );
  function scan(directoryPath: string) {
    for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
      const file = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        scan(file);
        continue;
      }
      if (
        !/\.(ts|tsx)$/.test(file) ||
        /test|stories/.test(entry.name) ||
        entry.name === "componentSections.ts"
      ) {
        continue;
      }
      const source = parse(readFileSync(file, "utf8"), {
        sourceType: "module",
        plugins: ["typescript", "jsx"],
      });
      function visit(node: any, parent?: any) {
        if (!node || typeof node !== "object") {
          return;
        }
        if (node.type === "ObjectProperty") {
          const key = node.key.name ?? node.key.value;
          const value = node.value;
          const isComponent = parent?.properties?.some(
            (property: any) => property.key?.name === "props",
          );
          if (
            ["displayName", "description", "helpText"].includes(key) &&
            value.type === "StringLiteral" &&
            !types.has(value.value) &&
            !isComponent
          ) {
            caption(value.value);
          }
          if (
            value.type === "StringLiteral" &&
            types.has(value.value) &&
            ![
              "type",
              "variableType",
              "name",
              "styleSections",
              "content",
            ].includes(key)
          ) {
            caption(humanize(key));
          }
          if (
            value.type === "ObjectExpression" &&
            !["itemType", "props", "type"].includes(key) &&
            value.properties.some(
              (property: any) =>
                property.key?.name === "type" &&
                types.has(property.value?.value),
            )
          ) {
            caption(humanize(key));
          }
          if (key === "options" && value.type === "ArrayExpression") {
            for (const option of value.elements) {
              if (
                option?.type === "StringLiteral" &&
                !technicalChoices.has(option.value)
              ) {
                caption(option.value);
              }
              const label = option?.properties?.find(
                (property: any) => property.key?.name === "label",
              );
              if (label?.value?.type === "StringLiteral") {
                caption(label.value.value);
              }
            }
          }
        }
        if (
          node.type === "CallExpression" &&
          node.callee?.name === "choice" &&
          node.arguments[0]?.type === "ArrayExpression"
        ) {
          for (const option of node.arguments[0].elements) {
            if (
              option?.type === "StringLiteral" &&
              !technicalChoices.has(option.value)
            ) {
              caption(option.value);
            }
          }
        }
        for (const [key, value] of Object.entries(node)) {
          if (["loc", "start", "end", "extra"].includes(key)) {
            continue;
          }
          if (Array.isArray(value)) {
            value.forEach((child) => visit(child, node));
          } else if (value && typeof value === "object") {
            visit(value, node);
          }
        }
      }
      visit(source);
    }
  }
  scan(directory);
  expect([...missing].sort()).toEqual([]);
});
