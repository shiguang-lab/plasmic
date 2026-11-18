import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import * as C from "./components";

function Observer({ children }: { children: () => React.ReactNode }) {
  return children();
}
afterEach(cleanup);

it.each(["Input", "InputBase", "OutlinedInput", "TextField"] as const)(
  "%s keeps input values, validation attributes and native events",
  (name) => {
    const Component = C[name];
    const change = vi.fn();
    const attributes = { "aria-label": "Name", maxLength: 12 };
    const config =
      name === "TextField"
        ? { slotProps: { htmlInput: attributes } }
        : { inputProps: attributes };
    const view = render(
      <Component
        defaultValue="Ada"
        name="name"
        required
        {...config}
        onChange={change}
      />,
    );
    const input = screen.getByRole("textbox", {
      name: "Name",
    }) as HTMLInputElement;
    expect(input.value).toBe("Ada");
    expect(input.required).toBe(true);
    expect(input.maxLength).toBe(12);
    fireEvent.change(input, { target: { value: "Grace" } });
    expect(
      C[`${name}Helpers`].states.value.onChangeArgsToValue(
        change.mock.calls[0][0],
      ),
    ).toBe("Grace");
    view.unmount();
    const readonlyConfig =
      name === "TextField"
        ? { slotProps: { htmlInput: attributes, input: { readOnly: true } } }
        : { inputProps: attributes, readOnly: true };
    const controlled = render(
      <Component value="Controlled" {...readonlyConfig} onChange={change} />,
    );
    const controlledInput = screen.getByRole("textbox", {
      name: "Name",
    }) as HTMLInputElement;
    expect(controlledInput.value).toBe("Controlled");
    expect(controlledInput.readOnly).toBe(true);
    controlled.rerender(
      <Component value="Updated" {...readonlyConfig} onChange={change} />,
    );
    expect(controlledInput.value).toBe("Updated");
  },
);
it.each(["Checkbox", "Radio", "Switch"] as const)(
  "%s supports checked, disabled and second event arguments",
  (name) => {
    const Component = C[name];
    const change = vi.fn();
    const view = render(
      <Component defaultChecked={false} name="accepted" onChange={change} />,
    );
    const input = view.container.querySelector("input") as HTMLInputElement;
    expect(input.checked).toBe(false);
    fireEvent.click(input);
    expect(input.checked).toBe(true);
    expect(change.mock.calls[0][1]).toBe(true);
    expect(
      C[`${name}Helpers`].states.checked.onChangeArgsToValue(
        change.mock.calls[0][0],
      ),
    ).toBe(true);
    view.unmount();
    render(<Component checked={false} disabled onChange={change} />);
    expect(
      (
        screen.getByRole(
          name === "Switch"
            ? "switch"
            : name === "Radio"
              ? "radio"
              : "checkbox",
        ) as HTMLInputElement
      ).disabled,
    ).toBe(true);
  },
);
it("RadioGroup preserves the string value and selected option", () => {
  const change = vi.fn();
  render(
    <C.RadioGroup defaultValue="a" onChange={change}>
      <C.FormControlLabel value="a" label="A" control={<C.Radio />} />
      <C.FormControlLabel value="b" label="B" control={<C.Radio />} />
    </C.RadioGroup>,
  );
  fireEvent.click(screen.getByRole("radio", { name: "B" }));
  expect(
    C.RadioGroupHelpers.states.value.onChangeArgsToValue(
      ...(change.mock.calls[0] as [unknown, unknown]),
    ),
  ).toBe("b");
  expect(
    (screen.getByRole("radio", { name: "B" }) as HTMLInputElement).checked,
  ).toBe(true);
});
it("Select supports multiple values and native option mode", () => {
  const change = vi.fn();
  const view = render(
    <C.Select multiple defaultValue={["a"]} onChange={change}>
      <Observer>
        {() => [
          <C.MenuItem key="a" value="a">
            A
          </C.MenuItem>,
          <C.MenuItem key="b" value="b">
            B
          </C.MenuItem>,
        ]}
      </Observer>
    </C.Select>,
  );
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: "B" }));
  expect(
    C.SelectHelpers.states.value.onChangeArgsToValue(change.mock.calls[0][0]),
  ).toEqual(["a", "b"]);
  view.unmount();
  render(
    <C.Select native defaultValue="a" onChange={change}>
      <C.NativeOption value="a">A</C.NativeOption>
      <C.NativeOption value="b">B</C.NativeOption>
    </C.Select>,
  );
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "b" } });
  expect(
    C.SelectHelpers.states.value.onChangeArgsToValue(
      change.mock.calls.at(-1)![0],
    ),
  ).toBe("b");
});
it("NativeSelect retains option values and native change events", () => {
  const change = vi.fn();
  render(
    <C.NativeSelect defaultValue="a" onChange={change}>
      <Observer>
        {() => [
          <C.NativeOption key="a" value="a">
            A
          </C.NativeOption>,
          <C.NativeOption key="b" value="b">
            B
          </C.NativeOption>,
        ]}
      </Observer>
    </C.NativeSelect>,
  );
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "b" } });
  expect(
    C.NativeSelectHelpers.states.value.onChangeArgsToValue(
      change.mock.calls[0][0],
    ),
  ).toBe("b");
});
it("Autocomplete supports multiple selections, clearing and reason/details arguments", async () => {
  const change = vi.fn();
  render(
    <C.Autocomplete
      multiple
      options={["Alpha", "Beta"]}
      onChange={change}
      textFieldProps={{ label: "Options" }}
    />,
  );
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "Al" } });
  fireEvent.click(await screen.findByRole("option", { name: "Alpha" }));
  expect(change.mock.calls[0].slice(1)).toEqual([
    ["Alpha"],
    "selectOption",
    { option: "Alpha" },
  ]);
  fireEvent.focus(input);
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(change.mock.calls.at(-1)!.slice(1, 3)).toEqual([[], "clear"]);
});
it("Slider emits scalar and range values with the active thumb", () => {
  const change = vi.fn();
  const view = render(<C.Slider defaultValue={20} onChange={change} />);
  fireEvent.change(screen.getByRole("slider"), { target: { value: 40 } });
  expect(change.mock.calls[0].slice(1)).toEqual([40, 0]);
  view.unmount();
  change.mockClear();
  render(<C.Slider defaultValue={[20, 60]} onChange={change} />);
  fireEvent.change(screen.getAllByRole("slider")[1], { target: { value: 80 } });
  expect(change.mock.calls[0].slice(1)).toEqual([[20, 80], 1]);
});
it("Rating accepts half steps and emits a numeric rating", () => {
  const change = vi.fn();
  render(
    <C.Rating
      name="rating"
      precision={0.5}
      defaultValue={2}
      onChange={change}
    />,
  );
  fireEvent.click(screen.getByRole("radio", { name: "3.5 Stars" }));
  expect(change.mock.calls[0][1]).toBe(3.5);
});
it("Pagination changes pages while TablePagination keeps zero-based page and row counts", () => {
  const change = vi.fn();
  const view = render(
    <C.Pagination count={5} defaultPage={1} onChange={change} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
  expect(change.mock.calls[0][1]).toBe(2);
  expect(
    screen.getByRole("button", { name: "page 2" }).getAttribute("aria-current"),
  ).toBe("page");
  view.unmount();
  const rows = vi.fn();
  render(
    <C.TablePagination
      component="div"
      count={100}
      page={0}
      rowsPerPage={10}
      onPageChange={change}
      onRowsPerPageChange={rows}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));
  expect(change.mock.calls.at(-1)![1]).toBe(1);
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: "25" }));
  expect(
    C.TablePaginationHelpers.states.rowsPerPage.onChangeArgsToValue(
      rows.mock.calls[0][0],
    ),
  ).toBe(25);
});
it("Tabs selection and keyboard navigation survive observer and icon wrappers", () => {
  const change = vi.fn();
  render(
    <C.Tabs defaultValue="a" onChange={change}>
      <Observer>
        {() => [
          <C.Tab key="a" value="a" label="First" />,
          <C.Tab key="b" value="b" label="Second" icon={<span>Icon</span>} />,
        ]}
      </Observer>
    </C.Tabs>,
  );
  const tabs = screen.getAllByRole("tab");
  tabs[0].focus();
  fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
  expect(document.activeElement).toBe(tabs[1]);
  fireEvent.click(tabs[1]);
  expect(change.mock.calls[0][1]).toBe("b");
  expect(tabs[1].getAttribute("aria-selected")).toBe("true");
});
it("BottomNavigation preserves an explicitly empty selection", () => {
  render(
    <C.BottomNavigation value={null}>
      <C.BottomNavigationAction label="One" />
      <C.BottomNavigationAction label="Two" />
    </C.BottomNavigation>,
  );
  expect(
    document.querySelectorAll(".MuiBottomNavigationAction-root.Mui-selected"),
  ).toHaveLength(0);
});
it.each([true, false])(
  "ToggleButtonGroup emits the native exclusive=%s value",
  (exclusive) => {
    const changed = vi.fn();
    function Group() {
      const [value, setValue] = React.useState<unknown>(
        exclusive ? "a" : ["a"],
      );
      return (
        <C.ToggleButtonGroup
          exclusive={exclusive}
          value={value}
          onChange={(event, next) => {
            changed(event, next);
            setValue(next);
          }}
        >
          <Observer>
            {() => [
              <C.ToggleButton key="a" value="a">
                A
              </C.ToggleButton>,
              <C.ToggleButton key="b" value="b">
                B
              </C.ToggleButton>,
            ]}
          </Observer>
        </C.ToggleButtonGroup>
      );
    }
    render(<Group />);
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    expect(changed.mock.calls[0][1]).toEqual(exclusive ? "b" : ["a", "b"]);
    expect(
      screen.getByRole("button", { name: "B" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    expect(changed.mock.calls[1][1]).toEqual(exclusive ? null : ["a"]);
  },
);
it("Accordion expands and collapses through its real summary", () => {
  const changed = vi.fn();
  render(
    <C.Accordion onChange={changed}>
      <Observer>
        {() => [
          <C.AccordionSummary key="s">Summary</C.AccordionSummary>,
          <C.AccordionDetails key="d">Details</C.AccordionDetails>,
        ]}
      </Observer>
    </C.Accordion>,
  );
  const summary = screen.getByRole("button", { name: "Summary" });
  expect(summary.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(summary);
  expect(changed.mock.calls[0][1]).toBe(true);
  expect(summary.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(summary);
  expect(changed.mock.calls[1][1]).toBe(false);
});
it("Stepper recognizes wrapped StepButtons and retains roving keyboard focus", () => {
  render(
    <C.Stepper nonLinear>
      <Observer>
        {() =>
          [0, 1].map((i) => (
            <C.Step key={i}>
              <Observer>
                {() => (
                  <C.StepButton>
                    <Observer>
                      {() => [
                        <C.StepLabel key="label">Step {i + 1}</C.StepLabel>,
                      ]}
                    </Observer>
                  </C.StepButton>
                )}
              </Observer>
            </C.Step>
          ))
        }
      </Observer>
    </C.Stepper>,
  );
  expect(screen.getByRole("tablist")).toBeDefined();
  const tabs = screen.getAllByRole("tab");
  expect(document.querySelectorAll(".MuiStepLabel-root")).toHaveLength(2);
  tabs[0].focus();
  fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
  expect(document.activeElement).toBe(tabs[1]);
});
it("Stack inserts separators and ImageListItem applies native image classes through observers", () => {
  const view = render(
    <C.Stack divider={<span data-testid="separator">|</span>}>
      <Observer>
        {() => [<span key="a">A</span>, <span key="b">B</span>]}
      </Observer>
    </C.Stack>,
  );
  expect(screen.getByTestId("separator")).toBeDefined();
  view.rerender(
    <C.ImageList>
      <C.ImageListItem>
        <Observer>
          {() => [<img key="image" src="image.png" alt="Image" />]}
        </Observer>
      </C.ImageListItem>
    </C.ImageList>,
  );
  expect(screen.getByRole("img").className).toContain("MuiImageListItem-img");
});
it.each(["Select", "NativeSelect"] as const)(
  "%s keeps filled FormControl labels correct on the first server render",
  (name) => {
    const Component = C[name];
    const html = renderToStaticMarkup(
      <C.FormControl>
        <Observer>
          {() => [
            <C.InputLabel key="label">Value</C.InputLabel>,
            <Component key="input" defaultValue="a">
              {name === "Select" ? (
                <C.MenuItem value="a">A</C.MenuItem>
              ) : (
                <C.NativeOption value="a">A</C.NativeOption>
              )}
            </Component>,
          ]}
        </Observer>
      </C.FormControl>,
    );
    expect(html).toContain('data-shrink="true"');
  },
);
it.each(["Dialog", "Drawer", "Menu"] as const)(
  "%s closes with the native reason and emits the wrapper open state",
  async (name) => {
    const Component = C[name];
    const close = vi.fn(),
      open = vi.fn();
    render(
      <Component
        defaultOpen
        onClose={close}
        onOpenChange={open}
        {...(name === "Menu"
          ? {
              anchorReference: "anchorPosition",
              anchorPosition: { top: 10, left: 10 },
            }
          : {})}
      >
        {name === "Menu" ? <C.MenuItem>Item</C.MenuItem> : <span>Content</span>}
      </Component>,
    );
    const surface = document.querySelector(".MuiModal-root")!;
    fireEvent.keyDown(surface, { key: "Escape", keyCode: 27 });
    expect(close.mock.calls[0][1]).toBe("escapeKeyDown");
    expect(open).toHaveBeenCalledWith(false);
    await waitFor(() =>
      expect(document.querySelector(".MuiModal-root")).toBeNull(),
    );
  },
);
it("Tooltip opens and closes via its actual trigger", async () => {
  const changed = vi.fn();
  render(
    <C.Tooltip
      title="Help"
      enterDelay={0}
      leaveDelay={0}
      onOpenChange={changed}
    >
      <button>Trigger</button>
    </C.Tooltip>,
  );
  fireEvent.mouseOver(screen.getByRole("button"));
  expect(await screen.findByRole("tooltip")).toBeDefined();
  expect(changed).toHaveBeenCalledWith(true);
  fireEvent.mouseLeave(screen.getByRole("button"));
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  expect(changed).toHaveBeenCalledWith(false);
});
it("Autocomplete merges configured input slots without losing option selection or callbacks", async () => {
  const inputChange = vi.fn(),
    changed = vi.fn();
  render(
    <C.Autocomplete
      options={["Alpha", "Beta"]}
      onChange={changed}
      textFieldProps={{
        label: "Options",
        helperText: "Choose an option",
        slotProps: {
          htmlInput: () => ({
            maxLength: 7,
            onChange: inputChange,
            className: "business-input",
          }),
          input: { className: "business-control" },
          formHelperText: {
            "data-testid": "help",
          } as React.HTMLAttributes<HTMLElement>,
        },
      }}
    />,
  );
  const input = screen.getByRole("combobox") as HTMLInputElement;
  expect(input.maxLength).toBe(7);
  expect(input.className).toContain("business-input");
  expect(input.className).toContain("MuiAutocomplete-input");
  expect(input.closest(".business-control")).not.toBeNull();
  expect(screen.getByTestId("help").textContent).toBe("Choose an option");
  fireEvent.change(input, { target: { value: "Al" } });
  expect(inputChange).toHaveBeenCalledOnce();
  fireEvent.click(await screen.findByRole("option", { name: "Alpha" }));
  expect(changed.mock.calls[0][1]).toBe("Alpha");
});
