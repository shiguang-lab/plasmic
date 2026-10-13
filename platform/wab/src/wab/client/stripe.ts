import { ENV } from "@/wab/client/env";
import type { StripeElementStyle } from "@stripe/stripe-js";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { theme } from "antd";

// Stripe fields render in isolated iframes and cannot inherit product CSS.
export function useStripeElementStyle(): StripeElementStyle {
  const { token } = theme.useToken();
  return {
    base: {
      color: token.colorText,
      fontFamily: token.fontFamily,
      fontSize: `${token.fontSize}px`,
      "::placeholder": { color: token.colorTextPlaceholder },
    },
    invalid: { color: token.colorErrorText },
  };
}

let stripePromise: Promise<Stripe | null> | undefined;
export function getStripePromise() {
  if (stripePromise) {
    return stripePromise;
  }

  if (ENV.STRIPE_PUBLISHABLE_KEY) {
    stripePromise = loadStripe(ENV.STRIPE_PUBLISHABLE_KEY);
  } else {
    stripePromise = new Promise(() => {
      console.warn("STRIPE_PUBLISHABLE_KEY missing");
    });
  }
  return stripePromise;
}
