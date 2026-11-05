import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { AiModelDropdown } from "@/wab/client/components/copilot/AiModelDropdown";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

afterEach(cleanup);

it("shows names for the selected model and menu options, falls back to IDs, and selects by ID", async () => {
  const change = vi.fn();
  const open = vi.fn();
  render(
    <AntdConfigProvider productUI>
      <AiModelDropdown
        models={[{ id: "muse/muse", name: "Muse Agent" }, { id: "id-only" }, { id: "empty-name", name: "" }]}
        model="muse/muse"
        onChange={change}
        onOpen={open}
      />
    </AntdConfigProvider>,
  );
  const button = screen.getByRole("button", { name: "AI model" });
  expect(button).toHaveTextContent("Muse Agent");
  expect(button).not.toHaveTextContent("muse/muse");
  fireEvent.click(button);
  const namedOption = await screen.findByRole("menuitem", { name: "Muse Agent" });
  expect(screen.getByRole("menuitem", { name: "id-only" })).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "empty-name" })).toBeTruthy();
  expect(open).toHaveBeenCalledOnce();
  fireEvent.click(namedOption);
  expect(change).toHaveBeenCalledExactlyOnceWith("muse/muse");
});
