import { useDataTokenSuggestionsMenu } from "@/wab/client/components/sidebar-tabs/DataBinding/useDataTokenSuggestionsMenu";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

const select = vi.fn();
vi.mock(
  "@/wab/client/components/sidebar-tabs/DataBinding/useSuggestDataTokens",
  () => ({
    useSuggestDataTokens: () => ({
      suggestDataTokens: () => [
        { token: { uuid: "test", name: "Available", value: "10" } },
      ],
      onSelectDataToken: (...args: unknown[]) => select(...args),
    }),
  }),
);
afterEach(cleanup);

it("keeps the closed list registered without mounting a scrolling popup", async () => {
  function Editor() {
    const { getComboboxProps, getInputProps, menu } =
      useDataTokenSuggestionsMenu({ category: "string", queryText: "" });
    return (
      <>
        <div {...getComboboxProps()}>
          <input {...getInputProps({ "aria-label": "Value" })} />
        </div>
        {menu}
      </>
    );
  }
  render(<Editor />);
  expect(document.querySelectorAll("[data-overlayscrollbars]")).toHaveLength(0);
  fireEvent.focus(screen.getByRole("textbox", { name: "Value" }));
  await waitFor(() =>
    expect(screen.getByRole("option", { name: "Available" }).isConnected).toBe(
      true,
    ),
  );
  expect(document.querySelectorAll("[data-overlayscrollbars]")).toHaveLength(1);
  fireEvent.click(screen.getByRole("option", { name: "Available" }));
  expect(select).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(document.querySelectorAll("[data-overlayscrollbars]")).toHaveLength(
      0,
    ),
  );
});
