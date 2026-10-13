import type { ApiFeatureTier } from "@/wab/shared/ApiSchema";
import { SELF_HOSTED } from "@/wab/shared/deployment";

/** Self-hosted capabilities are computed, never persisted as a subscription. */
export function getEffectiveFeatureTier(tier: ApiFeatureTier): ApiFeatureTier {
  if (!SELF_HOSTED) {
    return tier;
  }
  return {
    ...tier,
    monthlySeatPrice: 0,
    annualSeatPrice: 0,
    monthlyBasePrice: 0,
    annualBasePrice: 0,
    minUsers: 0,
    maxUsers: null,
    privateUsersIncluded: null,
    maxPrivateUsers: null,
    publicUsersIncluded: null,
    maxPublicUsers: null,
    maxWorkspaces: null,
    versionHistoryDays: null,
    designerRole: true,
    contentRole: true,
    editContentCreatorMode: true,
    splitContent: true,
    localization: true,
    analytics: true,
    monthlyViews: Number.MAX_SAFE_INTEGER,
  };
}
