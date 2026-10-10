import PriceTier from "@/wab/client/components/pricing/PriceTier";
import { ApiFeatureTier } from "@/wab/shared/ApiSchema";
import { DEVFLAGS } from "@/wab/shared/devflags";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (s: string) => s }),
}));
const tier: ApiFeatureTier = {
  ...DEVFLAGS.freeTier,
  name: "Pro",
  monthlyBasePrice: 100,
};
afterEach(cleanup);
it("locks the native plan button until its actual callback finishes", async () => {
  let finish: () => void = () => {};
  const select = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(<PriceTier featureTier={tier} status="upgrade" onClick={select} />);
  const button = screen.getByRole("button", { name: "Select plan" });
  fireEvent.click(button);
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(select).toHaveBeenCalledTimes(1);
  finish();
  await waitFor(() => expect(button).toBeEnabled());
});
it("keeps the current plan non-interactive and hides unavailable plan actions", () => {
  const select = vi.fn();
  const view = render(
    <PriceTier featureTier={tier} status="current" onClick={select} />,
  );
  const current = screen.getByRole("button", { name: "Selected" });
  expect(current).toBeDisabled();
  fireEvent.click(current);
  expect(select).not.toHaveBeenCalled();
  view.rerender(
    <PriceTier featureTier={tier} status="unavailable" onClick={select} />,
  );
  expect(screen.queryByRole("button", { name: "Select plan" })).toBeNull();
});
