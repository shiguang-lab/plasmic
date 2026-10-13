import HostUrlInput from "@/wab/client/components/HostUrlInput";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (message: string) => message }),
}));
vi.mock("@/wab/client/i18n/UiText", () => ({
  UiText: ({ message }: { message: string }) => <>{message}</>,
}));
afterEach(cleanup);

it("shows validation only for invalid input and clears it immediately after correction", () => {
  const confirm = vi.fn();
  render(<HostUrlInput onConfirm={confirm} />);
  const input = screen.getByRole("textbox");
  const button = screen.getByRole("button", { name: "Confirm" });
  expect(screen.queryByText("Please enter a valid URL.")).toBeNull();
  expect(button).toBeDisabled();
  fireEvent.change(input, { target: { value: "https:///" } });
  expect(screen.getByText("Please enter a valid URL.")).toBeInTheDocument();
  expect(button).toBeDisabled();
  fireEvent.change(input, {
    target: { value: "https://canvas.example.test/plasmic-host" },
  });
  expect(screen.queryByText("Please enter a valid URL.")).toBeNull();
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(confirm).toHaveBeenCalledWith(
    "https://canvas.example.test/plasmic-host",
    expect.any(URL),
  );
  fireEvent.change(input, { target: { value: "" } });
  expect(button).toBeDisabled();
  expect(screen.queryByText("Please enter a valid URL.")).toBeNull();
});

it("retains expected-origin validation and normalizes schemeless input on blur", () => {
  const confirm = vi.fn();
  render(
    <HostUrlInput
      originOnly
      expectedOrigin="https://canvas.example.test"
      onConfirm={confirm}
    />,
  );
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "https://other.example.test/" } });
  expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  fireEvent.change(input, { target: { value: "canvas.example.test" } });
  fireEvent.blur(input);
  expect(input).toHaveValue("https://canvas.example.test/");
  expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
  expect(confirm).not.toHaveBeenCalled();
});
