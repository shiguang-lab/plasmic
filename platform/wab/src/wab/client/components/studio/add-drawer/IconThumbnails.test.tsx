import { productTheme } from "@/wab/client/antd-theme";
import AddDrawerItem from "@/wab/client/components/studio/add-drawer/AddDrawerItem";
import { AddItemType, AddTplItem } from "@/wab/client/definitions/insertables";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ensure } from "@/wab/shared/common";
import { parseDataUrlToSvgXml, parseSvgXml } from "@/wab/shared/data-urls";
import { cleanup, render } from "@testing-library/react";
import { ConfigProvider, theme } from "antd";
import React from "react";

vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ locale: "en", t: (text: string) => text }),
}));

afterEach(cleanup);

function iconItem(twoTone: boolean, importPath = "@ant-design/icons"): AddTplItem {
  const name = twoTone ? "AccountBookTwoTone" : "AccountBookFilled";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="112" viewBox="0 0 192 112" color="#1f1f1f"><svg x="80" y="40" width="32" height="32" fill="currentColor"><path d="M0 0h32v32H0z"/>${twoTone ? '<path fill="#e6f4ff" d="M8 8h16v16H8z"/>' : ""}</svg></svg>`;
  const thumbnailUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return {
    type: AddItemType.tpl,
    key: `icon-${name}`,
    label: name,
    icon: null,
    factory: () => undefined,
    previewImageUrl: thumbnailUrl,
    component: mkCodeComponent(name, { name, importPath, props: {}, thumbnailUrl }, {}),
  };
}

it.each([false, true])("updates the rendered icon thumbnail when the theme changes (two tone: %s)", (twoTone) => {
  const item = iconItem(twoTone);
  const originalThumbnail = item.previewImageUrl;
  const card = (appearance: "light" | "dark") => (
    <ConfigProvider theme={productTheme(appearance)}>
      <AddDrawerItem variant="card" studioCtx={{} as StudioCtx} item={item} />
    </ConfigProvider>
  );
  const { container, rerender } = render(card("light"));
  for (const appearance of ["light", "dark", "light"] as const) {
    rerender(card(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    const uri = container.querySelector("img")?.getAttribute("src");
    expect(uri).toBeTruthy();
    const svg = parseSvgXml(parseDataUrlToSvgXml(ensure(uri, "Missing icon thumbnail")));
    expect(svg.getAttribute("color")).toBe(token.colorText);
    expect(svg.querySelector("svg")?.getAttribute("fill")).toBe("currentColor");
    expect(svg.getAttribute("viewBox")).toBe("0 0 192 112");
    if (twoTone) {
      expect(svg.querySelector("path[fill]")?.getAttribute("fill")).toBe(token.colorPrimaryBgHover);
      expect(token.colorPrimaryBgHover).not.toBe(token.colorText);
    }
    expect(item.previewImageUrl).toBe(originalThumbnail);
    expect(item.component?.codeComponentMeta?.thumbnailUrl).toBe(originalThumbnail);
  }
});

it("preserves ordinary component thumbnails under the dark theme", () => {
  const item = iconItem(false, "business-components");
  const { container } = render(
    <ConfigProvider theme={productTheme("dark")}>
      <AddDrawerItem variant="card" studioCtx={{} as StudioCtx} item={item} />
    </ConfigProvider>,
  );
  expect(container.querySelector("img")?.getAttribute("src")).toBe(item.previewImageUrl);
});
