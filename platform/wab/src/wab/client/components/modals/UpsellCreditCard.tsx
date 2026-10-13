import {
  DefaultUpsellCreditCardProps,
  PlasmicUpsellCreditCard,
} from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicUpsellCreditCard";
import { useStripeElementStyle } from "@/wab/client/stripe";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { CardElement } from "@stripe/react-stripe-js";
import { Spin } from "antd";
import * as React from "react";

interface UpsellCreditCardProps extends DefaultUpsellCreditCardProps {
  disabled: boolean;
  onSubmit: () => Promise<void>;
}

function UpsellCreditCard_(
  props: UpsellCreditCardProps,
  ref: HTMLElementRefOf<"div">,
) {
  const { disabled, onSubmit, ...rest } = props;
  const style = useStripeElementStyle();
  return (
    <PlasmicUpsellCreditCard
      root={{ ref }}
      {...rest}
      stripeCardElement={{
        render: () => <CardElement options={{ hidePostalCode: true, style }} />,
      }}
      submitButton={{
        disabled,
        onClick: onSubmit,
      }}
      spinnerContainer={{
        children: disabled && <Spin />,
      }}
    />
  );
}

const UpsellCreditCard = React.forwardRef(UpsellCreditCard_);
export default UpsellCreditCard;
