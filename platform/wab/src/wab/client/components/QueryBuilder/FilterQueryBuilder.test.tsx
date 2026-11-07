import {
  FilterQueryBuilder,
  canMoveFilter,
  RenderQueryValue,
} from "@/wab/client/components/QueryBuilder/FilterQueryBuilder";
import { setUiLocale } from "@/wab/client/i18n";
import { ObjectPath } from "@/wab/shared/model/classes";
import type { QueryBuilderConfig } from "@plasmicapp/host";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import type { RuleGroupType } from "react-querybuilder";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(async () => {
  await setUiLocale("en");
  window.matchMedia = vi
    .fn()
    .mockImplementation((media) => ({
      matches: false,
      media,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    }));
});
afterEach(cleanup);
const config: QueryBuilderConfig = {
  fields: [
    { name: "age", datatype: "number", inputType: "number", label: "Age" },
    { name: "name", datatype: "text", label: "Name" },
    { name: "enabled", datatype: "boolean", label: "Enabled" },
    {
      name: "status",
      datatype: "select",
      valueEditorType: "select",
      label: "Status",
      values: [
        { name: "open", label: "Open" },
        { name: "closed", label: "Closed" },
      ],
    },
  ],
};
function tree(
  field = "age",
  operator = "=",
  value: unknown = 18,
): RuleGroupType {
  return {
    id: "root",
    combinator: "and",
    rules: [{ id: "rule", field, operator, value }],
  };
}
function mount(
  input: RuleGroupType,
  options: {
    config?: QueryBuilderConfig;
    disabled?: boolean;
    renderValueEditor?: RenderQueryValue;
  } = {},
) {
  const saved = vi.fn();
  function Harness() {
    const [value, setValue] = React.useState(input);
    return (
      <FilterQueryBuilder
        config={options.config ?? config}
        disabled={options.disabled}
        renderValueEditor={options.renderValueEditor}
        value={value}
        onChange={(next) => {
          setValue(next);
          saved(next);
        }}
      />
    );
  }
  return { ...render(<Harness />), saved };
}
it("does not save on mount and preserves native IDs and numeric values", async () => {
  const { saved } = mount(tree());
  expect(saved).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "21" } });
  await waitFor(() =>
    expect(saved.mock.lastCall?.[0].rules[0]).toMatchObject({
      id: "rule",
      field: "age",
      operator: "=",
      value: 21,
    }),
  );
});
it("keeps false as a boolean", async () => {
  const { saved } = mount(tree("enabled", "=", true));
  fireEvent.click(screen.getAllByRole("radio")[1]);
  await waitFor(() =>
    expect(saved.mock.lastCall?.[0].rules[0].value).toBe(false),
  );
});
it("adds and removes rules while preserving existing IDs", async () => {
  const { saved, container } = mount(tree());
  fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
  await waitFor(() => expect(saved.mock.lastCall?.[0].rules).toHaveLength(2));
  const buttons = container.querySelectorAll('button[aria-label="Delete"]');
  fireEvent.click(buttons[buttons.length - 1]);
  await waitFor(() => expect(saved.mock.lastCall?.[0].rules).toHaveLength(1));
  expect(saved.mock.lastCall?.[0].rules[0].id).toBe("rule");
});
it("disables controls and prevents saves in readonly mode", async () => {
  const { saved, container } = mount(tree(), { disabled: true });
  expect(screen.getByRole("spinbutton")).toHaveProperty("disabled", true);
  for (const button of container.querySelectorAll<HTMLButtonElement>(
    "button.qb-button",
  )) {
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
  }
  await act(async () => {});
  expect(saved).not.toHaveBeenCalled();
});
it("honors AND-only, no-NOT, no-nested-group configuration", () => {
  const { saved, container } = mount(tree(), {
    config: {
      ...config,
      combinators: [{ name: "and", label: "all" }],
      showNotToggle: false,
      showAddGroupAction: false,
    },
  });
  expect(screen.queryByRole("button", { name: "Add group" })).toBeNull();
  expect(container.querySelector(".notToggle")).toBeNull();
  expect(saved).not.toHaveBeenCalled();
});
async function choose(container: HTMLElement, selector: string, label: string) {
  const select = container.querySelector(selector);
  expect(select).not.toBeNull();
  fireEvent.mouseDown(select?.querySelector("input") ?? (select as Element));
  const options = await screen.findAllByText(label, {
    selector: ".ant-select-item-option-content",
  });
  fireEvent.click(options[options.length - 1]);
}
it("changes native NOT and OR group state", async () => {
  const { saved, container } = mount(tree());
  fireEvent.click(screen.getByRole("switch", { name: /Skip/ }));
  await waitFor(() => expect(saved.mock.lastCall?.[0].not).toBe(true));
  await choose(container, ".ruleGroup-combinators", "any");
  await waitFor(() =>
    expect(saved.mock.lastCall?.[0]).toMatchObject({
      not: true,
      combinator: "or",
    }),
  );
});
it("switches fields and saves text without a metadata envelope", async () => {
  const { saved, container } = mount(tree());
  await choose(container, ".rule-fields", "Name");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "中文" } });
  await waitFor(() =>
    expect(saved.mock.lastCall?.[0].rules[0]).toMatchObject({
      field: "name",
      operator: "=",
      value: "中文",
    }),
  );
});
it("edits native range bounds, preserving zero", async () => {
  const { saved } = mount(tree("age", "between", [0, 65]));
  const inputs = screen.getAllByRole("spinbutton");
  expect(inputs).toHaveLength(2);
  fireEvent.change(inputs[1], { target: { value: "70" } });
  await waitFor(() =>
    expect(saved.mock.lastCall?.[0].rules[0].value).toEqual([0, 70]),
  );
});
it("disables persisted native locked rules", () => {
  const input = tree();
  Object.assign(input.rules[0], { disabled: true });
  const { saved } = mount(input);
  expect(screen.getByRole("spinbutton")).toHaveProperty("disabled", true);
  expect(saved).not.toHaveBeenCalled();
});
it("preserves dynamic expression objects without freezing models", async () => {
  const expression = new ObjectPath({
    path: ["$ctx", "customer"],
    fallback: undefined,
  });
  const { saved } = mount(tree("name", "=", "before"), {
    renderValueEditor: (props) => (
      <button onClick={() => props.handleOnChange(expression)}>
        Bind value
      </button>
    ),
  });
  fireEvent.click(screen.getByRole("button", { name: "Bind value" }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(saved.mock.lastCall?.[0].rules[0].value).toBe(expression);
  expect(Object.isFrozen(expression)).toBe(false);
  expect(Object.isFrozen(expression.path)).toBe(false);
});
it("blocks custom widgets from saving through a disabled filter", async () => {
  const { saved } = mount(tree(), {
    disabled: true,
    renderValueEditor: (props) => (
      <button onClick={() => props.handleOnChange("attempted")}>
        Custom write
      </button>
    ),
  });
  fireEvent.click(screen.getByRole("button", { name: "Custom write" }));
  await act(async () => {});
  expect(saved).not.toHaveBeenCalled();
});
it("edits configured list membership as arrays", async () => {
  const { saved, container } = mount(tree("status", "in", ["open"]));
  await choose(container, ".rule-value .ant-select", "Closed");
  await waitFor(() =>
    expect(saved.mock.lastCall?.[0].rules[0].value).toEqual(["open", "closed"]),
  );
});

it("removes nested groups after their last rule is deleted", async () => {
  const { saved, container } = mount(tree());
  fireEvent.click(screen.getByRole("button", { name: "Add group" }));
  await waitFor(() => expect(saved.mock.lastCall?.[0].rules).toHaveLength(2));
  const nested = container.querySelector(
    '.ruleGroup .ruleGroup .rule button[aria-label="Delete"]',
  );
  expect(nested).not.toBeNull();
  fireEvent.click(nested as Element);
  await waitFor(() => expect(saved.mock.lastCall?.[0].rules).toHaveLength(1));
  expect(saved.mock.lastCall?.[0].rules[0].id).toBe("rule");
});

it("keeps drag and drop within the same builder and parent group", () => {
  const dragging = {qbId: "builder", path: [0, 1]};
  expect(canMoveFilter({dragging, hovering: {qbId: "builder", path: [0, 2]}, groupItems: false} as any)).toBe(true);
  expect(canMoveFilter({dragging, hovering: {qbId: "other", path: [0, 2]}, groupItems: false} as any)).toBe(false);
  expect(canMoveFilter({dragging, hovering: {qbId: "builder", path: [1, 2]}, groupItems: false} as any)).toBe(false);
  expect(canMoveFilter({dragging, hovering: {qbId: "builder", path: [0, 2]}, groupItems: true} as any)).toBe(false);
});
