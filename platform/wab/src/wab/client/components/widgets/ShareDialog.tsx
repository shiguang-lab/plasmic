import { Modal } from "@/wab/client/components/widgets/Modal";
import ShareDialogContent, {
  ShareDialogContentProps,
} from "@/wab/client/components/widgets/plasmic/ShareDialogContent";
import { useI18n } from "@/wab/client/i18n";
import React from "react";

export default function ShareDialog({
  open,
  ...props
}: Omit<ShareDialogContentProps, "renderDialog"> & { open: boolean }) {
  const { t } = useI18n();
  const [hasOpened, setHasOpened] = React.useState(open);
  React.useEffect(() => {
    if (open) {
      setHasOpened(true);
    }
  }, [open]);
  if (!open && !hasOpened) {
    return null;
  }
  const isProject = props.resource.type === "project";
  return (
    <ShareDialogContent
      {...props}
      renderDialog={(body, footer) => (
        <Modal
          open={open}
          title={isProject ? t("Share project") : undefined}
          onCancel={props.closeDialog}
          footer={footer}
          width={isProject ? 560 : 500}
          style={{ maxWidth: "calc(100vw - 32px)", top: 64 }}
          styles={isProject ? undefined : { container: { padding: 0 } }}
          modalRender={(node) => (
            <div
              onKeyDownCapture={(event) => {
                if (event.key === "Escape") {
                  if (
                    event.target instanceof HTMLElement &&
                    event.target
                      .closest(".ant-select")
                      ?.querySelector('[aria-expanded="true"]')
                  ) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  props.closeDialog();
                }
              }}
            >
              {node}
            </div>
          )}
        >
          {body}
        </Modal>
      )}
    />
  );
}
