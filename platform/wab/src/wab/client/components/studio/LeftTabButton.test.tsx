import LeftTabButton from "@/wab/client/components/studio/LeftTabButton";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

afterEach(cleanup);
it("dismisses a hovered tool hint when the tool is activated", async () => {
  const activate = vi.fn();
  render(
    <LeftTabButton
      label="Layers"
      hasLabel
      tooltip="Open layers"
      onClick={activate}
    />,
  );
  const button = screen.getByRole("button", { name: "Open layers" });
  fireEvent.mouseEnter(button);
  await screen.findByRole("tooltip");
  fireEvent.click(button);
  expect(activate).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
});
