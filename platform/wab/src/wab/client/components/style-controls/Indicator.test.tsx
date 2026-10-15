import Indicator from "@/wab/client/components/style-controls/Indicator";
import styles from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicIndicator.module.css";
import { ensure } from "@/wab/shared/common";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConfigProvider } from "antd";
import React from "react";

afterEach(cleanup);

it("opens the style details when hovering the rendered indicator", async () => {
  const { container } = render(
    <ConfigProvider
      getPopupContainer={(trigger) =>
        ensure(trigger, "Popover requires a DOM trigger").ownerDocument.body
      }
    >
      <Indicator
        color="blue"
        placement="right"
        popoverTitle="Style settings"
        popover={<div>Style details</div>}
      />
    </ConfigProvider>,
  );
  const dot = ensure(
    container.querySelector<HTMLElement>(`.${styles.dot}`),
    "Indicator dot should render",
  );
  fireEvent.mouseEnter(dot);
  expect(await screen.findByText("Style details")).toBeTruthy();
  expect(await screen.findByText("Style settings")).toBeTruthy();
});

it("anchors the tooltip to the rendered indicator", async () => {
  const { container } = render(
    <ConfigProvider
      getPopupContainer={(trigger) =>
        ensure(trigger, "Tooltip requires a DOM trigger").ownerDocument.body
      }
    >
      <Indicator color="blue" tooltip="Style settings" />
    </ConfigProvider>,
  );
  fireEvent.mouseEnter(
    ensure(
      container.querySelector<HTMLElement>(`.${styles.dot}`),
      "Indicator dot should render",
    ),
  );
  expect(await screen.findByText("Style settings")).toBeTruthy();
});
