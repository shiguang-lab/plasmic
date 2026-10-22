import { fireEvent, render, screen } from "@testing-library/react";
import { App, theme } from "antd";
import React from "react";
import { expect, test } from "vitest";
import { AntdConfigProvider } from "../src/registerConfigProvider";

test("the global provider preserves theme and feedback without a canvas sizing box", async () => {
  function Content() {
    const { token } = theme.useToken();
    const { message } = App.useApp();
    return (
      <button
        style={{ color: token.colorPrimary }}
        onClick={() => message.success("Saved")}
      >
        Save
      </button>
    );
  }
  const { container } = render(
    <AntdConfigProvider themeStyles={{}} colorPrimary="#123456" removeLoading>
      <Content />
    </AntdConfigProvider>,
  );
  const app = container.querySelector(".ant-app");
  expect(app).not.toBeNull();
  expect(getComputedStyle(app!).display).toBe("contents");
  expect(getComputedStyle(screen.getByRole("button")).color).toBe("rgb(18, 52, 86)");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Saved")).toBeTruthy();
});
