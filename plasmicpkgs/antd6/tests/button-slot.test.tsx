import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { AntdButton, registerButton } from "../src/registerButton";
import type { Registerable } from "../src/utils";

test("Button retains a Slot with a primitive default and accepts text or custom content", () => {
  let meta: any;
  registerButton({ registerComponent: (_impl: any, value: any) => { meta = value; } } as Registerable);
  expect(meta.props.children).toMatchObject({ type: "slot", defaultValue: "Button", mergeWithParent: true });
  expect(meta.canvasText.prop).toBe("children");
  const onClick = vi.fn();
  const view = render(<AntdButton icon={<span data-testid="icon">+</span>} onClick={onClick}>新建模板</AntdButton>);
  const button = screen.getByRole("button", { name: "+ 新建模板" });
  expect(button.querySelector(meta.canvasText.selector)?.textContent).toBe("新建模板");
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
  view.rerender(<AntdButton><strong data-testid="custom">自定义内容</strong></AntdButton>);
  expect(screen.getByTestId("custom").tagName).toBe("STRONG");
  expect(screen.getByRole("button").contains(screen.getByTestId("custom"))).toBe(true);
});
