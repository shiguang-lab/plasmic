import { ArrayPrimitiveEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/ArrayPrimitiveEditor";
import { ArrayPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/ArrayPropEditor";
import type { ObjectPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/ObjectPropEditor";
import type { PropValueEditor } from "@/wab/client/components/sidebar-tabs/PropValueEditor";
import type { ListBox, ListBoxItem } from "@/wab/client/components/widgets";
import type { ChoiceOptions } from "@plasmicapp/host";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/components/widgets", () => ({
  ListBox: (props: React.ComponentProps<typeof ListBox>) => <div>{props.children}<button onClick={() => props.onReorder?.(0, 1)}>Reorder</button><button onClick={props.onAdd}>Add item</button></div>,
  ListBoxItem: (props: React.ComponentProps<typeof ListBoxItem>) => <div>{props.mainContent}<button onClick={props.onRemove}>Remove {props.index}</button></div>,
}));
vi.mock("@/wab/client/components/sidebar-tabs/PropValueEditor", () => ({
  PropValueEditor: (props: React.ComponentProps<typeof PropValueEditor>) => <input aria-label={props.label} value={String(props.value)} onChange={(event) => props.onChange(event.target.value)} />,
}));
vi.mock("@/wab/client/components/sidebar-tabs/ComponentProps/ObjectPropEditor", () => ({
  ObjectPropEditor: (props: React.ComponentProps<typeof ObjectPropEditor<{ name: string }>>) => <button onClick={() => props.onChange({ name: "Edited" })}>{props.evaluatedValue?.name}</button>,
}));

afterEach(cleanup);

it("edits, reorders and removes typed choice values without mutating the React draft", () => {
  const original: ChoiceOptions = [{ label: "One", value: 1 }, { label: "Two", value: 2 }];
  original.forEach(Object.freeze);
  Object.freeze(original);
  const changed = vi.fn();
  function Choices() {
    const [options, setOptions] = React.useState(original);
    return <ArrayPrimitiveEditor data-test-id="choices" options={options} onChange={(next) => { changed(next); setOptions(next); }} />;
  }
  render(<Choices />);
  fireEvent.change(screen.getAllByRole("textbox", { name: "value" })[0], { target: { value: "3" } });
  expect(changed).toHaveBeenLastCalledWith([{ label: "One", value: 3 }, { label: "Two", value: 2 }]);
  fireEvent.click(screen.getByText("Reorder"));
  expect(changed).toHaveBeenLastCalledWith([{ label: "Two", value: 2 }, { label: "One", value: 3 }]);
  fireEvent.click(screen.getByText("Remove 0"));
  expect(changed).toHaveBeenLastCalledWith([{ label: "One", value: 3 }]);
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  expect(changed).toHaveBeenLastCalledWith([{ label: "One", value: 3 }, { label: "4", value: 4 }]);
  expect(original).toEqual([{ label: "One", value: 1 }, { label: "Two", value: 2 }]);
});

it("passes runtime context identities to item metadata and replaces array edits immutably", () => {
  const original = [{ name: "First" }, { name: "Second" }];
  original.forEach(Object.freeze);
  Object.freeze(original);
  const context = { command: vi.fn() };
  const componentProps = Object.freeze({ enabled: true });
  const canDelete = vi.fn(() => true);
  const changed = vi.fn();
  function Items() {
    const [items, setItems] = React.useState(original);
    return <ArrayPropEditor data-plasmic-prop="items" modalKey="items" subfields={{ name: { type: "string", defaultValue: "New" } }} propType={{ type: "array", itemType: { type: "object", fields: { name: "string" } } }} compositeValue={items} evaluatedValue={items} ccContextData={context} componentPropValues={componentProps} controlExtras={{ path: ["items"] }} canDeleteFunc={canDelete} onChange={(next) => { changed(next); setItems(next); }} />;
  }
  render(<Items />);
  expect(canDelete).toHaveBeenCalledWith(original[0], componentProps, context, { path: ["items", 0], item: original[0] });
  fireEvent.click(screen.getByText("First"));
  expect(changed).toHaveBeenLastCalledWith([{ name: "Edited" }, { name: "Second" }]);
  fireEvent.click(screen.getByText("Reorder"));
  expect(changed).toHaveBeenLastCalledWith([{ name: "Second" }, { name: "Edited" }]);
  fireEvent.click(screen.getByText("Remove 0"));
  expect(changed).toHaveBeenLastCalledWith([{ name: "Edited" }]);
  fireEvent.click(screen.getByText("Add item"));
  expect(changed).toHaveBeenLastCalledWith([{ name: "Edited" }, { name: "New" }]);
  expect(original).toEqual([{ name: "First" }, { name: "Second" }]);
});
