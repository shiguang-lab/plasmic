import { useTheme } from "@mui/material/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import api from "./api.json";
import * as C from "./components";
import { registerAll } from "./index";
import { componentMeta, componentNames } from "./metadata";
const mode = vi.hoisted(() => ({
  canvas: undefined as undefined | { interactive: boolean },
}));
vi.mock("@plasmicapp/host", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  usePlasmicCanvasContext: () => mode.canvas,
}));
afterEach(() => {
  cleanup();
  mode.canvas = undefined;
});

it("registers the complete catalog, valid exports, native API props and state helpers", () => {
  const registerComponent = vi.fn();
  const registerGlobalContext = vi.fn();
  registerAll({ registerComponent, registerGlobalContext });
  expect(registerComponent).toHaveBeenCalledTimes(104);
  expect(registerGlobalContext).toHaveBeenCalledTimes(1);
  const names = new Set(
    registerComponent.mock.calls.map(([, meta]) => meta.name),
  );
  for (const name of componentNames) {
    const meta = componentMeta(name);
    expect(C[name], name).toBeDefined();
    const mappedInitials = Object.values(meta.props).flatMap((prop) =>
      typeof prop === "object" && prop && "uncontrolledProp" in prop
        ? [prop.uncontrolledProp]
        : [],
    );
    for (const prop of Object.keys(api[name].props))
      expect(
        prop in meta.props || mappedInitials.includes(prop),
        `${name}.${prop}`,
      ).toBe(true);
    for (const prop of Object.values(meta.props)) {
      if (typeof prop === "object" && prop?.type === "slot") {
        for (const allowed of prop.allowedComponents ?? [])
          expect(names.has(allowed), allowed).toBe(true);
      }
    }
    if (meta.states) {
      expect(meta.componentHelpers?.helpers, name).toBeDefined();
      for (const [key, state] of Object.entries(meta.states)) {
        expect(
          meta.componentHelpers?.helpers.states[key]?.onChangeArgsToValue,
          `${name}.${key}`,
        ).toBeTypeOf("function");
        if (state.type === "writable")
          expect(meta.props[state.onChangeProp]).toBeDefined();
      }
    }
  }
});

it("preserves numeric/boolean choices, responsive styles and native event arguments", () => {
  expect(componentMeta("Tabs").props.scrollButtons).toMatchObject({
    type: "choice",
    options: ["auto", false, true],
  });
  expect(componentMeta("Slider").props.onChange).toMatchObject({
    type: "eventHandler",
    argTypes: [
      { name: "event", type: "object" },
      { name: "value", type: "object" },
      { name: "activeThumb", type: "number" },
    ],
  });
  expect(componentMeta("Button").props.onClick).toMatchObject({
    type: "eventHandler",
  });
  expect(componentMeta("Grid").props.size).toBeDefined();
  expect(componentMeta("Box").props.children).toMatchObject({ type: "slot" });
  expect(componentMeta("Button").props.sx).toMatchObject({ type: "object" });
  expect(componentMeta("Slider").props.value).toMatchObject({
    editOnly: true,
    uncontrolledProp: "defaultValue",
    defaultValue: 30,
  });
  expect(componentMeta("Slider").props.defaultValue).toBeUndefined();
});

it("native inputs retain uncontrolled editing, value extraction and disabled behavior", () => {
  const onText = vi.fn();
  const onSwitch = vi.fn();
  const onButton = vi.fn();
  render(
    <>
      <C.TextField label="Name" defaultValue="Ada" onChange={onText} />
      <C.Switch
        onChange={onSwitch}
        slotProps={{ input: { "aria-label": "Enabled" } }}
      />
      <C.Button disabled onClick={onButton}>
        Save
      </C.Button>
    </>,
  );
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Grace" },
  });
  expect(
    C.TextFieldHelpers.states.value.onChangeArgsToValue(
      onText.mock.calls[0][0],
    ),
  ).toBe("Grace");
  fireEvent.click(screen.getByRole("switch", { name: "Enabled" }));
  expect(
    C.SwitchHelpers.states.checked.onChangeArgsToValue(
      onSwitch.mock.calls[0][0],
    ),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onButton).not.toHaveBeenCalled();
  expect(
    C.SliderHelpers.states.value.onChangeArgsToValue({}, [20, 80]),
  ).toEqual([20, 80]);
});

function Observer({ children }: { children: () => React.ReactNode }) {
  return children();
}
it("navigation unwraps reactive slots and fragments and emits MUI's second value argument", () => {
  const change = vi.fn();
  render(
    <C.BottomNavigation defaultValue="home" onChange={change} showLabels>
      <Observer>
        {() => (
          <>
            <C.BottomNavigationAction value="home" label="Home" />
            <C.BottomNavigationAction value="profile" label="Profile" />
          </>
        )}
      </Observer>
    </C.BottomNavigation>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Profile" }));
  expect(change.mock.calls[0][1]).toBe("profile");
  expect(screen.getByRole("button", { name: "Profile" }).className).toContain(
    "Mui-selected",
  );
});
it("Select supports editable option children and native change events", async () => {
  const change = vi.fn();
  render(
    <C.Select defaultValue="first" onChange={change}>
      <Observer>
        {() => (
          <>
            <C.MenuItem value="first">First</C.MenuItem>
            <C.MenuItem value="second">Second</C.MenuItem>
          </>
        )}
      </Observer>
    </C.Select>,
  );
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(await screen.findByRole("option", { name: "Second" }));
  expect(
    C.SelectHelpers.states.value.onChangeArgsToValue(change.mock.calls[0][0]),
  ).toBe("second");
  expect(screen.getByRole("combobox").textContent).toBe("Second");
});
it("Autocomplete has a functional default input and option selection", async () => {
  const change = vi.fn();
  render(
    <C.Autocomplete
      options={["Beijing", "Shanghai"]}
      textFieldProps={{ label: "City" }}
      onChange={change}
    />,
  );
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "Shang" },
  });
  fireEvent.click(await screen.findByRole("option", { name: "Shanghai" }));
  expect(change.mock.calls[0][1]).toBe("Shanghai");
});
it("overlay defaults close in preview and preserve native close reasons", () => {
  const changed = vi.fn();
  const closed = vi.fn();
  render(
    <C.Dialog defaultOpen onOpenChange={changed} onClose={closed}>
      <C.DialogTitle>Confirm</C.DialogTitle>
    </C.Dialog>,
  );
  fireEvent.keyDown(screen.getByRole("dialog"), {
    key: "Escape",
    code: "Escape",
    keyCode: 27,
  });
  expect(changed).toHaveBeenCalledWith(false);
  expect(closed.mock.calls[0][1]).toBe("escapeKeyDown");
});
it("canvas selection reveals are isolated from saved open state and business callbacks", () => {
  mode.canvas = { interactive: false };
  const changed = vi.fn();
  const closed = vi.fn();
  const set = vi.fn();
  const canvas = {
    selected: true,
    getState: vi.fn(() => ({
      value: true,
      revealed: true,
      reveal: vi.fn(),
      set,
    })),
  };
  const props = {
    open: false,
    onOpenChange: changed,
    onClose: closed,
    __canvas: canvas,
  };
  const view = render(
    <C.Dialog {...props}>
      <C.DialogTitle>Editing</C.DialogTitle>
    </C.Dialog>,
  );
  expect(screen.getByRole("dialog")).toBeDefined();
  fireEvent.keyDown(screen.getByRole("dialog"), {
    key: "Escape",
    code: "Escape",
    keyCode: 27,
  });
  expect(set).toHaveBeenCalledWith(false);
  expect(changed).not.toHaveBeenCalled();
  expect(closed).not.toHaveBeenCalled();
  expect(props.open).toBe(false);
  view.unmount();
  mode.canvas = undefined;
  render(
    <C.Dialog {...props}>
      <C.DialogTitle>Preview</C.DialogTitle>
    </C.Dialog>,
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("theme options reach native components without fixing a canvas locale", () => {
  function ThemeReadback() {
    const theme = useTheme();
    return (
      <span>
        {theme.palette.mode}:{theme.shape.borderRadius}:
        {theme.palette.primary.main}
      </span>
    );
  }
  render(
    <C.MaterialThemeProvider
      theme={{
        palette: { mode: "dark", primary: { main: "#663399" } },
        shape: { borderRadius: 12 },
      }}
    >
      <ThemeReadback />
    </C.MaterialThemeProvider>,
  );
  expect(screen.getByText("dark:12:#663399")).toBeDefined();
});

it("canvas reveals do not invoke native transition lifecycle business callbacks", () => {
  mode.canvas = { interactive: false };
  const enter = vi.fn();
  const slotEnter = vi.fn();
  render(
    <C.Dialog
      open={false}
      __canvas={{ selected: true }}
      onTransitionEnter={enter}
      slotProps={{ transition: { onEnter: slotEnter, timeout: 0 } }}
    >
      <C.DialogTitle>Editing</C.DialogTitle>
    </C.Dialog>,
  );
  expect(screen.getByRole("dialog")).toBeDefined();
  expect(enter).not.toHaveBeenCalled();
  expect(slotEnter).not.toHaveBeenCalled();
});

it("element-valued slots preserve native cloning and form control events", () => {
  const changed = vi.fn();
  const deleted = vi.fn();
  render(
    <>
      <C.FormControlLabel
        label="Accept"
        onChange={changed}
        control={<Observer>{() => [<C.Checkbox key="check" />]}</Observer>}
      />
      <C.Chip
        label="Filter"
        onDelete={deleted}
        deleteIcon={
          <Observer>
            {() => [
              <span key="delete" data-testid="delete">
                ×
              </span>,
            ]}
          </Observer>
        }
      />
      <C.Stepper
        activeStep={1}
        connector={
          <Observer>{() => [<C.StepConnector key="connector" />]}</Observer>
        }
      >
        <Observer>
          {() => (
            <>
              <C.Step>
                <C.StepLabel>First</C.StepLabel>
              </C.Step>
              <C.Step>
                <C.StepLabel>Second</C.StepLabel>
              </C.Step>
            </>
          )}
        </Observer>
      </C.Stepper>
    </>,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Accept" }));
  expect(changed.mock.calls[0][1]).toBe(true);
  fireEvent.click(screen.getByTestId("delete"));
  expect(deleted).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Second").className).toContain("Mui-active");
});

it("exposes native HTML link and form attributes omitted from MUI API tables", () => {
  expect(componentMeta("Link").props.href).toMatchObject({ type: "href" });
  expect(componentMeta("Switch").props.name).toBe("string");
  const view = render(
    <form>
      <C.Link href="/profile" target="_blank" rel="noopener">
        Profile
      </C.Link>
      <C.Checkbox name="accepted" value="yes" defaultChecked />
    </form>,
  );
  expect(
    screen.getByRole("link", { name: "Profile" }).getAttribute("href"),
  ).toBe("/profile");
  expect(
    new FormData(view.container.querySelector("form")!).get("accepted"),
  ).toBe("yes");
});
