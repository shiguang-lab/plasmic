import { showError } from "@/wab/client/ErrorNotifications";
import {
  promptBilling,
  PromptBillingArgs,
  showBillingSuccess,
} from "@/wab/client/components/modals/PricingModal";
import { spawn } from "@/wab/shared/common";

import React from "react";

export const UpsellModal = (
  props: PromptBillingArgs & {
    setShowUpsellForm: (_: undefined) => void;
  },
) => {
  const showBillingModal = async () => {
    const response = await promptBilling(props);

    if (response?.type === "success") {
      showBillingSuccess();
    } else if (response?.type === "fail") {
      showError(response.errorMsg, { title: "Failed to update billing" });
    }

    props.setShowUpsellForm(undefined);
  };
  React.useEffect(() => {
    spawn(showBillingModal());
  }, []);
  return null;
};

export default UpsellModal;
