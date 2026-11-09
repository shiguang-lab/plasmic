import PasswordStrengthBar from "@/wab/client/components/PasswordStrengthBar";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";

const rating = vi.hoisted(() => ({ rate: vi.fn() }));
vi.mock("@/wab/shared/password-strength", () => ({ ratePasswordStrength: rating.rate }));
vi.mock("@/wab/client/plasmic/plasmic_kit_user_settings/PlasmicPasswordStrengthBar", () => ({
  PlasmicPasswordStrengthBar: ({ passwordStrength }: any) => <output>{passwordStrength}</output>,
}));
beforeEach(() => { vi.useFakeTimers(); rating.rate.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("does not overwrite the latest password rating with an older response", async () => {
  const responses = new Map<string, (score: number) => void>();
  rating.rate.mockImplementation((password: string) => new Promise((resolve) => responses.set(password, resolve)));
  const view = render(<PasswordStrengthBar password="old" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  view.rerender(<PasswordStrengthBar password="current" />);
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  await act(async () => responses.get("current")?.(4));
  await act(async () => responses.get("old")?.(0));
  expect(screen.getByRole("status").textContent).toBe("_4");
});

it("cancels a queued password check when the field unmounts", async () => {
  const view = render(<PasswordStrengthBar password="retired" />);
  view.unmount();
  await vi.advanceTimersByTimeAsync(1000);
  expect(rating.rate).not.toHaveBeenCalled();
});
