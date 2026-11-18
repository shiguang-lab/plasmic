import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import * as C from "./components";
import { componentNames } from "./metadata";

type Name = (typeof componentNames)[number];
type Fixture = {
  props?: Record<string, unknown>;
  wrap?: (child: React.ReactElement) => React.ReactElement;
};
const table = (child: React.ReactElement) => (
  <table>
    <tbody>
      <tr>{child}</tr>
    </tbody>
  </table>
);
const step = (child: React.ReactElement) => (
  <C.Stepper>
    <C.Step>{child}</C.Step>
  </C.Stepper>
);
const accordion = (child: React.ReactElement) => (
  <C.Accordion defaultExpanded>
    <C.AccordionSummary>Summary</C.AccordionSummary>
    {child}
  </C.Accordion>
);
// Every catalog member is rendered in its native context with a real configuration.
const fixtures: Record<Name, Fixture> = {
  Accordion: {
    props: {
      defaultExpanded: true,
      children: [
        <C.AccordionSummary key="s">Summary</C.AccordionSummary>,
        <C.AccordionDetails key="d">Details</C.AccordionDetails>,
      ],
    },
  },
  AccordionActions: {
    props: { children: <C.Button>Save</C.Button> },
    wrap: accordion,
  },
  AccordionDetails: { props: { children: "Details" }, wrap: accordion },
  AccordionSummary: {
    props: { children: "Summary" },
    wrap: (c) => (
      <C.Accordion>
        {c}
        <C.AccordionDetails>Details</C.AccordionDetails>
      </C.Accordion>
    ),
  },
  Alert: { props: { severity: "warning", children: "Warning" } },
  AlertTitle: {
    props: { children: "Warning title" },
    wrap: (c) => <C.Alert>{c}</C.Alert>,
  },
  AppBar: {
    props: { position: "static", children: <C.Toolbar>Tools</C.Toolbar> },
  },
  Autocomplete: {
    props: {
      options: ["One", "Two"],
      defaultValue: "Two",
      textFieldProps: { label: "Choice" },
    },
  },
  Avatar: { props: { variant: "rounded", children: "AB" } },
  AvatarGroup: {
    props: {
      max: 2,
      children: [
        <C.Avatar key="a">A</C.Avatar>,
        <C.Avatar key="b">B</C.Avatar>,
        <C.Avatar key="c">C</C.Avatar>,
      ],
    },
  },
  Backdrop: { props: { open: true, children: "Loading" } },
  Badge: { props: { badgeContent: 5, children: <span>Inbox</span> } },
  BottomNavigation: {
    props: {
      defaultValue: "b",
      children: [
        <C.BottomNavigationAction key="a" value="a" label="First" />,
        <C.BottomNavigationAction key="b" value="b" label="Second" />,
      ],
    },
  },
  BottomNavigationAction: {
    props: { value: "a", label: "First" },
    wrap: (c) => <C.BottomNavigation defaultValue="a">{c}</C.BottomNavigation>,
  },
  Box: { props: { component: "section", sx: { padding: 2 }, children: "Box" } },
  Breadcrumbs: {
    props: {
      separator: ">",
      children: [
        <C.Link key="a" href="/">
          Home
        </C.Link>,
        <span key="b">Current</span>,
      ],
    },
  },
  Button: { props: { variant: "contained", children: "Save" } },
  ButtonGroup: {
    props: {
      orientation: "vertical",
      children: [
        <C.Button key="a">One</C.Button>,
        <C.Button key="b">Two</C.Button>,
      ],
    },
  },
  Card: {
    props: { raised: true, children: <C.CardContent>Card</C.CardContent> },
  },
  CardActionArea: {
    props: { children: "Open" },
    wrap: (c) => <C.Card>{c}</C.Card>,
  },
  CardActions: {
    props: { children: <C.Button>Save</C.Button> },
    wrap: (c) => <C.Card>{c}</C.Card>,
  },
  CardContent: {
    props: { children: "Content" },
    wrap: (c) => <C.Card>{c}</C.Card>,
  },
  CardHeader: {
    props: {
      title: "Title",
      subheader: "Subtitle",
      action: <C.IconButton aria-label="More">+</C.IconButton>,
    },
    wrap: (c) => <C.Card>{c}</C.Card>,
  },
  CardMedia: { props: { component: "img", image: "cover.png", alt: "Cover" } },
  Checkbox: { props: { defaultChecked: true, name: "accepted" } },
  Chip: { props: { label: "Chip", onDelete: () => {} } },
  CircularProgress: { props: { variant: "determinate", value: 40 } },
  Container: { props: { maxWidth: "sm", children: "Container" } },
  Dialog: {
    props: { open: true, children: <C.DialogTitle>Confirm</C.DialogTitle> },
  },
  DialogActions: {
    props: { children: <C.Button>Confirm</C.Button> },
    wrap: (c) => <C.Dialog open>{c}</C.Dialog>,
  },
  DialogContent: {
    props: { children: "Content" },
    wrap: (c) => <C.Dialog open>{c}</C.Dialog>,
  },
  DialogContentText: {
    props: { children: "Content" },
    wrap: (c) => (
      <C.Dialog open>
        <C.DialogContent>{c}</C.DialogContent>
      </C.Dialog>
    ),
  },
  DialogTitle: {
    props: { children: "Confirm" },
    wrap: (c) => <C.Dialog open>{c}</C.Dialog>,
  },
  Divider: { props: { children: "Section" } },
  Drawer: { props: { open: true, anchor: "right", children: "Drawer" } },
  Fab: { props: { size: "small", children: "+" } },
  FormControl: {
    props: {
      error: true,
      children: <C.FormHelperText>Error</C.FormHelperText>,
    },
  },
  FormControlLabel: {
    props: { label: "Accept", control: <C.Checkbox />, disabled: true },
  },
  FormGroup: {
    props: {
      row: true,
      children: <C.FormControlLabel label="Accept" control={<C.Checkbox />} />,
    },
  },
  FormHelperText: { props: { error: true, children: "Error" } },
  FormLabel: { props: { required: true, children: "Label" } },
  Grid: {
    props: {
      container: true,
      spacing: 2,
      children: <C.Grid size={6}>Grid</C.Grid>,
    },
  },
  IconButton: { props: { disabled: true, children: "+" } },
  ImageList: {
    props: {
      cols: 2,
      children: (
        <C.ImageListItem>
          <img src="cover.png" alt="Cover" />
        </C.ImageListItem>
      ),
    },
  },
  ImageListItem: {
    props: { cols: 2, children: <img src="cover.png" alt="Cover" /> },
    wrap: (c) => <C.ImageList>{c}</C.ImageList>,
  },
  ImageListItemBar: {
    props: { title: "Image", subtitle: "Subtitle" },
    wrap: (c) => (
      <C.ImageList>
        <C.ImageListItem>
          <img src="cover.png" alt="Cover" />
          {c}
        </C.ImageListItem>
      </C.ImageList>
    ),
  },
  Input: { props: { defaultValue: "Input", name: "input" } },
  InputAdornment: { props: { position: "start", children: "$" } },
  InputBase: { props: { defaultValue: "Input", name: "input" } },
  InputLabel: { props: { required: true, children: "Label" } },
  LinearProgress: { props: { variant: "determinate", value: 40 } },
  Link: { props: { href: "/details", children: "Details" } },
  List: { props: { dense: true, children: <C.ListItem>Item</C.ListItem> } },
  ListItem: {
    props: {
      secondaryAction: <C.Button>Open</C.Button>,
      children: <C.ListItemText primary="Item" />,
    },
    wrap: (c) => <C.List>{c}</C.List>,
  },
  ListItemAvatar: {
    props: { children: <C.Avatar>A</C.Avatar> },
    wrap: (c) => (
      <C.List>
        <C.ListItem>{c}</C.ListItem>
      </C.List>
    ),
  },
  ListItemButton: {
    props: { selected: true, children: "Selected" },
    wrap: (c) => <C.List>{c}</C.List>,
  },
  ListItemIcon: {
    props: {
      children: (
        <C.SvgIcon>
          <path d="M0 0h24v24z" />
        </C.SvgIcon>
      ),
    },
    wrap: (c) => (
      <C.List>
        <C.ListItem>{c}</C.ListItem>
      </C.List>
    ),
  },
  ListItemText: { props: { primary: "Primary", secondary: "Secondary" } },
  ListSubheader: {
    props: { children: "Section" },
    wrap: (c) => <C.List>{c}</C.List>,
  },
  Menu: {
    props: {
      open: true,
      anchorReference: "anchorPosition",
      anchorPosition: { top: 10, left: 10 },
      children: <C.MenuItem>Item</C.MenuItem>,
    },
  },
  MenuItem: {
    props: { selected: true, children: "Item" },
    wrap: (c) => <C.MenuList>{c}</C.MenuList>,
  },
  MenuList: { props: { children: <C.MenuItem>Item</C.MenuItem> } },
  MobileStepper: {
    props: {
      steps: 4,
      activeStep: 2,
      variant: "text",
      position: "static",
      backButton: <C.Button>Back</C.Button>,
      nextButton: <C.Button>Next</C.Button>,
    },
  },
  NativeSelect: {
    props: {
      defaultValue: "b",
      children: [
        <C.NativeOption key="a" value="a">
          One
        </C.NativeOption>,
        <C.NativeOption key="b" value="b">
          Two
        </C.NativeOption>,
      ],
    },
  },
  OutlinedInput: { props: { defaultValue: "Input", name: "input" } },
  Pagination: { props: { count: 5, defaultPage: 2 } },
  PaginationItem: { props: { page: 2, selected: true } },
  Paper: { props: { elevation: 4, children: "Paper" } },
  Radio: { props: { defaultChecked: true, value: "yes" } },
  RadioGroup: {
    props: {
      defaultValue: "yes",
      children: (
        <C.FormControlLabel value="yes" label="Yes" control={<C.Radio />} />
      ),
    },
  },
  Rating: { props: { defaultValue: 3, name: "rating", precision: 0.5 } },
  Select: {
    props: {
      defaultValue: "b",
      children: [
        <C.MenuItem key="a" value="a">
          One
        </C.MenuItem>,
        <C.MenuItem key="b" value="b">
          Two
        </C.MenuItem>,
      ],
    },
  },
  Skeleton: { props: { width: 120, height: 32, variant: "rounded" } },
  Slider: {
    props: {
      defaultValue: [20, 60],
      min: 0,
      max: 100,
      valueLabelDisplay: "on",
    },
  },
  Snackbar: { props: { open: true, message: "Saved" } },
  SnackbarContent: {
    props: { message: "Saved", action: <C.Button>Undo</C.Button> },
  },
  Stack: {
    props: {
      direction: "row",
      spacing: 2,
      divider: <C.Divider orientation="vertical" flexItem />,
      children: [<span key="a">A</span>, <span key="b">B</span>],
    },
  },
  Step: {
    props: { completed: true, children: <C.StepLabel>Done</C.StepLabel> },
    wrap: (c) => <C.Stepper>{c}</C.Stepper>,
  },
  StepButton: {
    props: { children: <C.StepLabel>Step</C.StepLabel> },
    wrap: step,
  },
  StepConnector: {
    props: {},
    wrap: (c) => (
      <C.Stepper connector={c}>
        <C.Step>
          <C.StepLabel>One</C.StepLabel>
        </C.Step>
        <C.Step>
          <C.StepLabel>Two</C.StepLabel>
        </C.Step>
      </C.Stepper>
    ),
  },
  StepContent: {
    props: { children: "Details" },
    wrap: (c) => (
      <C.Stepper orientation="vertical">
        <C.Step>
          <C.StepLabel>Step</C.StepLabel>
          {c}
        </C.Step>
      </C.Stepper>
    ),
  },
  StepLabel: { props: { children: "Step" }, wrap: step },
  Stepper: {
    props: {
      activeStep: 1,
      children: [
        <C.Step key="a">
          <C.StepLabel>One</C.StepLabel>
        </C.Step>,
        <C.Step key="b">
          <C.StepLabel>Two</C.StepLabel>
        </C.Step>,
      ],
    },
  },
  SvgIcon: {
    props: { viewBox: "0 0 16 16", children: <path d="M0 0h16v16z" /> },
  },
  SwipeableDrawer: {
    props: {
      open: true,
      onClose: () => {},
      onOpen: () => {},
      children: "Drawer",
    },
  },
  Switch: { props: { defaultChecked: true, name: "enabled" } },
  Tab: {
    props: { value: "a", label: "Tab" },
    wrap: (c) => <C.Tabs defaultValue="a">{c}</C.Tabs>,
  },
  Table: {
    props: {
      size: "small",
      children: (
        <C.TableBody>
          <C.TableRow>
            <C.TableCell>Cell</C.TableCell>
          </C.TableRow>
        </C.TableBody>
      ),
    },
  },
  TableBody: {
    props: {
      children: (
        <C.TableRow>
          <C.TableCell>Cell</C.TableCell>
        </C.TableRow>
      ),
    },
    wrap: (c) => <C.Table>{c}</C.Table>,
  },
  TableCell: { props: { align: "right", children: "Cell" }, wrap: table },
  TableContainer: {
    props: {
      children: (
        <C.Table>
          <C.TableBody>
            <C.TableRow>
              <C.TableCell>Cell</C.TableCell>
            </C.TableRow>
          </C.TableBody>
        </C.Table>
      ),
    },
  },
  TableFooter: {
    props: {
      children: (
        <C.TableRow>
          <C.TableCell>Footer</C.TableCell>
        </C.TableRow>
      ),
    },
    wrap: (c) => <C.Table>{c}</C.Table>,
  },
  TableHead: {
    props: {
      children: (
        <C.TableRow>
          <C.TableCell>Header</C.TableCell>
        </C.TableRow>
      ),
    },
    wrap: (c) => <C.Table>{c}</C.Table>,
  },
  TablePagination: {
    props: {
      count: 100,
      page: 1,
      rowsPerPage: 10,
      onPageChange: () => {},
      component: "div",
    },
  },
  TableRow: {
    props: { selected: true, children: <C.TableCell>Cell</C.TableCell> },
    wrap: (c) => (
      <C.Table>
        <C.TableBody>{c}</C.TableBody>
      </C.Table>
    ),
  },
  TableSortLabel: {
    props: { active: true, direction: "desc", children: "Sort" },
  },
  Tabs: {
    props: {
      defaultValue: "a",
      children: [
        <C.Tab key="a" value="a" label="First" />,
        <C.Tab key="b" value="b" label="Second" />,
      ],
    },
  },
  TextField: {
    props: { label: "Name", defaultValue: "Ada", helperText: "Help" },
  },
  ToggleButton: { props: { value: "a", selected: true, children: "A" } },
  ToggleButtonGroup: {
    props: {
      exclusive: true,
      value: "a",
      children: [
        <C.ToggleButton key="a" value="a">
          A
        </C.ToggleButton>,
        <C.ToggleButton key="b" value="b">
          B
        </C.ToggleButton>,
      ],
    },
  },
  Toolbar: { props: { variant: "dense", children: "Toolbar" } },
  Tooltip: {
    props: { open: true, title: "Tooltip", children: <button>Trigger</button> },
  },
  Typography: {
    props: { variant: "h6", component: "h2", children: "Heading" },
  },
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it.each(componentNames)(
  "%s renders its configured native contract without warnings",
  (name) => {
    const errors = vi.spyOn(console, "error");
    const warnings = vi.spyOn(console, "warn");
    const { props, wrap } = fixtures[name];
    const child = React.createElement(C[name] as React.ComponentType<any>, {
      ...props,
      "data-testid": "subject",
    });
    render(wrap ? wrap(child) : child);
    expect(screen.getAllByTestId("subject").length, name).toBeGreaterThan(0);
    expect(errors.mock.calls, name).toEqual([]);
    expect(warnings.mock.calls, name).toEqual([]);
  },
);
it("NativeOption exposes label, value and disabled through a real select", () => {
  render(
    <select defaultValue="b">
      <C.NativeOption value="a" disabled>
        A
      </C.NativeOption>
      <C.NativeOption value="b" label="Second">
        B
      </C.NativeOption>
    </select>,
  );
  expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("b");
  expect(
    (screen.getByRole("option", { name: "A" }) as HTMLOptionElement).disabled,
  ).toBe(true);
  expect((screen.getAllByRole("option")[1] as HTMLOptionElement).label).toBe(
    "Second",
  );
});
