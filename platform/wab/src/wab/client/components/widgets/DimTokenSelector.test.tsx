import { DimTokenSpinner } from "@/wab/client/components/widgets/DimTokenSelector";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";

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

it("keeps the public focus command and commits numeric edits, spins, and escaped drafts", () => {
  const changed = vi.fn(), inputRef = React.createRef<{ focus(): void }>();
  function Controlled() {
    const [value, setValue] = React.useState("10px");
    return <DimTokenSpinner ref={inputRef} allowFunctions={false} value={value} onChange={(next, type) => { changed(next, type); setValue(next ?? ""); }} allowedUnits={["px"]} />;
  }
  render(<Controlled />);
  const input = screen.getByRole("textbox") as HTMLInputElement;
  inputRef.current?.focus();
  expect(document.activeElement).toBe(input);
  fireEvent.change(input, { target: { value: "25" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(changed).toHaveBeenLastCalledWith("25px", "raw");
  fireEvent.keyDown(input, { key: "ArrowUp" });
  expect(changed).toHaveBeenLastCalledWith("26px", "spin");
  const count = changed.mock.calls.length;
  fireEvent.change(input, { target: { value: "99" } });
  fireEvent.keyDown(input, { key: "Escape" });
  fireEvent.blur(input);
  expect(changed).toHaveBeenCalledTimes(count);
});
