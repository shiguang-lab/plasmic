import * as React from "react";
import { MakeADT } from "ts-adt/MakeADT";
import { AppCtx } from "@/wab/client/app-ctx";
import {
  showTemporaryInfo,
  showTemporaryPrompt,
} from "@/wab/client/components/quick-modals";
import { getUiLocale } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { ApiFeatureTier, ApiTeam, BillingFrequency, MayTriggerPaywall } from "@/wab/shared/ApiSchema";
import { accessLevelRank } from "@/wab/shared/EntUtil";
import { ORGANIZATION_LOWER } from "@/wab/shared/Labels";
import { ensure } from "@/wab/shared/common";
import { DEVFLAGS } from "@/wab/shared/devflags";
import {
  getExternalPriceTier,
  getNewPriceTierType,
  isUpgradableTier,
} from "@/wab/shared/pricing/pricing-utils";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";


export const canIEditTeam = (appCtx: AppCtx, t: ApiTeam) =>
  accessLevelRank(
    appCtx.perms.find(
      (p) =>
        p.teamId === t.id &&
        p.userId === ensure(appCtx.selfInfo, "User must be authenticated").id,
    )?.accessLevel || "blocked",
  ) >= accessLevelRank("editor");

export const canUpgradeTeam = (appCtx: AppCtx, t: ApiTeam) =>
  !t.personalTeamOwnerId &&
  canIEditTeam(appCtx, t) &&
  (isUpgradableTier(t.featureTier) || t.onTrial);

export interface PromptBillingArgs {
  appCtx: AppCtx;
  // Modal title
  title: string;
  // Top-level description
  description?: string;
  // Subset of feature tiers that are compatible with your needs
  availableTiers: ApiFeatureTier[];
  // Offer the free trial to eligible teams. Off for features a trial doesn't cover.
  allowFreeTrial?: boolean;
  target: {
    // Team to upgrade/downgrade
    team: ApiTeam;
    // The tier the user wants to upgrade/downgrade to
    // If undefined, then ask the user
    initialTier?: ApiFeatureTier;
    initialBillingFreq?: BillingFrequency;
  };
}

export type TopBarPromptBillingArgs = Omit<PromptBillingArgs, "appCtx">;

export type PromptBillingResponse = MakeADT<
  "type",
  {
    success: {
      team: ApiTeam;
      tier: ApiFeatureTier;
    };
    fail: {
      errorMsg: string;
    };
  }
>;

/**
 * Load the upsell modal to handle upgrades/downgrades to a new team plan
 */
export async function promptBilling(
  props: PromptBillingArgs,
): Promise<PromptBillingResponse | undefined> {
  const [{ default: UpsellForm }, { Elements }, { getStripePromise }] = await Promise.all([
    import("./BillingForm"),
    import("@stripe/react-stripe-js"),
    import("@/wab/client/stripe"),
  ]);
  return showTemporaryPrompt<PromptBillingResponse>((onSubmit, onCancel) => (
    <Elements stripe={getStripePromise()}>
      <UpsellForm {...props} onSubmit={onSubmit} onCancel={onCancel} />
    </Elements>
  ));
}

export type PromptTeamUpgradeOpts = Pick<
  PromptBillingArgs,
  "title" | "allowFreeTrial"
>;

/** Returns whether the team ended up on a new plan. */
export async function promptTeamUpgrade(
  appCtx: AppCtx,
  team: ApiTeam,
  opts: PromptTeamUpgradeOpts = { title: "" },
): Promise<boolean> {
  const { tiers } = await appCtx.api.listCurrentFeatureTiers();
  const billing = await promptBilling({
    appCtx,
    ...opts,
    target: {
      team,
    },
    availableTiers: tiers,
  });
  return billing?.type === "success";
}

export async function showUpsellConfirm(
  teamSettingsUrl: string,
): Promise<void> {
  const { default: UpsellConfirm } = await import("./UpsellConfirm");
  return showTemporaryInfo({
    title: translate(getUiLocale(), "Payment confirmation"),
    content: <UpsellConfirm teamSettingsUrl={teamSettingsUrl} />,
  });
}


export class PaywallError extends Error {
  constructor(
    public type: "requireTeam" | "billing",
    msg: string,
    public feature?: string,
  ) {
    super(msg);
  }
}

function getPaywallProperDescription(description: string) {
  const freeTrialName = getExternalPriceTier(
    getNewPriceTierType(DEVFLAGS.freeTrialTierName),
  );
  switch (description) {
    case "splitContentAccess":
      return `This project is using A/B testing or custom targeting. Please upgrade to a ${freeTrialName} or Enterprise plan to publish this project.`;
    case "monthlyViewLimit":
      return `This project/${ORGANIZATION_LOWER} has reached the monthly view limit. Please upgrade to a ${freeTrialName} or Enterprise plan to publish this project.`;
    default:
      return undefined;
  }
}

export async function maybeShowPaywall<T>(
  appCtx: AppCtx,
  action: () => Promise<MayTriggerPaywall<T>>,
  args: Omit<PromptBillingArgs, "appCtx" | "target" | "availableTiers"> = {
    title: translate(getUiLocale(), "Upgrade to perform this action"),
    description: translate(getUiLocale(), "Select a new plan to upgrade."),
  },
  useTopFrame = false,
): Promise<T> {
  const res = await action();
  if (res.paywall === "pass") {
    return res.response;
  }

  if (res.paywall === "requireTeam") {
    throw new PaywallError(
      "requireTeam",
      `This action requires an ${ORGANIZATION_LOWER}.`,
      res.description,
    );
  }

  const extendedDescription = getPaywallProperDescription(res.description);

  if (extendedDescription) {
    args.description = extendedDescription;
  }

  if (useTopFrame) {
    const topFrameApi = ensure(appCtx.topFrameApi, "missing topFrameApi");
    await topFrameApi.setShowUpsellForm({
      ...args,
      availableTiers: res.features,
      target: {
        team: res.team,
        initialTier:
          res.team.featureTier &&
          res.features.map((f) => f.name).includes(res.team.featureTier.name)
            ? res.team.featureTier
            : undefined,
      },
    });

    // We throw an error here since we gave the modal to the top frame
    throw new PaywallError(
      "billing",
      "Billing is required to perform this action",
    );
  }

  const billing = await promptBilling({
    appCtx,
    ...args,
    availableTiers: res.features,
    target: {
      team: res.team,
      initialTier:
        res.team.featureTier &&
        res.features.map((f) => f.name).includes(res.team.featureTier.name)
          ? res.team.featureTier
          : undefined,
    },
  });

  if (!billing) {
    throw new PaywallError(
      "billing",
      "Unable to perform action. It requires a plan upgrade.",
    );
  } else if (billing.type === "fail") {
    throw new PaywallError(
      "billing",
      billing.errorMsg ||
        "Unable to upgrade plan. Please try again or contact team@plasmic.app.",
    );
  }
  await showUpsellConfirm(
    APP_ROUTES.orgSettings.fill({ teamId: billing.team.id }),
  );

  return maybeShowPaywall(appCtx, action, args);
}
