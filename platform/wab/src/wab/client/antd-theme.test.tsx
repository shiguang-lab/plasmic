import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import { renderInspector } from "@/wab/client/components/coding/CodePreview";
import ValueViewer from "@/wab/client/components/coding/ValueViewer";
import { Tooltip as ProductTooltip } from "@/wab/client/components/plexus/Tooltip";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { setLanguagePreference } from "@/wab/client/i18n";
import tooltipStyles from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicTooltip.module.css";
import styleTooltipStyles from "@/wab/client/plasmic/plasmic_kit_style_controls/PlasmicTooltip.module.css";
import {
  setAppearancePreference,
  usesProductTheme,
} from "@/wab/client/ui-theme";
import { ensure } from "@/wab/shared/common";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import {
  ConfigProvider,
  DatePicker,
  Drawer,
  Dropdown,
  Popover,
  Tooltip,
  theme,
} from "antd";
import { useTheme } from "antd-style";
import * as React from "react";
import { createPortal } from "react-dom";

function ThemeProbe() {
  const { token } = theme.useToken();
  const style = useTheme();
  return (
    <output
      data-testid="theme"
      data-antd-bg={token.colorBgContainer}
      data-style-bg={style.colorBgContainer}
    />
  );
}
afterEach(cleanup);
it.each([
  ["zh-CN", "一", "二"],
  ["zh-TW", "日", "一"],
  ["ja", "日", "月"],
  ["ko", "일", "월"],
] as const)(
  "uses %s date-library weekdays in product calendars",
  async (locale, firstDay, secondDay) => {
    await setLanguagePreference(locale);
    render(
      <AntdConfigProvider productUI>
        <DatePicker open />
      </AntdConfigProvider>,
    );
    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    expect(headers.slice(0, 2)).toEqual([firstDay, secondDay]);
    expect(headers).not.toContain("Su");
  },
);
it("keeps generated tooltip content readable through theme changes", async () => {
  setAppearancePreference("dark");
  render(
    <AntdConfigProvider productUI>
      <ProductTooltip
        trigger={<button>Manage organization</button>}
        content="Organization settings"
        showArrow
      />
      {createPortal(
        <div
          className={styleTooltipStyles.floatingWindow}
          data-testid="style-tooltip"
        >
          <div className={styleTooltipStyles.slotTargetChildren}>
            Style help
          </div>
        </div>,
        document.body,
      )}
    </AntdConfigProvider>,
  );
  act(() =>
    screen.getByRole("button", { name: "Manage organization" }).focus(),
  );
  const content = await screen.findByText("Organization settings");
  const foreground = ensure(
    content.closest(`.${tooltipStyles.slotTargetContent}`),
    "Expected the generated tooltip content slot",
  );
  const background = ensure(
    content.closest(`.${tooltipStyles.freeBox}`),
    "Expected the generated tooltip surface",
  );
  expect(document.querySelector(`.${tooltipStyles.overlayArrow}`)).toBeNull();
  for (const appearance of ["dark", "light"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    const probe = document.createElement("div");
    probe.style.color = token.colorTextLightSolid;
    probe.style.backgroundColor = token.colorBgSpotlight;
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe);
    expect(getComputedStyle(foreground).color).toBe(expected.color);
    expect(getComputedStyle(background).backgroundColor).toBe(
      expected.backgroundColor,
    );
    const styleTooltip = screen.getByTestId("style-tooltip");
    expect(getComputedStyle(styleTooltip).backgroundColor).toBe(
      expected.backgroundColor,
    );
    expect(getComputedStyle(styleTooltip.children[0]).color).toBe(
      expected.color,
    );
    probe.remove();
  }
});

it("disables Ant Design tooltip and popover arrows in the shared provider", () => {
  render(
    <AntdConfigProvider productUI>
      <Tooltip title="Tooltip help" open>
        <button>Tooltip trigger</button>
      </Tooltip>
      <Popover content="Detailed help" open>
        <button>Popover trigger</button>
      </Popover>
    </AntdConfigProvider>,
  );
  expect(screen.getByText("Tooltip help")).toBeTruthy();
  expect(screen.getByText("Detailed help")).toBeTruthy();
  expect(
    document.querySelector(".ant-tooltip-arrow, .ant-popover-arrow"),
  ).toBeNull();
});
it.each(["popover", "tooltip", "dropdown", "modal", "drawer"] as const)(
  "carries the product palette into a %s mounted outside the body theme scope",
  async (kind) => {
    const popupHost = document.createElement("div");
    document.documentElement.appendChild(popupHost);
    onTestFinished(() => {
      popupHost.remove();
      setAppearancePreference("dark");
    });
    const content = (
      <div className="templated-string-input" data-testid="overlay-control">
        Legacy control
      </div>
    );
    const classNames = { root: "custom-overlay" };
    let overlay: React.ReactElement;
    switch (kind) {
      case "popover":
        overlay = (
          <Popover open content={content} classNames={classNames}>
            <button>Open</button>
          </Popover>
        );
        break;
      case "tooltip":
        overlay = (
          <Tooltip open title={content} classNames={classNames}>
            <button>Open</button>
          </Tooltip>
        );
        break;
      case "dropdown":
        overlay = (
          <Dropdown open popupRender={() => content} classNames={classNames}>
            <button>Open</button>
          </Dropdown>
        );
        break;
      case "modal":
        overlay = (
          <Modal
            open
            title="Details"
            getContainer={() => popupHost}
            classNames={classNames}
          >
            {content}
          </Modal>
        );
        break;
      case "drawer":
        overlay = (
          <Drawer
            open
            title="Details"
            getContainer={() => popupHost}
            classNames={classNames}
          >
            {content}
          </Drawer>
        );
        break;
    }
    setAppearancePreference("dark");
    render(
      <AntdConfigProvider productUI>
        <ConfigProvider getPopupContainer={() => popupHost}>
          {overlay}
        </ConfigProvider>
      </AntdConfigProvider>,
    );
    const control = await within(popupHost).findByTestId("overlay-control");
    for (const appearance of ["dark", "light", "dark"] as const) {
      act(() => setAppearancePreference(appearance));
      const token = theme.getDesignToken(productTheme(appearance));
      const probe = document.createElement("div");
      probe.style.backgroundColor = token.colorBgContainer;
      probe.style.color = token.colorText;
      document.body.appendChild(probe);
      expect(getComputedStyle(control).backgroundColor).toBe(
        getComputedStyle(probe).backgroundColor,
      );
      expect(getComputedStyle(control).color).toBe(
        getComputedStyle(probe).color,
      );
      const popup = ensure(
        control.closest(".custom-overlay"),
        "Expected the custom popup class to be preserved",
      );
      expect(
        getComputedStyle(popup).getPropertyValue("--ui-surface").trim(),
      ).toBe(token.colorBgContainer);
      probe.remove();
    }
  },
);

it("updates Ant Design and antd-style together, while auth keeps its original theme", () => {
  setAppearancePreference("dark");
  const { rerender } = render(
    <AntdConfigProvider productUI>
      <ThemeProbe />
    </AntdConfigProvider>,
  );
  const probe = screen.getByTestId("theme");
  expect(probe.dataset.antdBg).toBe("#202128");
  expect(document.documentElement.dataset.uiAppearance).toBe("dark");
  expect(
    document.documentElement.style.getPropertyValue("--studio-loading-surface"),
  ).toBe("#202128");
  expect(probe.dataset.styleBg).toBe(probe.dataset.antdBg);
  act(() => setAppearancePreference("light"));
  expect(probe.dataset.antdBg).toBe("#ffffff");
  expect(document.documentElement.dataset.uiAppearance).toBe("light");
  expect(
    document.documentElement.style.getPropertyValue("--studio-loading-surface"),
  ).toBe("#ffffff");
  expect(probe.dataset.styleBg).toBe(probe.dataset.antdBg);
  act(() => setAppearancePreference("dark"));
  rerender(
    <AntdConfigProvider productUI={false}>
      <ThemeProbe />
    </AntdConfigProvider>,
  );
  expect(probe.dataset.antdBg).toBe("#fff");
  expect(probe.dataset.styleBg).toBe(probe.dataset.antdBg);
  expect(document.documentElement.dataset.uiAppearance).toBe("dark");
  expect(
    document.documentElement.style.getPropertyValue("--studio-loading-layout"),
  ).toBe("#15161b");
});

it("keeps the document dark through lazy route loading and independent legacy roots", () => {
  setAppearancePreference("dark");
  function PendingPage(): React.ReactElement {
    throw new Promise(vi.fn());
  }
  const shell = render(
    <AntdConfigProvider productUI>
      <div className="root">
        <React.Suspense fallback={<div data-testid="route-loading" />}>
          <PendingPage />
        </React.Suspense>
      </div>
    </AntdConfigProvider>,
  );
  const modal = render(
    <AntdConfigProvider productUI={false}>
      <div>Legacy controls</div>
    </AntdConfigProvider>,
  );
  expect(screen.getByTestId("route-loading")).toBeTruthy();
  expect(document.documentElement.dataset.uiAppearance).toBe("dark");
  expect(
    document.documentElement.style.getPropertyValue("--studio-loading-layout"),
  ).toBe("#15161b");
  modal.unmount();
  expect(document.documentElement.dataset.uiAppearance).toBe("dark");
  shell.unmount();
});
it.each([
  "/login",
  "/login/",
  "/register",
  "/auth/plasmic-init/token",
  "/authorize",
  "/logout",
])("excludes auth route %s from product appearance", (path) => {
  expect(usesProductTheme(path)).toBe(false);
});

it("keeps portal theme bindings until the last product root closes", () => {
  setAppearancePreference("dark");
  const baseline = document.body.className;
  const shell = render(
    <AntdConfigProvider productUI>
      <ThemeProbe />
    </AntdConfigProvider>,
  );
  const productClasses = document.body.className;
  expect(productClasses).not.toBe(baseline);
  const modal = render(
    <AntdConfigProvider productUI>
      <div>Independent modal</div>
    </AntdConfigProvider>,
  );
  modal.unmount();
  expect(document.body.className).toBe(productClasses);
  shell.rerender(
    <AntdConfigProvider productUI={false}>
      <ThemeProbe />
    </AntdConfigProvider>,
  );
  expect(document.body.className).toBe(baseline);
});

it("themes legacy editor controls rendered in a portal", () => {
  setAppearancePreference("dark");
  render(
    <AntdConfigProvider productUI>
      {createPortal(
        <div className="panel-dim-block" data-testid="image-picker">
          <div className="templated-string-input" data-testid="page-title">
            Title
          </div>
          <textarea
            className="textbox image-paster"
            data-testid="image-paste"
          />
        </div>,
        document.body,
      )}
    </AntdConfigProvider>,
  );
  expect(
    getComputedStyle(screen.getByTestId("page-title")).backgroundColor,
  ).toBe("rgb(32, 33, 40)");
  expect(getComputedStyle(screen.getByTestId("page-title")).color).toBe(
    "rgb(237, 238, 245)",
  );
  expect(
    getComputedStyle(screen.getByTestId("image-picker")).backgroundColor,
  ).toBe("rgb(21, 22, 27)");
  expect(getComputedStyle(screen.getByTestId("image-paste")).color).toBe(
    "rgb(237, 238, 245)",
  );
  act(() => setAppearancePreference("light"));
  expect(
    getComputedStyle(screen.getByTestId("page-title")).backgroundColor,
  ).toBe("rgb(255, 255, 255)");
  expect(getComputedStyle(screen.getByTestId("page-title")).color).toBe(
    "rgb(37, 42, 56)",
  );
});

it("themes hidden legacy controls when a portal opens, including while appearance changes", () => {
  setAppearancePreference("dark");
  function HiddenControls() {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open controls</button>
        {open &&
          createPortal(
            <div className="modal" data-testid="legacy-modal">
              <button
                className="select-dropdown__button"
                data-testid="query-select"
              >
                Query
              </button>
              <input
                className="textbox"
                data-testid="query-param"
                placeholder="Value"
              />
              <div className="dropdown-pill" data-testid="selected-value">
                Selected value
              </div>
              <ValueViewer
                value={{ result: "Example result", count: 2 }}
                expandFully
              />
              {renderInspector({ result: "Example result", count: 2 })}
            </div>,
            document.body,
          )}
      </>
    );
  }
  render(
    <AntdConfigProvider productUI>
      <HiddenControls />
    </AntdConfigProvider>,
  );
  act(() => screen.getByText("Open controls").click());
  for (const appearance of ["dark", "light", "dark"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    const expected = document.createElement("div");
    expected.style.color = token.colorText;
    expected.style.backgroundColor = token.colorBgContainer;
    document.body.appendChild(expected);
    for (const id of ["legacy-modal", "query-select", "query-param"]) {
      const control = getComputedStyle(screen.getByTestId(id));
      expect(control.color).toBe(getComputedStyle(expected).color);
      expect(control.backgroundColor).toBe(
        getComputedStyle(expected).backgroundColor,
      );
    }
    expected.style.color = token.colorSuccessText;
    for (const value of screen.getAllByText('"Example result"')) {
      expect(getComputedStyle(value).color).toBe(
        getComputedStyle(expected).color,
      );
    }
    expect(
      getComputedStyle(document.body).getPropertyValue("--ui-elevated").trim(),
    ).toBe(token.colorBgElevated);
    expect(
      getComputedStyle(document.body).getPropertyValue("--ui-border").trim(),
    ).toBe(token.colorBorder);
    expected.remove();
  }
});
