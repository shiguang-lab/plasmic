import { StructurePanel } from "@/wab/client/components/studio/StructurePanel";
import { ensure } from "@/wab/shared/common";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { observable, runInAction } from "mobx";
import * as React from "react";

const fixture = vi.hoisted(() => ({
  ctx: undefined as any,
  resize: undefined as any,
}));

vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => fixture.ctx,
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (text: string) => text }),
}));
vi.mock(
  "@/wab/client/components/sidebar-tabs/ProjectPanel/NavigationDropdown",
  () => ({
    NavigationDropdown: ({
      onClose,
      expanded,
      onExpandedChange,
    }: {
      onClose: () => void;
      expanded: boolean;
      onExpandedChange: (expanded: boolean) => void;
    }) => (
      <div>
        <button
          aria-expanded={expanded}
          onClick={() => {
            fixture.ctx.setNavigationPanel("outline");
            onExpandedChange(!expanded);
          }}
        >
          Project directory
        </button>
        {!expanded && (
          <button onClick={() => onExpandedChange(true)}>Current object</button>
        )}
        <div style={{ display: expanded ? undefined : "none" }}>
          <input
            aria-label="Project search"
            ref={fixture.ctx.projectSearchInputRef}
          />
          {["Artboard group", "Page", "Component"].map((name) => (
            <button
              key={name}
              onClick={() => {
                runInAction(() => (fixture.ctx.currentArena = name));
                onClose();
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    ),
  }),
);
vi.mock("@/wab/client/components/sidebar-tabs/outline-tab", async () => {
  const { observer } = await import("mobx-react");
  return {
    OutlineTab: observer(() => (
      <div>
        <span>{fixture.ctx.currentArena} layers</span>
        <input aria-label="Layer search" />
      </div>
    )),
  };
});

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        fixture.resize = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  fixture.ctx = observable(
    {
      navigationPanel: "outline",
      leftTabKey: "outline",
      currentArena: "Artboard group",
      projectSearchInputRef: React.createRef<HTMLInputElement>(),
      setNavigationPanel(panel: string) {
        this.navigationPanel = panel;
      },
      focusOnProjectSearchInput: vi.fn(() =>
        fixture.ctx.projectSearchInputRef.current?.focus(),
      ),
    },
    {
      projectSearchInputRef: observable.ref,
      focusOnProjectSearchInput: false,
    },
  );
});
afterEach(cleanup);

it("keeps the directory and layer editor mounted when opening groups, pages and components", () => {
  render(<StructurePanel />);
  const projectSearch = screen.getByRole("textbox", { name: "Project search" });
  const layerSearch = screen.getByRole("textbox", { name: "Layer search" });
  fireEvent.change(projectSearch, { target: { value: "Customer" } });
  fireEvent.change(layerSearch, { target: { value: "AppShell" } });

  for (const name of ["Page", "Component", "Artboard group"]) {
    fireEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByText(`${name} layers`)).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Project search" })).toBe(
      projectSearch,
    );
    expect(screen.getByRole("textbox", { name: "Layer search" })).toBe(
      layerSearch,
    );
    expect(projectSearch).toHaveValue("Customer");
    expect(layerSearch).toHaveValue("AppShell");
  }
  expect(fixture.ctx.focusOnProjectSearchInput).not.toHaveBeenCalled();
});

it("restores the resized directory after title collapse and reopens it for project search", async () => {
  const { container } = render(<StructurePanel />);
  const splitter = ensure(
    container.querySelector(".ant-splitter"),
    "Structure panel splitter",
  );
  Object.defineProperties(splitter, {
    offsetWidth: { value: 300 },
    offsetHeight: { value: 600 },
    getBoundingClientRect: { value: () => new DOMRect(0, 0, 300, 600) },
  });
  await act(async () => fixture.resize([{ target: splitter }]));
  const directory = ensure(
    container.querySelector<HTMLElement>(".ant-splitter-panel"),
    "Project directory panel",
  );
  expect(directory).toHaveStyle({ flexBasis: "252px", overflow: "hidden" });

  fireEvent.mouseDown(screen.getByRole("separator"), { clientY: 252 });
  fireEvent.mouseMove(window, { clientY: 342 });
  fireEvent.mouseUp(window);
  expect(Number.parseFloat(directory.style.flexBasis)).toBeCloseTo(342);
  expect(screen.getByText("Artboard group layers")).toBeVisible();

  expect(screen.queryByRole("button", { name: /Toggle .* panel/ })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Project directory" }));
  expect(Number.parseFloat(directory.style.flexBasis)).toBeCloseTo(84);
  expect(
    screen.getByRole("textbox", { name: "Project search", hidden: true }),
  ).not.toBeVisible();
  expect(screen.getByRole("textbox", { name: "Layer search" })).toBeVisible();
  expect(fixture.ctx.currentArena).toBe("Artboard group");
  fireEvent.click(screen.getByRole("button", { name: "Current object" }));
  expect(Number.parseFloat(directory.style.flexBasis)).toBeCloseTo(342);
  fireEvent.click(screen.getByRole("button", { name: "Project directory" }));

  act(() => {
    runInAction(() => fixture.ctx.setNavigationPanel("pages"));
  });
  expect(Number.parseFloat(directory.style.flexBasis)).toBeCloseTo(342);
  expect(screen.getByRole("textbox", { name: "Project search" })).toHaveFocus();
  expect(screen.getByRole("textbox", { name: "Layer search" })).toBeVisible();
});
