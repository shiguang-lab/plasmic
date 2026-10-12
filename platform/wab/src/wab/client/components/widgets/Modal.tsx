import { ModalScope } from "@/wab/client/components/widgets/ModalScope";
import { useTrackOpenModal } from "@/wab/client/components/widgets/open-modals";
import { useProductThemeStyles } from "@/wab/client/product-ui-theme.styles";
import { usesProductTheme } from "@/wab/client/ui-theme";
import { cx } from "@/wab/shared/common";
import { theme } from "antd";
// eslint-disable-next-line no-restricted-imports
import { Modal as AntdModal, ModalProps } from "antd";
import { createStyles } from "antd-style";
import * as React from "react";
import { useCallback } from "react";

const useModalStyles = createStyles(({ token }) => ({
  root: {
    // Full-bleed content must stay inside the native modal's rounded surface.
    // Template prompts replace that surface with their own ant-modal-content.
    "& .ant-modal-container": { overflow: "hidden" },
    "& .ant-modal-content": {
      borderRadius: token.borderRadiusLG,
      overflow: "hidden",
    },
  },
}));

/** Wrapper around antd Modal to provide proper focus trapping. */
export function Modal({ modalRender, ...props }: ModalProps) {
  const { token } = theme.useToken();
  const { styles } = useProductThemeStyles(token);
  const { styles: modalStyles } = useModalStyles();
  useTrackOpenModal(props.open ?? false);
  const wrappedModalRender = useCallback(
    (node: React.ReactNode) => {
      const wrappedNode = (
        <ModalScope allowKeyCombos={["esc"]}>{node}</ModalScope>
      );
      if (modalRender) {
        return modalRender(wrappedNode);
      } else {
        return wrappedNode;
      }
    },
    [modalRender],
  );
  return (
    <AntdModal
      modalRender={wrappedModalRender}
      {...props}
      className={cx(
        props.className,
        modalStyles.root,
        usesProductTheme(window.location.pathname) && styles.root,
      )}
    />
  );
}
