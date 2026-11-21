import less from "less";
import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";

it("scopes Ant input fills, hover and placeholder tokens to property rows outside the query builder", async () => {
  const filename = path.join(__dirname, "product-ui-theme.module.less");
  const { css } = await less.render(await fs.readFile(filename, "utf8"), {
    filename,
  });
  const rules = postcss.parse(css);
  function declaration(control: string, state: string, prop: string) {
    const selector = `.root :global(.labeled-item) :global(.${control}):not(:where(:global(.query-builder) *))${state}`;
    let result: string | undefined;
    rules.walkRules((rule) => {
      if (rule.selectors.includes(selector))
        rule.walkDecls(prop, (decl) => {
          result = decl.value;
        });
    });
    return result;
  }
  for (const control of ["ant-input", "ant-input-number"]) {
    expect(declaration(control, "", "background")).toBe(
      "var(--ant-color-bg-container)",
    );
    expect(declaration(control, "", "color")).toBe("var(--ant-color-text)");
  }
  expect(declaration("ant-input", ":hover", "background")).toBe(
    "var(--ant-color-fill-tertiary)",
  );
  expect(declaration("ant-input", "::placeholder", "color")).toBe(
    "var(--ant-color-text-placeholder)",
  );
});
