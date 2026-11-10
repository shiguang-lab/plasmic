import {
  BottomModals,
  BottomModalsProvider,
  useBottomModalActions,
} from "@/wab/client/components/BottomModal";
import {
  SidebarModal,
  SidebarModalProvider,
} from "@/wab/client/components/sidebar/SidebarModal";
import Select from "@/wab/client/components/widgets/Select";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React from "react";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("opens the shared select with native keyboard input and chooses an option", async () => {
  // jsdom does not expose CSS.escape; these option IDs need no escaping.
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  const changed = vi.fn();
  render(
    <Select aria-label="Property type" value="text" onChange={changed}>
      <Select.Option value="text">Text</Select.Option>
      <Select.Option value="event">Function</Select.Option>
    </Select>,
  );
  const trigger = screen.getByRole("button", { name: "Property type" });
  act(() => trigger.focus());
  fireEvent.keyDown(trigger, {
    key: "ArrowDown",
    code: "ArrowDown",
    keyCode: 40,
  });
  await screen.findByRole("option", { name: "Function" });
  fireEvent.click(screen.getByRole("option", { name: "Function" }));
  expect(changed).toHaveBeenCalledWith("event");
});

it("opens a portaled select inside a sidebar editor without dismissing its owner", async () => {
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  const closed = vi.fn();
  render(
    <SidebarModalProvider containerSelector="#sidebar">
      <div id="sidebar" />
      <SidebarModal show title="Property" onClose={closed}>
        <Select aria-label="Property type" value="text">
          <Select.Option value="text">Text</Select.Option>
          <Select.Option value="event">Function</Select.Option>
        </Select>
      </SidebarModal>
    </SidebarModalProvider>,
  );
  const trigger = await screen.findByRole("button", { name: "Property type" });
  act(() => trigger.focus());
  fireEvent.keyDown(trigger, {
    key: "ArrowDown",
    code: "ArrowDown",
    keyCode: 40,
  });
  await screen.findByRole("option", { name: "Function" });
  expect(closed).not.toHaveBeenCalled();
});

it("lets a sidebar editor own focus when its DOM is inside a bottom modal but its Portal owner is outside", async () => {
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  function Editor() {
    const actions = useBottomModalActions();
    const [sidebar, setSidebar] = React.useState(false);
    return (
      <>
        <button
          onClick={() =>
            actions.open("actions", {
              title: "Actions",
              children: (
                <>
                  <div id="sidebar" />
                  <button onClick={() => setSidebar(true)}>Edit step</button>
                </>
              ),
            })
          }
        >
          Configure actions
        </button>
        <SidebarModal
          show={sidebar}
          title="Step"
          onClose={() => setSidebar(false)}
        >
          <Select aria-label="Operation" value="set">
            <Select.Option value="set">Set value</Select.Option>
            <Select.Option value="clear">Clear value</Select.Option>
          </Select>
        </SidebarModal>
      </>
    );
  }
  render(
    <BottomModalsProvider>
      <SidebarModalProvider containerSelector="#sidebar">
        <Editor />
        <BottomModals />
      </SidebarModalProvider>
    </BottomModalsProvider>,
  );
  fireEvent.click(screen.getByText("Configure actions"));
  fireEvent.click(await screen.findByText("Edit step"));
  const trigger = await screen.findByRole("button", { name: "Operation" });
  act(() => trigger.focus());
  fireEvent.keyDown(trigger, {
    key: "ArrowDown",
    code: "ArrowDown",
    keyCode: 40,
  });
  await screen.findByRole("option", { name: "Clear value" });
});
