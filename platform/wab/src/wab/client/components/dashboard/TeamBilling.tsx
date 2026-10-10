import { AppCtx } from "@/wab/client/app-ctx";
import FreeTrial from "@/wab/client/components/FreeTrial";
import {
  promptBilling,
  showUpsellConfirm,
} from "@/wab/client/components/modals/PricingModal";
import { promptUpdateCc } from "@/wab/client/components/modals/UpdateCreditCardModal";
import PriceTierPicker from "@/wab/client/components/pricing/PriceTierPicker";
import {
  reactConfirm,
  reactHardConfirm,
  reactPrompt,
} from "@/wab/client/components/quick-modals";
import { useI18n } from "@/wab/client/i18n";
import { DefaultTeamBillingProps } from "@/wab/client/plasmic/plasmic_kit_dashboard/PlasmicTeamBilling";
import tierCss from "@/wab/client/plasmic/plasmic_kit_pricing/PlasmicPriceTier.module.css";
import pickerCss from "@/wab/client/plasmic/plasmic_kit_pricing/PlasmicPriceTierPicker.module.css";
import {
  ApiFeatureTier,
  ApiTeam,
  BillingFrequency,
  Subscription,
  TeamMember,
} from "@/wab/shared/ApiSchema";
import {
  calculateBill,
  getSubscriptionStatus,
} from "@/wab/shared/billing/billing-util";
import { ensure } from "@/wab/shared/common";
import { isAdminTeamEmail } from "@/wab/shared/devflag-utils";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { isUpgradableTier } from "@/wab/shared/pricing/pricing-utils";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Flex,
  Form,
  Input,
  Segmented,
  Typography,
} from "antd";
import { createStyles } from "antd-style";
import * as React from "react";

interface TeamBillingProps extends DefaultTeamBillingProps {
  appCtx: AppCtx;
  team: ApiTeam;
  members: TeamMember[];
  availFeatureTiers: ApiFeatureTier[];
  subscription?: Subscription;
  canStartFreeTrial: boolean;
  onChange: () => Promise<void>;
  disabled?: boolean;
}

const useBillingStyles = createStyles(({ token }) => ({
  root: {
    padding: 24,
    color: token.colorText,
    background: token.colorBgContainer,
    minWidth: 0,
  },
  preferences: { maxWidth: 560 },
  plans: {
    [`& .${pickerCss.freeBox__uhZsz}`]: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
      overflow: "visible",
      paddingRight: 0,
    },
    [`& .${tierCss.root}`]: { minWidth: 0, maxWidth: "100%", width: "100%" },
  },
}));

function TeamBilling_(props: TeamBillingProps, ref: HTMLElementRefOf<"div">) {
  const {
    appCtx,
    team,
    members,
    availFeatureTiers,
    subscription,
    canStartFreeTrial,
    onChange,
    disabled,
    ...rest
  } = props;
  const { t } = useI18n();
  const { styles, cx } = useBillingStyles();
  const [form] = Form.useForm<{ billingEmail: string }>();
  const [operation, setOperation] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [savedEmail, setSavedEmail] = React.useState(false);
  React.useEffect(() => {
    form.setFieldsValue({ billingEmail: team.billingEmail ?? "" });
    setSavedEmail(false);
  }, [form, team.id, team.billingEmail]);
  const run = async (name: string, action: () => Promise<void>) => {
    setOperation(name);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t("Failed to update billing"),
      );
    } finally {
      setOperation(null);
    }
  };
  const [billingFreq, setBillingFreq] = React.useState<BillingFrequency>(
    team.billingFrequency ?? "year",
  );

  // Figure out the current plan we're on
  const subStatus = getSubscriptionStatus(team, subscription);

  const billingError =
    subStatus.type === "invalid" ? subStatus.errorMsg : undefined;

  const currentBill = React.useMemo(() => {
    if (!team.featureTier || !team.seats || !team.billingFrequency) {
      return null;
    }

    const bill = calculateBill(
      team.featureTier,
      team.seats,
      team.billingFrequency,
    );
    return team.billingFrequency === "year"
      ? t("{amount}/year", { amount: `$${bill.total}` })
      : t("{amount}/month", { amount: `$${bill.total}` });
  }, [team.featureTier, team.seats, team.billingFrequency, t]);

  const seatsUsed = members.filter(
    (m) => !isAdminTeamEmail(m.email, DEVFLAGS),
  ).length;

  const upsell = async (tier: ApiFeatureTier, title?: string) => {
    const { tiers } = await appCtx.api.listCurrentFeatureTiers();

    // Load the upsell modal to handle either an upgrade/downgrade or new subscription
    const promptResult = await promptBilling({
      appCtx,
      title: title ?? t("Switch to {plan}", { plan: tier.name }),
      target: {
        team,
        initialTier: tier,
        initialBillingFreq: billingFreq,
      },
      availableTiers: tiers,
      // This means we already have an active paid subscription
      // hideCC: subStatus?.type === "valid" && !subStatus?.free,
    });

    if (!promptResult) {
      // User canceled
      return;
    } else if (promptResult.type === "fail") {
      // Show errors
      await onChange();
      throw new Error(promptResult.errorMsg);
    } else if (promptResult.type === "success") {
      await showUpsellConfirm(APP_ROUTES.orgSettings.fill({ teamId: team.id }));
    }

    // Refresh the latest team data
    await onChange();
  };

  const updateCreditCard = async () => {
    // Load the upsell modal to handle either an upgrade/downgrade or new subscription
    const promptResult = await promptUpdateCc({
      appCtx,
      title: t("Update payment method"),
      team,
    });

    if (!promptResult) {
      // User canceled
      return;
    } else if (promptResult.type === "fail") {
      // Show errors
      await onChange();
      throw new Error(promptResult.errorMsg);
    } else if (promptResult.type === "success") {
      // TODO: custom confirm, currently using same as for upsell
      await showUpsellConfirm(APP_ROUTES.orgSettings.fill({ teamId: team.id }));
    }

    // Refresh the latest team data
    await onChange();
  };

  const startFreeTrial = async () => {
    await appCtx.api.startFreeTrial(team.id);
    await onChange();
  };

  const manageSeats = async () => {
    const tier = ensure(
      team.featureTier,
      "Feature tier should exist to change seats",
    );
    await upsell(tier, t("Change seat count"));
  };

  const cancelSubscription = async () => {
    if (team.featureTier && !isUpgradableTier(team.featureTier)) {
      const confirmed = await reactConfirm({
        title: t("Cancel your Plasmic plan"),
        message: t(
          "Contact our team to discuss cancelling your plan. Confirm to schedule an appointment.",
        ),
      });
      if (confirmed) {
        window.open("https://zcal.co/jason-plasmic/cancel", "_blank");
      }
      return;
    }
    const reason = await reactPrompt({
      message: t("Why are you cancelling your plan?"),
      rules: [{ required: true }],
      placeholder: t("Tell us what we could improve"),
    });
    if (!reason) {
      return;
    }
    const confirmed = await reactHardConfirm({
      title: t("Cancel your Plasmic plan"),
      message: t("To cancel your plan, type 'cancel' into the textbox"),
      mustType: "cancel",
    });
    if (!confirmed) {
      return;
    }
    await appCtx.api.cancelSubscription(team.id, { reason });
    await onChange();
  };
  const isFree = subStatus.type === "valid" && (subStatus.free || team.onTrial);
  const isEnterprise =
    subStatus.type === "valid" && subStatus.tier.name.includes("Enterprise");
  const blocked = disabled || operation !== null;
  const seatsPurchased = team.seats ?? appCtx.appConfig.freeTier.maxUsers;
  return (
    <section
      ref={ref}
      className={cx(styles.root, rest.className)}
      aria-busy={operation !== null}
    >
      <Flex vertical gap={24}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t("Billing")}
        </Typography.Title>
        {billingError && (
          <Alert
            type="error"
            showIcon
            title={t("Payment requires attention")}
            description={billingError}
          />
        )}
        {actionError && (
          <Alert
            type="error"
            showIcon
            title={t("Failed to update billing")}
            description={actionError}
          />
        )}
        {operation && (
          <Typography.Text role="status">
            {t("Updating billing…")}
          </Typography.Text>
        )}
        <Card>
          <Descriptions
            title={t("Current plan")}
            column={{ xs: 1, sm: 2, lg: 3 }}
            items={[
              {
                key: "plan",
                label: t("Plan"),
                children: (subStatus.type === "valid"
                  ? subStatus.tier
                  : subStatus.freeTier
                ).name,
              },
              ...(!isFree && !isEnterprise && currentBill
                ? [
                    {
                      key: "bill",
                      label: t("Recurring bill"),
                      children: currentBill,
                    },
                  ]
                : []),
              {
                key: "seats",
                label: t("Current usage"),
                children:
                  seatsPurchased === null
                    ? t("{used} seats used", { used: seatsUsed })
                    : t("{used} of {purchased} seats used", {
                        used: seatsUsed,
                        purchased: seatsPurchased,
                      }),
              },
            ]}
          />
          {isFree && <FreeTrial team={team} accountSection />}
        </Card>
        <Flex align="center" gap={12} wrap>
          <Typography.Text>{t("Billing frequency")}</Typography.Text>
          <Segmented<BillingFrequency>
            aria-label={t("Billing frequency")}
            value={billingFreq}
            disabled={
              blocked || !(subStatus.type === "valid" && subStatus.free)
            }
            onChange={setBillingFreq}
            options={[
              { value: "month", label: t("Monthly") },
              { value: "year", label: t("Yearly") },
            ]}
          />
          <Button
            type="link"
            href="https://www.plasmic.app/pricing"
            target="_blank"
          >
            {t("Learn more.")}
          </Button>
        </Flex>
        <PriceTierPicker
          className={styles.plans}
          appCtx={appCtx}
          disabled={blocked || !!billingError}
          billingFrequency={billingFreq}
          availableTiers={availFeatureTiers}
          currentFeatureTier={
            subStatus.type === "valid" ? subStatus.tier : subStatus.freeTier
          }
          canStartFreeTrial={canStartFreeTrial}
          isFreeTrialTeam={team.onTrial}
          onSelectFeatureTier={(tier) => run("plan", () => upsell(tier))}
          onManageSeats={
            subStatus.type === "valid" &&
            !subStatus.free &&
            !team.onTrial &&
            !!team.stripeSubscriptionId
              ? () => run("seats", manageSeats)
              : undefined
          }
          onStartFreeTrial={() => run("trial", startFreeTrial)}
        />
        {!isFree && (
          <Card title={t("Preferences")}>
            <Form
              form={form}
              className={styles.preferences}
              layout="vertical"
              disabled={blocked}
              onValuesChange={() => setSavedEmail(false)}
              onFinish={(values) => {
                void run("email", async () => {
                  await appCtx.api.updateTeam(team.id, {
                    billingEmail: values.billingEmail,
                  });
                  setSavedEmail(true);
                  await onChange();
                });
              }}
            >
              <Form.Item
                name="billingEmail"
                label={t("Billing email")}
                rules={[
                  {
                    required: true,
                    type: "email",
                    message: t("Enter a valid billing email"),
                  },
                ]}
              >
                <Input type="email" />
              </Form.Item>
              <Form.Item>
                <Button
                  htmlType="submit"
                  type="primary"
                  loading={operation === "email"}
                >
                  {t("Save")}
                </Button>
              </Form.Item>
              {savedEmail && (
                <Alert
                  type="success"
                  showIcon
                  title={t("Billing email saved")}
                />
              )}
            </Form>
            <Flex gap={12} wrap>
              {!isEnterprise && (
                <Button
                  disabled={blocked}
                  loading={operation === "payment"}
                  onClick={() => {
                    void run("payment", updateCreditCard);
                  }}
                >
                  {t("Update payment method")}
                </Button>
              )}
              {!isEnterprise && team.stripeCustomerId && (
                <Button
                  disabled={blocked}
                  href={APP_ROUTES.orgBilling.fill({ teamId: team.id })}
                  target="_blank"
                >
                  {t("Manage billing")}
                </Button>
              )}
              <Button
                danger
                disabled={blocked}
                loading={operation === "cancel"}
                onClick={() => {
                  void run("cancel", cancelSubscription);
                }}
              >
                {t("Cancel subscription")}
              </Button>
            </Flex>
          </Card>
        )}
      </Flex>
    </section>
  );
}

const TeamBilling = React.forwardRef(TeamBilling_);
export default TeamBilling;
