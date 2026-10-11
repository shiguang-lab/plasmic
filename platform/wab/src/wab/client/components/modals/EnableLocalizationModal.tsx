import { AppCtx } from "@/wab/client/app-ctx";
import {
  promptBilling,
  showUpsellConfirm,
} from "@/wab/client/components/modals/PricingModal";
import Button from "@/wab/client/components/widgets/Button";
import { Modal } from "@/wab/client/components/widgets/Modal";
import Select from "@/wab/client/components/widgets/Select";
import Textbox from "@/wab/client/components/widgets/Textbox";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useTopFrameCtx } from "@/wab/client/frame-ctx/top-frame-ctx";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate, translateUiLabel } from "@/wab/client/i18n/locales";
import { ApiProject } from "@/wab/shared/ApiSchema";
import { ORGANIZATION_LOWER } from "@/wab/shared/Labels";
import { LocalizationConfig } from "@/wab/shared/localization";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { Form, notification } from "antd";
import { observer } from "mobx-react";
import React from "react";
import { FocusScope } from "react-aria";

export interface EnableLocalizationModalProps {
  onDone: () => void;
  isLocalizationEnabled: boolean;
  localizationScheme?: LocalizationConfig;
  project: ApiProject;
}

export const EnableLocalizationModal = observer(
  function EnableLocalizationModal({
    isLocalizationEnabled,
    localizationScheme,
    project,
    onDone,
  }: EnableLocalizationModalProps) {
    const { t: uiT } = useI18n();
    const appCtx = useAppCtx();
    const { hostFrameApi } = useTopFrameCtx();

    return (
      <Modal
        title={uiT(
          isLocalizationEnabled
            ? "Disable localization for this project?"
            : "Enable localization for this project?",
        )}
        open
        onCancel={() => onDone()}
        footer={null}
      >
        <FocusScope contain>
          <div className="mb-xlg">
            <UiText
              message={
                "This lets you integrate with localization frameworks like Lingui, react-intl, and react-i18next by generating code that applies the localization framework to all localizable strings in the project. {part1} {part2}{part3}"
              }
              values={{
                part1: <br />,
                part2: <br />,
                part3: (
                  <a
                    href="https://docs.plasmic.app/learn/localization-frameworks/"
                    target="_blank"
                  >
                    <UiText
                      message={"Learn about use with localization frameworks."}
                    />
                  </a>
                ),
              }}
            />
          </div>
          <Form
            onFinish={async (e) => {
              if (
                isLocalizationEnabled ||
                (await canEnableLocalization(appCtx, project))
              ) {
                await hostFrameApi.updateLocalizationProjectFlags(
                  !isLocalizationEnabled,
                  e.keyScheme,
                  e.tagPrefix,
                );
              }
              onDone();
            }}
          >
            {!isLocalizationEnabled && (
              <>
                <Form.Item label={uiT("Key scheme")} name="keyScheme">
                  <Select
                    defaultValue={localizationScheme?.keyScheme}
                    placeholder={uiT(
                      "Set the key scheme to be used in preview",
                    )}
                    type="bordered"
                  >
                    <Select.Option value="path">
                      <UiText message={"Path"} />
                    </Select.Option>
                    <Select.Option value="content">
                      <UiText message={"Content"} />
                    </Select.Option>
                    <Select.Option value="hash">
                      <UiText message={"Hash"} />
                    </Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item label={uiT("Tag prefix")} name="tagPrefix">
                  <Textbox
                    defaultValue={localizationScheme?.tagPrefix}
                    placeholder={uiT(
                      "Set the tag prefix to be used in preview",
                    )}
                    styleType={["bordered"]}
                  />
                </Form.Item>
              </>
            )}
            <Form.Item>
              <Button
                htmlType="submit"
                className="mr-sm"
                type="primary"
                autoFocus
              >
                <UiText message={"Confirm"} />
              </Button>
              <Button onClick={() => onDone()}>
                <UiText message={"Cancel"} />
              </Button>
            </Form.Item>
          </Form>
        </FocusScope>
      </Modal>
    );
  },
);

async function canEnableLocalization(appCtx: AppCtx, project: ApiProject) {
  const projectTeam = appCtx.teams.find((team) => team.id === project.teamId);
  if (!projectTeam) {
    notification.error({
      message: translate(getUiLocale(), "This action requires an {part1}", {
        part1: translateUiLabel(getUiLocale(), ORGANIZATION_LOWER),
      }),
    });
    return false;
  }
  if (projectTeam.featureTier?.localization) {
    return true;
  }

  const tiers = (await appCtx.api.listCurrentFeatureTiers()).tiers;
  const promptResult = await promptBilling({
    appCtx,
    availableTiers: tiers.filter((tier) => tier.localization),
    target: {
      team: projectTeam,
      initialTier: tiers.find((tier) => tier.id === projectTeam.featureTierId),
    },
    title: translate(getUiLocale(), "Upgrade to perform this action"),
    description: translate(getUiLocale(), "Select a new plan to upgrade."),
  });
  if (!promptResult) {
    // User canceled
    return false;
  } else if (promptResult.type === "fail") {
    // Show errors
    notification.warning({
      message: translate(
        getUiLocale(),
        "Issue with payment, please try again.",
      ),
      description: promptResult.errorMsg,
    });
    return false;
  }

  await showUpsellConfirm(
    APP_ROUTES.orgSettings.fill({ teamId: projectTeam.id }),
  );
  return true;
}
