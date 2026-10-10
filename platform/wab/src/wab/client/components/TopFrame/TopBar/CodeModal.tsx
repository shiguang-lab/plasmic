/** @format */

import CodeQuickstartDisplay from "@/wab/client/components/studio/code-quickstart/CodeQuickstartDisplay";
import {
  DeliveryModal,
  DeliveryNavigationProps,
} from "@/wab/client/components/TopFrame/TopBar/DeliveryModal";
import { ApiProject } from "@/wab/shared/ApiSchema";
import { observer } from "mobx-react";
import * as React from "react";

interface CodeModalProps extends DeliveryNavigationProps {
  project: ApiProject;
  noComponents: boolean;
  subjectComponentInfo:
    | {
        pathOrComponent: string;
        componentName: string;
      }
    | undefined;
  showCodeModal: boolean;
  setShowCodeModal: (val: boolean) => Promise<void>;
}

export const CodeModal = observer(function CodeModal({
  project,
  noComponents,
  subjectComponentInfo,
  showCodeModal,
  setShowCodeModal,
  onSelectDelivery,
}: CodeModalProps) {
  return (
    <>
      {showCodeModal && (
        <DeliveryModal
          tab="code"
          open
          onSelectDelivery={onSelectDelivery}
          onClose={() => {
            void setShowCodeModal(false);
          }}
        >
          <CodeQuickstartDisplay
            project={project}
            noComponents={noComponents}
            subjectComponentInfo={subjectComponentInfo}
          />
        </DeliveryModal>
      )}
    </>
  );
});

export default CodeModal;
