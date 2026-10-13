import type { ApiTeam } from "@/wab/shared/ApiSchema";
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  vi.resetModules();
});

it("keeps cloud entitlements unchanged", async () => {
  vi.stubEnv("PLASMIC_SELF_HOSTED", "0");
  const { getEffectiveFeatureTier } =
    await import("@/wab/shared/billing/feature-tier");
  const { canUseChatCopilot } =
    await import("@/wab/shared/billing/billing-util");
  const { DEVFLAGS } = await import("@/wab/shared/devflags");
  expect(getEffectiveFeatureTier(DEVFLAGS.freeTier)).toBe(DEVFLAGS.freeTier);
  expect(canUseChatCopilot("user@example.com", undefined, DEVFLAGS)).toBe(
    false,
  );
});

it("unlocks every subscription capability without persisting a tier or trial", async () => {
  vi.stubEnv("PLASMIC_SELF_HOSTED", "1");
  const { getEffectiveFeatureTier } =
    await import("@/wab/shared/billing/feature-tier");
  const { canUseChatCopilot, getSubscriptionStatus } =
    await import("@/wab/shared/billing/billing-util");
  const { DEVFLAGS } = await import("@/wab/shared/devflags");
  const source = {
    ...DEVFLAGS.freeTier,
    maxUsers: 3,
    maxPrivateUsers: 10,
    maxPublicUsers: 10000,
    versionHistoryDays: 14,
    designerRole: false,
    contentRole: false,
    editContentCreatorMode: false,
    splitContent: false,
    localization: false,
    analytics: false,
  };
  const before = structuredClone(source);
  const tier = getEffectiveFeatureTier(source);
  expect(tier).toMatchObject({
    designerRole: true,
    contentRole: true,
    editContentCreatorMode: true,
    splitContent: true,
    localization: true,
    analytics: true,
    maxUsers: null,
    maxWorkspaces: null,
    maxPrivateUsers: null,
    maxPublicUsers: null,
    versionHistoryDays: null,
    monthlySeatPrice: 0,
    annualSeatPrice: 0,
  });
  expect(JSON.parse(JSON.stringify(tier)).monthlyViews).toBe(
    Number.MAX_SAFE_INTEGER,
  );
  expect(source).toEqual(before);
  expect(canUseChatCopilot("user@example.com", undefined, DEVFLAGS)).toBe(true);
  const team = { featureTier: source, stripeSubscriptionId: null } as ApiTeam;
  expect(getSubscriptionStatus(team)).toEqual({ type: "valid", tier });
  expect(team.featureTier).toBe(source);
});
