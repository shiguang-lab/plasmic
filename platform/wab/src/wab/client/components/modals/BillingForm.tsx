
import { showError } from "@/wab/client/ErrorNotifications";
import { isHostFrame } from "@/wab/client/cli-routes";
import UpsellCheckout from "@/wab/client/components/modals/UpsellCheckout";

import PriceTierPicker from "@/wab/client/components/pricing/PriceTierPicker";

import { Modal } from "@/wab/client/components/widgets/Modal";
import { useAsyncStrict } from "@/wab/client/hooks/useAsyncStrict";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { translateUiLabel } from "@/wab/client/i18n/locales";

import { ApiFeatureTier, ApiTeam, ApiTeamMeta, BillingFrequency } from "@/wab/shared/ApiSchema";

import { ORGANIZATION_LOWER } from "@/wab/shared/Labels";
import { assert, assertNever, ensure } from "@/wab/shared/common";
import { DEVFLAGS } from "@/wab/shared/devflags";


import { CardNumberElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { PaymentIntentResult, SetupIntentResult } from "@stripe/stripe-js";
import { Alert, Form } from "antd";
import * as React from "react";
import { MakeADT } from "ts-adt/MakeADT";

import { canIEditTeam } from "@/wab/client/components/modals/PricingModal";
import type { PromptBillingArgs, PromptBillingResponse } from "@/wab/client/components/modals/PricingModal";
const DEFAULT_BILLING_FREQUENCY = "year";
type ErrorMsg = MakeADT<
  "type",
  {
    none: {};
    fatal: {
      errorMsg: string;
    };
    nonfatal: {
      errorMsg: string;
    };
  }
>;

export default function UpsellForm(
  props: PromptBillingArgs & {
    onSubmit: (v: PromptBillingResponse) => void;
    onCancel: () => void;
  },
) {
  const { t: uiT } = useI18n();

  const {
    appCtx,
    title,
    description,
    target,
    availableTiers,
    allowFreeTrial = true,
    onSubmit,
    onCancel,
  } = props;

  const initErrorMsg = () =>
    isHostFrame()
      ? {
          type: "fatal" as const,
          errorMsg: `Please go to your ${ORGANIZATION_LOWER} settings page to adjust your plan.`,
        }
      : { type: "none" as const };
  const [errorMsg, setErrorMsg] = React.useState<ErrorMsg>(initErrorMsg());
  const resetErrorMsg = () => setErrorMsg(initErrorMsg());

  // The team we want to upsell
  const team = target.team;
  const [teamMeta, setTeamMeta] = React.useState<ApiTeamMeta | undefined>(
    undefined,
  );
  // The tier we want to upgrade/downgrade to
  const [tier, rawSetTier] = React.useState(target.initialTier);
  // monthly or annual billing
  const [billingFreq, setBillingFreq] = React.useState<BillingFrequency>(
    target.team.billingFrequency ??
      target.initialBillingFreq ??
      DEFAULT_BILLING_FREQUENCY,
  );
  // The total number of seats in our subscription
  const [seats, setSeats] = React.useState(
    Math.min(
      tier?.maxUsers ?? Infinity,
      Math.max(
        team.seats ?? 1,
        teamMeta?.memberCount ?? 1,
        tier?.minUsers ?? 1,
      ),
    ),
  );

  React.useEffect(() => {
    if (teamMeta && tier?.maxUsers && teamMeta.memberCount > tier.maxUsers) {
      setErrorMsg({
        type: "fatal",
        errorMsg: `Your ${ORGANIZATION_LOWER} has more members (${teamMeta.memberCount}) than available seats (${tier.maxUsers}) for this tier. Please go to your ${ORGANIZATION_LOWER} settings and select a higher plan tier.`,
      });
    }
  }, [tier, teamMeta]);

  const safeSetSeats = (newSeats: number) => {
    if (tier?.maxUsers && tier.maxUsers < newSeats) {
      setErrorMsg({
        type: "nonfatal",
        errorMsg: `If you want more seats, please go to your ${ORGANIZATION_LOWER} settings and upgrade to a higher plan tier.`,
      });
      setSeats(tier.maxUsers);
    } else if (tier?.minUsers && newSeats < tier.minUsers) {
      setErrorMsg({
        type: "nonfatal",
        errorMsg: "You've hit the minimum seat count for this tier.",
      });
      setSeats(tier.minUsers);
    } else {
      setSeats(newSeats);
    }
  };

  const setTier = (t?: ApiFeatureTier) => {
    resetErrorMsg();
    safeSetSeats(
      Math.min(t?.maxUsers ?? Infinity, Math.max(seats, t?.minUsers ?? 1)),
    );
    rawSetTier(t);
  };

  // Set when we are waiting from the server (disabling the form)
  const [waiting, setWaiting] = React.useState<boolean>(false);
  const stripe = useStripe();
  const elements = useElements();

  useAsyncStrict(async () => {
    if (teamMeta) {
      return;
    }

    setWaiting(true);
    try {
      const { meta } = await appCtx.api.getTeamMeta(target.team.id);
      setTeamMeta(meta);
    } finally {
      setWaiting(false);
    }
  }, [teamMeta, target]);

  // true if team is on a valid active subscription already
  // - Currently we don't ask for a credit card if true (using default payment method)
  // - If false, then we should ask for a new credit card
  // Note: the server will make sure this field is undefined if Stripe says the subscription is invalid
  const hasActiveSubscription =
    !!team.featureTierId && !!team.stripeSubscriptionId;

  // Prevent submitting an unchanged subscription (allow changing seats or converting trial)
  const isCurrentSubscription =
    hasActiveSubscription &&
    !team?.onTrial &&
    tier?.id === team?.featureTierId &&
    seats === team?.seats &&
    billingFreq === team?.billingFrequency;

  /**
   * Change the subscription on the server.
   * This is a terminating function. Either way the modal will be dismissed.
   * @param targetTeam
   * @param targetTier
   * @returns
   */
  const changeExistingSubscription = async (
    targetTeam: ApiTeam,
    targetTier: ApiFeatureTier,
  ) => {
    const changeResp = await appCtx.api.changeSubscription({
      teamId: targetTeam.id,
      featureTierId: targetTier.id,
      billingFrequency: billingFreq,
      seats,
    });
    switch (changeResp.type) {
      case "notFound":
        return onSubmit({
          type: "fail",
          errorMsg: `Couldn't find your subscription. Please go to your ${ORGANIZATION_LOWER} settings, cancel the subscription, and try again.`,
        });
      case "success":
        return onSubmit({
          type: "success",
          team: targetTeam,
          tier: targetTier,
        });
      default:
        return assertNever(changeResp);
    }
  };

  const startFreeTrial = async () => {
    await appCtx.api.startFreeTrial(team.id);
    await appCtx.reloadAppCtx();
    return onSubmit({
      type: "success",
      team: team,
      tier: ensure(
        availableTiers.find((t) => t.name === DEVFLAGS.freeTrialTierName),
        "Free trial tier should be one of the available",
      ),
    });
  };

  const confirmBill = async () => {
    if (isCurrentSubscription) {
      return;
    }
    setWaiting(true);
    try {
      const ensureTier = ensure(tier, "You must first select a tier");

      assert(
        !ensureTier.maxUsers || seats <= ensureTier.maxUsers,
        `Exceeded maximum seats for this tier, if you want more seats, please go to your ${ORGANIZATION_LOWER} settings and upgrade to a higher plan tier.`,
      );

      if (hasActiveSubscription) {
        return await changeExistingSubscription(team, ensureTier);
      }

      const createResp = await appCtx.api.createSubscription({
        teamId: team.id,
        featureTierId: ensureTier.id,
        billingFrequency: billingFreq,
        seats,
      });

      // Subscription already exists. Let's try to change it
      if (createResp.type === "alreadyExists") {
        return await changeExistingSubscription(team, ensureTier);
      }

      // This is a new subscription. Let's try to confirm it with the credit card.
      const { clientSecret } = createResp;
      const ensureClientSecret = ensure(
        clientSecret,
        "Missing client secret from server",
      );
      const ensureStripe = ensure(stripe, "Stripe not loaded yet");
      const ensureElements = ensure(elements, "Stripe not loaded yet");
      const card = ensure(
        ensureElements.getElement(CardNumberElement),
        "Issue getting CC info from form",
      );
      const result =
        createResp.type === "success"
          ? await ensureStripe.confirmCardSetup(ensureClientSecret, {
              payment_method: { card },
            })
          : await ensureStripe.confirmCardPayment(ensureClientSecret, {
              payment_method: { card },
            });
      if (result.error) {
        showError(result.error, { title: "Failed to update billing" });
        return;
      }
      const intent = ensure(
        createResp.type === "success"
          ? (result as SetupIntentResult).setupIntent
          : (result as PaymentIntentResult).paymentIntent,
        "intent must exist if didnt throw error",
      );
      if (intent.status !== "succeeded") {
        return onSubmit({
          type: "fail",
          errorMsg: "Unknown error processing payment. Please try again.",
        });
      }

      // Save as default payment method for all future upgrades
      const paymentMethod = intent.payment_method;
      const paymentMethodId =
        typeof paymentMethod === "string" ? paymentMethod : paymentMethod?.id;
      if (paymentMethodId) {
        await appCtx.api.updatePaymentMethod(team.id, paymentMethodId);
      }
      return onSubmit({
        type: "success",
        team,
        tier: ensureTier,
      });
    } catch (error) {
      showError(error, { title: "Failed to update billing" });
    } finally {
      setWaiting(false);
    }
  };

  const canUpdateBilling = canIEditTeam(appCtx, team);

  return (
    <Modal
      title={title}
      open={true}
      footer={null}
      onCancel={() => onCancel()}
      width={"max-content"}
    >
      <div style={{ margin: "20px 0", minWidth: "400px" }}>
        {errorMsg.type !== "none" && (
          <div style={{ margin: "0 0 20px 0" }}>
            <Alert message={errorMsg.errorMsg} type="error" />
          </div>
        )}
        {description && <p>{description}</p>}
        {errorMsg.type !== "fatal" && !tier && (
          // Haven't chosen a tier yet
          <PriceTierPicker
            // Only show tiers that support this many seats
            appCtx={appCtx}
            availableTiers={availableTiers.filter(
              (t) =>
                !t.maxUsers ||
                !teamMeta?.memberCount ||
                teamMeta.memberCount <= t.maxUsers,
            )}
            billingFrequency={billingFreq}
            showBillingFrequencyToggle={{
              disabled: hasActiveSubscription,
              onSetBillingFreq: setBillingFreq,
            }}
            currentFeatureTier={team.featureTier ?? undefined}
            disabled={!canUpdateBilling}
            onSelectFeatureTier={async (newTier: ApiFeatureTier) =>
              setTier(newTier)
            }
            onManageSeats={
              hasActiveSubscription && team.featureTier
                ? async () => setTier(ensure(team.featureTier, "Team must have a current tier to manage seats"))
                : undefined
            }
            canStartFreeTrial={allowFreeTrial && !!teamMeta?.canStartFreeTrial}
            onStartFreeTrial={startFreeTrial}
            isFreeTrialTeam={team.onTrial}
            hideLegacyTier={true}
            titleBar={{
              show: true,
              teamName: team.name,
            }}
          />
        )}
        {errorMsg.type !== "fatal" && tier && (
          // Chose a tier to upgrade/downgrade to
          <Form>
            <UpsellCheckout
              appCtx={appCtx}
              disabled={waiting || !canUpdateBilling}
              isCurrentSubscription={isCurrentSubscription}
              hasActiveSubscription={hasActiveSubscription}
              onFreeTrial={team.onTrial}
              teamName={team.name}
              currentTier={team.featureTier}
              tier={tier}
              seats={seats}
              onSetSeats={(s) => {
                if (
                  s <
                  ensure(
                    teamMeta?.memberCount,
                    "teamMeta needs to be populated",
                  )
                ) {
                  return;
                }
                safeSetSeats(s);
              }}
              // If there's a stripe secret, we need to ask for CC info
              skipCreditCard={hasActiveSubscription}
              billingFreq={billingFreq}
              onSetBillingFreq={setBillingFreq}
              // If I'm on a paid tier already, don't let me change this
              onSubmit={confirmBill}
              onCancel={onCancel}
              onResetTier={async () => setTier(undefined)}
            />
          </Form>
        )}
      </div>
      {errorMsg.type !== "fatal" && !canUpdateBilling && (
        <Alert
          message={uiT(
            "You have no permission to update billing for this {part1}. Please ask an {part2} administrator to do it.",
            {
              part1: translateUiLabel(getUiLocale(), ORGANIZATION_LOWER),
              part2: translateUiLabel(getUiLocale(), ORGANIZATION_LOWER),
            },
          )}
          type="warning"
        />
      )}
    </Modal>
  );
}
