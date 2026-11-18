import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import * as C from "./components";
import { registerAll } from "./index";
import { componentMeta, componentNames } from "./metadata";

afterEach(cleanup);

// Cover every children contract, including slots supplied outside API JSON.
const contentChildren = [
  "AccordionActions",
  "AccordionDetails",
  "AccordionSummary",
  "Alert",
  "AlertTitle",
  "AppBar",
  "Button",
  "Card",
  "CardActionArea",
  "CardActions",
  "CardContent",
  "Dialog",
  "DialogActions",
  "DialogContent",
  "DialogContentText",
  "DialogTitle",
  "Drawer",
  "Fab",
  "FormControl",
  "FormGroup",
  "FormHelperText",
  "FormLabel",
  "IconButton",
  "ImageListItem",
  "InputAdornment",
  "InputLabel",
  "Link",
  "ListItem",
  "ListItemAvatar",
  "ListItemButton",
  "ListItemIcon",
  "ListSubheader",
  "MenuItem",
  "StepContent",
  "SwipeableDrawer",
  "TableContainer",
  "ToggleButton",
  "Toolbar",
  "Tooltip",
  "Typography",
];
const quietChildren = [
  "Accordion",
  "Avatar",
  "AvatarGroup",
  "Backdrop",
  "Badge",
  "BottomNavigation",
  "Box",
  "Breadcrumbs",
  "ButtonGroup",
  "CardMedia",
  "Container",
  "Divider",
  "Grid",
  "ImageList",
  "List",
  "ListItemText",
  "Menu",
  "MenuList",
  "NativeSelect",
  "Paper",
  "RadioGroup",
  "Select",
  "Skeleton",
  "Snackbar",
  "Stack",
  "Step",
  "StepButton",
  "StepLabel",
  "Stepper",
  "SvgIcon",
  "Table",
  "TableBody",
  "TableCell",
  "TableFooter",
  "TableHead",
  "TableRow",
  "TableSortLabel",
  "Tabs",
  "TextField",
  "ToggleButtonGroup",
];
it("classifies all registered slots without globally hiding primary content", () => {
  const actualChildren: string[] = [];
  for (const name of componentNames) {
    for (const [key, prop] of Object.entries(componentMeta(name).props)) {
      if (typeof prop !== "object" || prop.type !== "slot") continue;
      if (key === "children") {
        actualChildren.push(name);
        expect(prop.hidePlaceholder, `${name}.children`).toBe(
          quietChildren.includes(name),
        );
      } else {
        // The required control is an editing target; optional adornments,
        // labels and native-default overrides must not materialize themselves.
        expect(prop.hidePlaceholder, `${name}.${key}`).toBe(
          !(name === "FormControlLabel" && key === "control"),
        );
      }
    }
  }
  expect(actualChildren.sort()).toEqual(
    [...contentChildren, ...quietChildren].sort(),
  );
  const registerComponent = vi.fn();
  registerAll({ registerComponent, registerGlobalContext: vi.fn() });
  expect(
    registerComponent.mock.calls.find(
      ([, m]) => m.importName === "NativeOption",
    )?.[1].props.children,
  ).toMatchObject({ type: "slot", hidePlaceholder: true });
});

it.each([
  "Checkbox",
  "Radio",
  "Switch",
  "MobileStepper",
  "PaginationItem",
  "SnackbarContent",
  "TablePagination",
  "Tab",
  "BottomNavigationAction",
  "Chip",
] as const)(
  "%s does not offer children that its native implementation ignores",
  (name) => {
    expect(componentMeta(name).props.children).toBeUndefined();
  },
);
it.each(["Alert", "CardHeader", "Snackbar", "SnackbarContent"] as const)(
  "%s.action remains editable content, not a ref",
  (name) => {
    expect(componentMeta(name).props.action).toMatchObject({
      type: "slot",
      hidePlaceholder: true,
    });
  },
);
it("retains ref actions, custom-validator slots, descriptions and child restrictions", () => {
  expect(componentMeta("Button").props.action).toMatchObject({
    type: "exprEditor",
  });
  expect(componentMeta("Tabs").props.action).toMatchObject({
    type: "exprEditor",
  });
  expect(componentMeta("IconButton").props.children).toMatchObject({
    type: "slot",
    defaultValue: { type: "text", value: "＋" },
  });
  expect(componentMeta("Tooltip").props.children).toMatchObject({
    type: "slot",
    defaultValue: { type: "component" },
  });
  expect(componentMeta("Tab").props.icon).toMatchObject({
    type: "slot",
    hidePlaceholder: true,
  });
  expect(componentMeta("Accordion").props.children).toMatchObject({
    description: "The content of the component.",
    allowedComponents: [
      "plasmic-material-ui-accordion-summary",
      "plasmic-material-ui-accordion-details",
      "plasmic-material-ui-accordion-actions",
    ],
  });
});

it("decorative Box and Container stay empty and still accept explicit content", () => {
  const view = render(
    <>
      <C.Box
        data-testid="ribbon"
        sx={{ backgroundImage: 'url("ribbon.png")' }}
      />
      <C.Container data-testid="container" />
    </>,
  );
  expect(screen.getByTestId("ribbon").childElementCount).toBe(0);
  expect(screen.getByTestId("container").childElementCount).toBe(0);
  view.rerender(
    <C.Box data-testid="ribbon">
      <span>Content</span>
    </C.Box>,
  );
  expect(screen.getByText("Content")).toBeDefined();
  view.rerender(<C.Box data-testid="ribbon">{null}</C.Box>);
  expect(screen.getByTestId("ribbon").childElementCount).toBe(0);
});
it("icon-only steps do not create labels; explicit labels remain editable", () => {
  const steps = (label?: React.ReactNode) => (
    <C.Stepper alternativeLabel activeStep={0}>
      {[0, 1, 2].map((i) => (
        <C.Step key={i}>
          <C.StepLabel>{label}</C.StepLabel>
        </C.Step>
      ))}
    </C.Stepper>
  );
  const view = render(steps());
  expect(view.container.querySelectorAll(".MuiStepIcon-root")).toHaveLength(3);
  expect(view.container.querySelectorAll(".MuiStepLabel-label")).toHaveLength(
    0,
  );
  view.rerender(steps("Capture"));
  expect(view.container.querySelectorAll(".MuiStepLabel-label")).toHaveLength(
    3,
  );
  view.rerender(steps(null));
  expect(view.container.querySelectorAll(".MuiStepLabel-label")).toHaveLength(
    0,
  );
});
it("Divider retains a native hr until content is explicitly supplied", () => {
  const view = render(<C.Divider />);
  expect(screen.getByRole("separator").tagName).toBe("HR");
  expect(view.container.querySelector(".MuiDivider-wrapper")).toBeNull();
  view.rerender(<C.Divider>Section</C.Divider>);
  expect(screen.getByRole("separator").tagName).toBe("DIV");
  expect(screen.getByText("Section").className).toContain("MuiDivider-wrapper");
  view.rerender(<C.Divider>{null}</C.Divider>);
  expect(screen.getByRole("separator").tagName).toBe("HR");
});
it("Skeleton infers size only from supplied children", () => {
  const view = render(
    <C.Skeleton data-testid="skeleton" width={120} height={32} />,
  );
  expect(screen.getByTestId("skeleton").className).not.toContain(
    "MuiSkeleton-withChildren",
  );
  view.rerender(
    <C.Skeleton data-testid="skeleton">
      <span>Measure</span>
    </C.Skeleton>,
  );
  expect(screen.getByTestId("skeleton").className).toContain(
    "MuiSkeleton-withChildren",
  );
  view.rerender(<C.Skeleton data-testid="skeleton">{null}</C.Skeleton>);
  expect(screen.getByTestId("skeleton").className).not.toContain(
    "MuiSkeleton-withChildren",
  );
});
it("Avatar preserves native fallback, image and explicit content", () => {
  const view = render(<C.Avatar />);
  expect(view.container.querySelector(".MuiAvatar-fallback")).not.toBeNull();
  view.rerender(<C.Avatar>AB</C.Avatar>);
  expect(screen.getByText("AB")).toBeDefined();
  view.rerender(<C.Avatar>{null}</C.Avatar>);
  expect(view.container.querySelector(".MuiAvatar-fallback")).not.toBeNull();
  view.rerender(<C.Avatar src="avatar.png" alt="Ada" />);
  expect(screen.getByRole("img", { name: "Ada" }).getAttribute("src")).toBe(
    "avatar.png",
  );
});
it("ListItemText keeps its primary/children fallback without phantom content", () => {
  const view = render(<C.ListItemText secondary="Secondary" />);
  expect(view.container.querySelector(".MuiListItemText-primary")).toBeNull();
  view.rerender(<C.ListItemText primary="Primary">Fallback</C.ListItemText>);
  expect(screen.queryByText("Fallback")).toBeNull();
  view.rerender(<C.ListItemText primary={null}>Fallback</C.ListItemText>);
  expect(screen.getByText("Fallback")).toBeDefined();
});
it("Alert preserves its default close action, custom action and explicit null", () => {
  const close = vi.fn();
  const view = render(<C.Alert onClose={close}>Message</C.Alert>);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(close).toHaveBeenCalledOnce();
  view.rerender(
    <C.Alert onClose={close} action={<button>Retry</button>}>
      Message
    </C.Alert>,
  );
  expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
  view.rerender(
    <C.Alert onClose={close} action={null}>
      Message
    </C.Alert>,
  );
  expect(screen.getByRole("button", { name: "Close" })).toBeDefined();
});
it("Snackbar keeps its native message when no replacement children are supplied", () => {
  const view = render(<C.Snackbar open message="Saved" />);
  expect(screen.getByRole("alert").textContent).toBe("Saved");
  view.rerender(
    <C.Snackbar open message="Saved">
      <div role="status">Custom</div>
    </C.Snackbar>,
  );
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Custom");
  view.rerender(<C.Snackbar open message="Saved" children={undefined} />);
  expect(screen.getByRole("alert").textContent).toBe("Saved");
});

function Observer({ children }: { children: () => React.ReactNode }) {
  return children();
}
it("cloned icon slots unwrap Studio observers and preserve native state and events", () => {
  const changed = vi.fn();
  const view = render(
    <C.Checkbox
      onChange={changed}
      icon={<Observer>{() => [<span key="off">Off</span>]}</Observer>}
      checkedIcon={<Observer>{() => [<span key="on">On</span>]}</Observer>}
    />,
  );
  expect(screen.getByText("Off")).toBeDefined();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByText("On")).toBeDefined();
  expect(changed.mock.calls[0][1]).toBe(true);
  view.rerender(
    <C.Radio
      icon={<Observer>{() => [<span key="radio">Radio icon</span>]}</Observer>}
    />,
  );
  expect(screen.getByText("Radio icon")).toBeDefined();
});
it("Tab accepts both element and string icon slots and clones the actual element", () => {
  const view = render(
    <C.Tabs>
      <C.Tab
        label="Home"
        icon={
          <Observer>
            {() => [
              <span key="icon" data-testid="icon">
                Icon
              </span>,
            ]}
          </Observer>
        }
      />
    </C.Tabs>,
  );
  expect(screen.getByTestId("icon").className).toContain("MuiTab-icon");
  view.rerender(
    <C.Tabs>
      <C.Tab label="Home" icon={<Observer>{() => ["H"]}</Observer>} />
    </C.Tabs>,
  );
  expect(screen.getByRole("tab").textContent).toBe("HHome");
  view.rerender(
    <C.Tabs>
      <C.Tab label="Home" icon={<Observer>{() => []}</Observer>} />
    </C.Tabs>,
  );
  expect(screen.getByRole("tab").textContent).toBe("Home");
});
it("StepButton clones the supplied StepLabel instead of nesting a second label", () => {
  const view = render(
    <C.Stepper>
      <C.Step>
        <C.StepButton
          icon={<span data-testid="step-icon">S</span>}
          optional={<span>Optional</span>}
        >
          <Observer>
            {() => [<C.StepLabel key="label">Capture</C.StepLabel>]}
          </Observer>
        </C.StepButton>
      </C.Step>
    </C.Stepper>,
  );
  expect(view.container.querySelectorAll(".MuiStepLabel-root")).toHaveLength(1);
  expect(screen.getByTestId("step-icon")).toBeDefined();
  expect(screen.getByText("Optional")).toBeDefined();
});
it("Stepper preserves default connectors, custom slot content and explicit removal", () => {
  const steps = (props: React.ComponentProps<typeof C.Stepper>) => (
    <C.Stepper {...props}>
      <C.Step>
        <C.StepLabel>First</C.StepLabel>
      </C.Step>
      <C.Step>
        <C.StepLabel>Second</C.StepLabel>
      </C.Step>
    </C.Stepper>
  );
  const view = render(steps({}));
  expect(
    view.container.querySelectorAll(".MuiStepConnector-root"),
  ).toHaveLength(1);
  view.rerender(
    steps({
      connector: (
        <Observer>
          {() => [<span key="connector" data-testid="connector" />]}
        </Observer>
      ),
    }),
  );
  expect(
    view.container.querySelectorAll(".MuiStepConnector-root"),
  ).toHaveLength(0);
  expect(screen.getByTestId("connector")).toBeDefined();
  view.rerender(steps({ connector: null }));
  expect(
    view.container.querySelectorAll(".MuiStepConnector-root"),
  ).toHaveLength(0);
  expect(screen.queryByTestId("connector")).toBeNull();
  view.rerender(steps({ connector: <Observer>{() => []}</Observer> }));
  expect(
    view.container.querySelectorAll(".MuiStepConnector-root"),
  ).toHaveLength(1);
});
it("CardMedia image and TextField input do not require synthetic children", () => {
  const view = render(
    <>
      <C.CardMedia component="img" image="cover.png" alt="Cover" />
      <C.TextField label="Name" />
    </>,
  );
  expect(screen.getByRole("img", { name: "Cover" }).childElementCount).toBe(0);
  expect(screen.getByRole("textbox", { name: "Name" })).toBeDefined();
  view.rerender(
    <C.TextField select label="City" defaultValue="sh">
      <C.MenuItem value="sh">Shanghai</C.MenuItem>
    </C.TextField>,
  );
  expect(screen.getByRole("combobox", { name: "City" }).textContent).toBe(
    "Shanghai",
  );
});
