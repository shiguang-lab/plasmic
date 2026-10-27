import { showError } from "@/wab/client/ErrorNotifications";
import type { AppCtx } from "@/wab/client/app-ctx";
import BillingForm from "@/wab/client/components/modals/BillingForm";
import { setLanguagePreference } from "@/wab/client/i18n";
import type { ApiFeatureTier, ApiTeam } from "@/wab/shared/ApiSchema";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), confirm: vi.fn(), update: vi.fn(), submit: vi.fn(),
}));
vi.mock("@/wab/client/ErrorNotifications", () => ({ showError: vi.fn() }));
vi.mock("@/wab/client/cli-routes", () => ({ isHostFrame: () => false }));
vi.mock("@/wab/client/components/modals/PricingModal", () => ({ canIEditTeam: () => true }));
vi.mock("@stripe/react-stripe-js", () => ({
  CardNumberElement: () => null,
  useStripe: () => ({ confirmCardSetup: mocks.confirm }),
  useElements: () => ({ getElement: () => ({}) }),
}));
vi.mock("@/wab/client/components/modals/UpsellCheckout", () => ({
  default: ({ disabled, onSubmit }) => <button disabled={disabled} onClick={onSubmit}>Submit payment</button>,
}));
vi.mock("@/wab/client/components/pricing/PriceTierPicker", () => ({ default: () => null }));

beforeEach(async () => {
  vi.clearAllMocks();
  await setLanguagePreference("en");
  mocks.create.mockResolvedValue({ type: "success", clientSecret: "fixture-secret" });
  mocks.update.mockResolvedValue(undefined);
});
afterEach(cleanup);

async function openForm() {
  const team = mock<ApiTeam>({ seats: 1, billingFrequency: "month", featureTierId: null, stripeSubscriptionId: null });
  const tier = mock<ApiFeatureTier>({ maxUsers: 10, minUsers: 1 });
  const appCtx = mock<AppCtx>({ api: mock<AppCtx["api"]>({
    createSubscription: mocks.create,
    updatePaymentMethod: mocks.update,
    getTeamMeta: vi.fn().mockResolvedValue({ meta: { memberCount: 1 } }),
  }) });
  const view = render(<BillingForm appCtx={appCtx} title="Payment" availableTiers={[tier]}
    target={{ team, initialTier: tier }} onSubmit={mocks.submit} onCancel={vi.fn()} />);
  const button = screen.getByRole("button", { name: "Submit payment" });
  await waitFor(() => expect(button).toBeEnabled());
  return { ...view, team, tier, button };
}

it("reports a declined payment with the shared error message and allows another attempt", async () => {
  const error = { code: "card_declined", message: "Card declined" };
  mocks.confirm.mockResolvedValueOnce({ error }).mockResolvedValueOnce({
    setupIntent: { status: "succeeded", payment_method: "pm_fixture" },
  });
  const { button, container, team, tier } = await openForm();
  fireEvent.click(button);
  await waitFor(() => expect(showError).toHaveBeenCalledExactlyOnceWith(error, { title: "Failed to update billing" }));
  expect(container.querySelector(".ant-alert")).toBeNull();
  expect(mocks.submit).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith({ type: "success", team, tier }));
  expect(mocks.update).toHaveBeenCalledWith(team.id, "pm_fixture");
});

it("reports a rejected subscription request once and releases the pending form", async () => {
  const error = new Error("Offline");
  mocks.create.mockRejectedValueOnce(error);
  const { button, container } = await openForm();
  fireEvent.click(button);
  await waitFor(() => expect(showError).toHaveBeenCalledExactlyOnceWith(error, { title: "Failed to update billing" }));
  expect(button).toBeEnabled();
  expect(container.querySelector(".ant-alert")).toBeNull();
  expect(mocks.submit).not.toHaveBeenCalled();
});
