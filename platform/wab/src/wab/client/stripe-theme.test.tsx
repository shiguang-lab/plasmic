import { AntdConfigProvider, productTheme } from "@/wab/client/antd-theme";
import UpsellCreditCard from "@/wab/client/components/modals/UpsellCreditCard";
import { setAppearancePreference } from "@/wab/client/ui-theme";
import type { StripeCardElementOptions } from "@stripe/stripe-js";
import { act, cleanup, render, screen } from "@testing-library/react";
import { theme } from "antd";
import * as React from "react";

vi.mock("@stripe/react-stripe-js", () => ({
  CardElement: ({ options }: { options: StripeCardElementOptions }) => (
    <output data-testid="stripe-options">{JSON.stringify(options)}</output>
  ),
}));

afterEach(cleanup);

it("passes updated theme colors to the isolated credit card field", () => {
  render(
    <AntdConfigProvider productUI>
      <UpsellCreditCard disabled={false} onSubmit={vi.fn()} />
    </AntdConfigProvider>,
  );
  for (const appearance of ["dark", "light"] as const) {
    act(() => setAppearancePreference(appearance));
    const token = theme.getDesignToken(productTheme(appearance));
    const options = JSON.parse(
      screen.getByTestId("stripe-options").textContent ?? "null",
    );
    expect(options.hidePostalCode).toBe(true);
    expect(options.style.base.color).toBe(token.colorText);
    expect(options.style.base["::placeholder"].color).toBe(
      token.colorTextPlaceholder,
    );
    expect(options.style.invalid.color).toBe(token.colorErrorText);
  }
});
