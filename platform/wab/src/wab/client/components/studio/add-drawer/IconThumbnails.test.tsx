import { productTheme } from "@/wab/client/antd-theme";
import AddDrawerItem from "@/wab/client/components/studio/add-drawer/AddDrawerItem";
import { AddItemType, AddTplItem } from "@/wab/client/definitions/insertables";
import * as frameWindows from "@/wab/client/frame-ctx/windows";
import type { SubDeps } from "@/wab/client/components/canvas/subdeps";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { AccountBookFilled, AccountBookTwoTone } from "@ant-design/icons";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { ConfigProvider, theme } from "antd";
import React from "react";
import * as ReactDOMClient from "react-dom/client";

vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ locale: "en", t: (text: string) => text }),
}));

const hostCreateElement = vi.fn(React.createElement);
const host = { React: { ...React, createElement: hostCreateElement }, ReactDOMClient: { ...ReactDOMClient } } as unknown as SubDeps;
beforeEach(() => {
  vi.spyOn(frameWindows, "getRootSub").mockReturnValue(host);
});
afterEach(async () => {
  cleanup();
  await Promise.resolve();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  hostCreateElement.mockClear();
});

function iconItem(twoTone = false, thumbnailUrl?: string, importPath = "@ant-design/icons"): AddTplItem {
  const name = twoTone ? "AccountBookTwoTone" : "AccountBookFilled";
  return {
    type: AddItemType.tpl,
    key: `icon-${name}`,
    label: name,
    icon: <svg data-testid="placeholder" />,
    factory: () => undefined,
    previewImageUrl: thumbnailUrl,
    component: mkCodeComponent(name, { name, importPath, props: {}, thumbnailUrl }, {}),
  };
}

function studio(twoTone = false) {
  return {
    getHostLessComponentsMap: () => new Map(),
    getCodeComponentsRegistration: () => [{
      component: twoTone ? AccountBookTwoTone : AccountBookFilled,
      meta: { name: twoTone ? "AccountBookTwoTone" : "AccountBookFilled" },
    }],
  } as unknown as StudioCtx;
}

it("uses the Studio runtime for hostless registrations instead of the parent Host runtime", async () => {
  const createElement = vi.fn(React.createElement);
  vi.stubGlobal("__Sub", { ...host, React: { ...React, createElement } });
  vi.mocked(frameWindows.getRootSub).mockImplementation(() => {
    throw new Error("Host runtime must not render a hostless registration");
  });
  const ctx = studio();
  ctx.getHostLessComponentsMap = () => new Map([
    ["AccountBookFilled", { impl: AccountBookFilled, meta: { name: "AccountBookFilled", props: {}, importPath: "@ant-design/icons" } }],
  ]);
  const { container } = render(<AddDrawerItem variant="card" studioCtx={ctx} item={iconItem()} />);
  await waitFor(() => expect(container.querySelector(".anticon")).toBeTruthy());
  expect(createElement).toHaveBeenCalledWith(AccountBookFilled, expect.any(Object));
  expect(hostCreateElement).not.toHaveBeenCalled();
});

it.each([false, true])("renders the registered icon with Host React and updates theme without changing the model (two tone: %s)", async (twoTone) => {
  const item = iconItem(twoTone);
  const model = JSON.stringify(item.component);
  const card = (appearance: "light" | "dark") => (
    <ConfigProvider theme={productTheme(appearance)}>
      <AddDrawerItem variant="card" studioCtx={studio(twoTone)} item={item} />
    </ConfigProvider>
  );
  const { container, rerender } = render(card("light"));
  for (const appearance of ["light", "dark", "light"] as const) {
    rerender(card(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    const expectedStyle = document.createElement("span").style;
    expectedStyle.color = token.colorText;
    await waitFor(() => {
      const icon = container.querySelector(".anticon");
      expect(icon).toBeTruthy();
      expect((icon as HTMLElement).style.color).toBe(expectedStyle.color);
      if (twoTone) {
        expect([...container.querySelectorAll("path")].some((p) => p.getAttribute("fill") === token.colorPrimaryBgHover)).toBe(true);
      }
    });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")?.getAttribute("fill")).toBe("currentColor");
    expect(JSON.stringify(item.component)).toBe(model);
  }
  expect(hostCreateElement).toHaveBeenCalledWith(twoTone ? AccountBookTwoTone : AccountBookFilled, expect.objectContaining({ twoToneColor: expect.any(Array) }));
});

it.each(["https://example.com/preview.svg", "data:image/svg+xml,%3Csvg/%3E"])("uses explicit thumbnail %s without running the icon component or changing its colors", (thumbnailUrl) => {
  const item = iconItem(true, thumbnailUrl);
  const { container } = render(
    <ConfigProvider theme={productTheme("dark")}>
      <AddDrawerItem variant="card" studioCtx={studio(true)} item={item} />
    </ConfigProvider>,
  );
  expect(container.querySelector("img")?.getAttribute("src")).toBe(thumbnailUrl);
  expect(container.querySelector(".anticon")).toBeNull();
  expect(hostCreateElement).not.toHaveBeenCalled();
  expect(item.component?.codeComponentMeta?.thumbnailUrl).toBe(thumbnailUrl);
});

it("falls back to the actual icon on image failure and honors a different thumbnail on reuse", async () => {
  const item = iconItem(false, "/broken.svg");
  const { container, rerender } = render(<AddDrawerItem variant="card" studioCtx={studio()} item={item} />);
  fireEvent.error(container.querySelector("img") as HTMLImageElement);
  await waitFor(() => expect(container.querySelector(".anticon")).toBeTruthy());
  expect(container.querySelector("img")).toBeNull();
  rerender(<AddDrawerItem variant="card" studioCtx={studio()} item={{ ...item, previewImageUrl: "/replacement.svg" }} />);
  await waitFor(() => expect(container.querySelector(".anticon")).toBeNull());
  expect(container.querySelector("img")?.getAttribute("src")).toBe("/replacement.svg");
});

it("does not run ordinary business components and uses a placeholder if their image fails", () => {
  const item = iconItem(false, "/broken.svg", "business-components");
  const getRegistrations = vi.fn();
  const { container, getByTestId } = render(<AddDrawerItem variant="card" studioCtx={{ getCodeComponentsRegistration: getRegistrations } as unknown as StudioCtx} item={item} />);
  fireEvent.error(container.querySelector("img") as HTMLImageElement);
  expect(getByTestId("placeholder")).toBeTruthy();
  expect(getRegistrations).not.toHaveBeenCalled();
  expect(hostCreateElement).not.toHaveBeenCalled();
});

it("unmounts Host icon roots when virtualized cards leave the list, including StrictMode", async () => {
  const unmount = vi.fn();
  const createRoot = ReactDOMClient.createRoot;
  vi.spyOn(host.ReactDOMClient as typeof ReactDOMClient, "createRoot").mockImplementation((container, options) => {
    const root = createRoot(container, options);
    const originalUnmount = root.unmount.bind(root);
    root.unmount = () => { unmount(); originalUnmount(); };
    return root;
  });
  const { container, unmount: unmountCard } = render(<React.StrictMode><AddDrawerItem variant="card" studioCtx={studio()} item={iconItem()} /></React.StrictMode>);
  await waitFor(() => expect(container.querySelectorAll(".anticon")).toHaveLength(1));
  const before = unmount.mock.calls.length;
  unmountCard();
  await waitFor(() => expect(unmount).toHaveBeenCalledTimes(before + 1));
});
