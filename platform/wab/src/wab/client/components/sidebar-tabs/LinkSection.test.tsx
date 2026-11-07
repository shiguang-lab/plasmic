import { LinkSection } from "@/wab/client/components/sidebar-tabs/LinkSection";
import type { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { cleanup, render } from "@testing-library/react";
import React from "react";

const mocks = vi.hoisted(() => ({
  textContentRow: vi.fn(),
  htmlAttributePropEditor: vi.fn(),
}));

vi.mock("@/wab/client/components/sidebar/SidebarSection", () => ({
  SidebarSection: (props: {
    title: React.ReactNode;
    "data-test-id"?: string;
    children: React.ReactNode;
  }) =>
    React.createElement(
      "section",
      {
        "data-testid": "link-section",
        "data-title": props.title,
        "data-test-id": props["data-test-id"],
      },
      props.children,
    ),
}));

vi.mock("@/wab/client/components/sidebar-tabs/TypographySection", () => ({
  TextContentRow: (props: Record<string, unknown>) => {
    mocks.textContentRow({ ...props });
    return null;
  },
}));

vi.mock("@/wab/client/components/sidebar-tabs/HTMLAttributesSection", () => ({
  LINK_ATTRS: ["href", "target"],
  HTMLAttributePropEditor: (props: Record<string, unknown>) => {
    mocks.htmlAttributePropEditor({ ...props });
    return null;
  },
}));

afterEach(() => {
  cleanup();
  mocks.textContentRow.mockReset();
  mocks.htmlAttributePropEditor.mockReset();
});

it("renders the link title and passes the exact row props to both editors", () => {
  const viewCtx = {} as ViewCtx;
  const tpl = mkTplTagX("a");
  const expsProvider = {} as TplExpsProvider;

  const { container } = render(
    <LinkSection viewCtx={viewCtx} tpl={tpl} expsProvider={expsProvider} />,
  );

  const section = container.querySelector("section");
  expect(section?.getAttribute("data-title")).toBe("Link");
  expect(section?.getAttribute("data-test-id")).toBe("link-section");
  expect(mocks.textContentRow).toHaveBeenCalledWith({ viewCtx, expsProvider });
  expect(mocks.htmlAttributePropEditor).toHaveBeenCalledTimes(2);
  expect(mocks.htmlAttributePropEditor.mock.calls[0][0]).toEqual({
    viewCtx,
    tpl,
    expsProvider,
    attr: "href",
  });
  expect(mocks.htmlAttributePropEditor.mock.calls[1][0]).toEqual({
    viewCtx,
    tpl,
    expsProvider,
    attr: "target",
  });
});

it("re-renders from its props when the selected template changes", () => {
  const viewCtx = {} as ViewCtx;
  const firstTpl = mkTplTagX("a");
  const secondTpl = mkTplTagX("a");
  const expsProvider = {} as TplExpsProvider;

  const { rerender } = render(
    <LinkSection viewCtx={viewCtx} tpl={firstTpl} expsProvider={expsProvider} />,
  );
  expect(mocks.htmlAttributePropEditor.mock.calls[0][0]).toMatchObject({
    tpl: firstTpl,
  });

  rerender(
    <LinkSection
      viewCtx={viewCtx}
      tpl={secondTpl}
      expsProvider={expsProvider}
    />,
  );
  expect(mocks.textContentRow).toHaveBeenLastCalledWith({
    viewCtx,
    expsProvider,
  });
  const lastEditorProps = mocks.htmlAttributePropEditor.mock.calls.at(-2)?.[0];
  expect(lastEditorProps).toMatchObject({ tpl: secondTpl, attr: "href" });
});
