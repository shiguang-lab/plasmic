import { AppCtx } from "@/wab/client/app-ctx";
import TeamBilling from "@/wab/client/components/dashboard/TeamBilling";
import PriceTierPicker from "@/wab/client/components/pricing/PriceTierPicker";
import { ApiFeatureTier, ApiTeam, Subscription } from "@/wab/shared/ApiSchema";
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

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  cancel: vi.fn(),
  tiers: vi.fn(),
  trial: vi.fn(),
  reload: vi.fn(),
  billing: vi.fn(),
  payment: vi.fn(),
  confirm: vi.fn(),
  reason: vi.fn(),
  hardConfirm: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({
    t: (s: string, values?: Record<string, string | number>) =>
      s.replace(/\{(\w+)\}/g, (_, key) => String(values?.[key] ?? key)),
  }),
}));
vi.mock("@/wab/client/components/modals/PricingModal", () => ({
  promptBilling: mocks.billing,
  showUpsellConfirm: mocks.success,
}));
vi.mock("@/wab/client/components/modals/UpdateCreditCardModal", () => ({
  promptUpdateCc: mocks.payment,
}));
vi.mock("@/wab/client/components/quick-modals", () => ({
  reactConfirm: mocks.confirm,
  reactPrompt: mocks.reason,
  reactHardConfirm: mocks.hardConfirm,
}));
vi.mock("@/wab/client/components/FreeTrial", () => ({ default: () => null }));
vi.mock("@/wab/client/components/pricing/PriceTierPicker", () => ({
  default: (props: React.ComponentProps<typeof PriceTierPicker>) => (
    <>
      <button
        disabled={props.disabled}
        onClick={() => props.onSelectFeatureTier(DEVFLAGS.freeTier)}
      >
        Choose plan
      </button>
      {props.onManageSeats && (
        <button disabled={props.disabled} onClick={props.onManageSeats}>
          Manage seats
        </button>
      )}
      <button disabled={props.disabled} onClick={props.onStartFreeTrial}>
        Start trial
      </button>
    </>
  ),
}));
const paidTier: ApiFeatureTier = {
  ...DEVFLAGS.freeTier,
  id: "paid-test" as ApiFeatureTier["id"],
  name: "Pro",
  monthlyBasePrice: 100,
  annualBasePrice: 1000,
};
const team = {
  id: "team1",
  name: "Test team",
  billingEmail: "billing@example.com",
  billingFrequency: "month",
  seats: 5,
  featureTier: paidTier,
  stripeSubscriptionId: "sub1",
  stripeCustomerId: "customer1",
  onTrial: false,
} as ApiTeam;
const subscription: Subscription = {
  id: "sub1",
  status: "active",
  defaultPaymentMethodId: null,
};
const api: Pick<
  AppCtx["api"],
  | "updateTeam"
  | "cancelSubscription"
  | "listCurrentFeatureTiers"
  | "startFreeTrial"
> = {
  updateTeam: mocks.update,
  cancelSubscription: mocks.cancel,
  listCurrentFeatureTiers: mocks.tiers,
  startFreeTrial: mocks.trial,
};
const appCtx = {
  api,
  appConfig: DEVFLAGS,
} as AppCtx;
function show(extra: Partial<React.ComponentProps<typeof TeamBilling>> = {}) {
  return render(
    <TeamBilling
      appCtx={appCtx}
      team={team}
      subscription={subscription}
      members={[]}
      availFeatureTiers={[paidTier]}
      canStartFreeTrial={false}
      onChange={mocks.reload}
      {...extra}
    />,
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("validates billing email, preserves failed input, and saves through the actual team callback", async () => {
  mocks.update
    .mockRejectedValueOnce(new Error("Server unavailable"))
    .mockResolvedValueOnce(undefined);
  show();
  const email = screen.getByLabelText("Billing email");
  fireEvent.change(email, { target: { value: "invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Enter a valid billing email");
  expect(mocks.update).not.toHaveBeenCalled();
  fireEvent.change(email, { target: { value: "new@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Failed to update billing");
  expect(email).toHaveValue("new@example.com");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Billing email saved");
  expect(mocks.update).toHaveBeenLastCalledWith("team1", {
    billingEmail: "new@example.com",
  });
  expect(mocks.reload).toHaveBeenCalledTimes(1);
});

it("keeps paid billing frequency fixed and uses the current tier for seat management", async () => {
  mocks.tiers.mockResolvedValue({ tiers: [paidTier] });
  mocks.billing.mockResolvedValue(undefined);
  show();
  expect(screen.getByRole("radio", { name: "Yearly" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Manage seats" }));
  await waitFor(() =>
    expect(mocks.billing).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { team, initialTier: paidTier, initialBillingFreq: "month" },
      }),
    ),
  );
  expect(mocks.reload).not.toHaveBeenCalled();
});

it("requires the cancellation reason and hard confirmation before calling the cancellation API", async () => {
  mocks.reason
    .mockResolvedValueOnce("No longer needed")
    .mockResolvedValueOnce("No longer needed");
  mocks.hardConfirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  show();
  fireEvent.click(screen.getByRole("button", { name: "Cancel subscription" }));
  await waitFor(() => expect(mocks.hardConfirm).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Cancel subscription" }),
    ).toBeEnabled(),
  );
  expect(mocks.cancel).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel subscription" }));
  await waitFor(() =>
    expect(mocks.cancel).toHaveBeenCalledWith("team1", {
      reason: "No longer needed",
    }),
  );
  expect(mocks.hardConfirm).toHaveBeenLastCalledWith(
    expect.objectContaining({ mustType: "cancel" }),
  );
  expect(mocks.reload).toHaveBeenCalledTimes(1);
});

it("shows payment failures and prevents edits while the payment dialog is running", async () => {
  let finish: (result: { type: "fail"; errorMsg: string }) => void = () => {};
  mocks.payment.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  show();
  fireEvent.click(
    screen.getByRole("button", { name: "Update payment method" }),
  );
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Updating billing…");
  finish({ type: "fail", errorMsg: "Card declined" });
  await screen.findByText("Card declined");
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  expect(mocks.reload).toHaveBeenCalledTimes(1);
});

it("disables all modifying controls for read-only members", () => {
  show({ disabled: true });
  for (const name of [
    "Save",
    "Manage seats",
    "Choose plan",
    "Update payment method",
    "Cancel subscription",
  ]) {
    expect(screen.getByRole("button", { name })).toBeDisabled();
  }
  expect(screen.getByLabelText("Billing email")).toBeDisabled();
});
