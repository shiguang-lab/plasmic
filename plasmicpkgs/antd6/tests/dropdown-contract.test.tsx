import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { AntdDropdown, registerDropdown } from "../src/registerDropdown";
import type { Registerable } from "../src/utils";

test("Dropdown's registered JSON defaults declare the keys emitted by real menu clicks", () => {
  let meta: any;
  registerDropdown({ registerComponent: (_component, value) => { meta = value; } } as Registerable);
  const contract = meta.props.menuItemsJson;
  expect(contract.itemType.fields.key).toBeTruthy();
  expect(contract.itemType.fields.children.itemType.fields.key).toBeTruthy();
  const items = contract.defaultValue;
  expect(items.map((item: any) => item.key)).toEqual(["action1", "action2"]);
  const onAction = vi.fn();
  render(<AntdDropdown open menuItemsJson={items} onAction={onAction}><button>Create</button></AntdDropdown>);
  for (const item of items) {
    fireEvent.click(screen.getByText(item.label));
    expect(onAction).toHaveBeenLastCalledWith(item.key);
  }
});

test("Dropdown preserves source keys recursively and disabled choices cannot execute", () => {
  const onAction = vi.fn();
  render(<AntdDropdown open onAction={onAction} menuItemsJson={[
    { key: "onetime", label: "一次性" },
    { type: "group", key: "flows", label: "Flows", children: [
      { key: "regular", label: "常规" },
      { key: "blocked", label: "Forbidden", disabled: true },
      { key: 0, label: "Zero" },
    ] },
  ]}><button>Create</button></AntdDropdown>);
  for (const [label, key] of [["一次性", "onetime"], ["常规", "regular"], ["Zero", "0"]]) {
    fireEvent.click(screen.getByText(label));
    expect(onAction).toHaveBeenLastCalledWith(key);
  }
  expect(onAction).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByText("Forbidden"));
  expect(onAction).toHaveBeenCalledTimes(3);
});
