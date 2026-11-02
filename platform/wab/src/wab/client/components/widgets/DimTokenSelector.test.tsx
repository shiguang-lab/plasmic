import { DimTokenSpinner } from "@/wab/client/components/widgets/DimTokenSelector";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

vi.mock(
  "@/wab/client/components/widgets/ColorPicker/client-token-resolver",
  () => ({
    useClientTokenResolver: () => (token: { value: string }) => token.value,
  }),
);

afterEach(cleanup);

it("mounts one shared scrolling viewport only while the options are open", async () => {
  const changed = vi.fn();
  render(
    <DimTokenSpinner
      allowFunctions={false}
      value="10px"
      onChange={changed}
      allowedUnits={["px"]}
      extraOptions={["auto"]}
    />,
  );
  expect(document.querySelectorAll("[data-overlayscrollbars]")).toHaveLength(0);
  const input = screen.getByRole("textbox");
  fireEvent.click(input);
  await waitFor(() =>
    expect(screen.getByRole("listbox").hasAttribute("hidden")).toBe(false),
  );
  expect(document.querySelectorAll("[data-overlayscrollbars]")).toHaveLength(1);
  fireEvent.click(screen.getByRole("option", { name: "auto" }));
  expect(changed).toHaveBeenCalledWith("auto", "selected");
  await waitFor(() =>
    expect(document.querySelectorAll("[data-overlayscrollbars]")).toHaveLength(
      0,
    ),
  );
  fireEvent.click(input);
  await waitFor(() =>
    expect(screen.getByRole("listbox").hasAttribute("hidden")).toBe(false),
  );
  fireEvent.keyDown(input, { key: "Escape" });
  await waitFor(() =>
    expect(document.querySelectorAll("[data-overlayscrollbars]")).toHaveLength(
      0,
    ),
  );
});
