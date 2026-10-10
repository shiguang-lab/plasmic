import { ModalScope } from "@/wab/client/components/widgets/ModalScope";
import { useTrackOpenModal } from "@/wab/client/components/widgets/open-modals";
import { useProductThemeStyles } from "@/wab/client/product-ui-theme.styles";
import { usesProductTheme } from "@/wab/client/ui-theme";
import { cx } from "@/wab/shared/common";
import { theme } from "antd";
// eslint-disable-next-line no-restricted-imports
import { Modal as AntdModal, ModalProps } from "antd";
import * as React from "react";
import { useCallback } from "react";

/** Wrapper around antd Modal to provide proper focus trapping. */
export function Modal({ modalRender, ...props }: ModalProps) {
  const { token } = theme.useToken();
  const { styles } = useProductThemeStyles(token);
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
        usesProductTheme(window.location.pathname) && styles.root,
      )}
    />
  );
}
