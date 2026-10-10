/** @format */

import { maybeShowPaywall } from "@/wab/client/components/modals/PricingModal";
import { Modal } from "@/wab/client/components/widgets/Modal";
import Textbox from "@/wab/client/components/widgets/Textbox";
import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { useTopFrameCtx } from "@/wab/client/frame-ctx/top-frame-ctx";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { ApiProject } from "@/wab/shared/ApiSchema";
import { spawn } from "@/wab/shared/common";
import { Button, Form } from "antd";
import { observer } from "mobx-react";
import * as React from "react";

interface ProjectNameModalProps {
  project: ApiProject;
  refreshProjectAndPerms: () => void;
  showProjectNameModal: boolean;
  setShowProjectNameModal: (val: boolean) => Promise<void>;
}

export const ProjectNameModal = observer(function ProjectNameModal({
  project,
  refreshProjectAndPerms,
  showProjectNameModal,
  setShowProjectNameModal,
}: ProjectNameModalProps) {
  const { t: uiT } = useI18n();
  const { hostFrameApi } = useTopFrameCtx();
  const [name, setName] = React.useState(project.name);
  const appCtx = useAppCtx();

  const onSubmit = (newName: string) => {
    if (newName && (newName !== project.name || newName !== name)) {
      setName(newName);
      spawn(
        (async () => {
          await maybeShowPaywall(appCtx, async () =>
            appCtx.api.setSiteInfo(project.id, {
              name: newName,
            }),
          );
          refreshProjectAndPerms();
          await hostFrameApi.refreshSiteInfo();
        })(),
      );
    }
    spawn(setShowProjectNameModal(false));
  };

  return (
    <>
      {showProjectNameModal && (
        <Modal
          title={null}
          open={true}
          footer={null}
          onCancel={() => setShowProjectNameModal(false)}
          closable={false}
          wrapClassName="prompt-modal"
        >
          <Form
            onFinish={(e) => {
              onSubmit(e.name);
            }}
            initialValues={{ ["name"]: name }}
            data-test-id="prompt-form"
            layout="vertical"
          >
            <Form.Item name="name" label={uiT("Enter a new project name")}>
              <Textbox
                name="name"
                placeholder={uiT("Project Name")}
                styleType={["bordered"]}
                autoFocus
                data-test-id="promptName"
              />
            </Form.Item>
            <Form.Item style={{ margin: 0 }}>
              <Button
                className="mr-sm"
                type="primary"
                htmlType="submit"
                data-test-id="prompt-submit"
              >
                {<UiText message={"Submit"} />}
              </Button>
              <Button onClick={() => setShowProjectNameModal(false)}>
                <UiText message={"Cancel"} />
              </Button>
            </Form.Item>
          </Form>
        </Modal>
      )}
    </>
  );
});

export default ProjectNameModal;
