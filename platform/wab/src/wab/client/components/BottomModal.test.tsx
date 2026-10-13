import {
  BottomModalButtons,
  BottomModals,
  BottomModalsProvider,
  useBottomModalActions,
} from "@/wab/client/components/BottomModal";
import { isAnyModalOpen } from "@/wab/client/components/widgets/open-modals";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

afterEach(cleanup);

it("keeps query actions in the focus scope and handles Escape without changing the underlying selection", async () => {
  const cancel = vi.fn();
  const underlyingKey = vi.fn();
  function Query() {
    const actions = useBottomModalActions();
    return (
      <button
        onClick={() =>
          actions.open("query", {
            title: "Configure query",
            onEscape: () => {
              cancel();
              actions.close("query");
            },
            children: (
              <>
                <input
                  aria-label="Query expression"
                  onKeyDown={(event) => event.stopPropagation()}
                />
                <BottomModalButtons>
                  <button>Execute</button>
                  <button>Save</button>
                  <button>Cancel</button>
                </BottomModalButtons>
              </>
            ),
          })
        }
      >
        Configure
      </button>
    );
  }
  render(
    <BottomModalsProvider>
      <Query />
      <BottomModals />
    </BottomModalsProvider>,
  );
  window.addEventListener("keydown", underlyingKey);
  try {
    fireEvent.click(screen.getByRole("button", { name: "Configure" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Configure query",
    });
    expect(isAnyModalOpen()).toBe(true);
    expect(dialog.contains(screen.getByRole("button", { name: "Save" }))).toBe(
      true,
    );
    expect(
      dialog.contains(screen.getByRole("button", { name: "Execute" })),
    ).toBe(true);
    fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Query expression" }),
      { key: "Escape" },
    );
    expect(cancel).toHaveBeenCalledOnce();
    expect(underlyingKey).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(isAnyModalOpen()).toBe(false);
  } finally {
    window.removeEventListener("keydown", underlyingKey);
  }
});
