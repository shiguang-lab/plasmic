import { useStudioEscape } from "@/wab/client/hooks/useStudioEscape";
import { ModalScope } from "@/wab/client/components/widgets/ModalScope";
import { useTrackOpenModal } from "@/wab/client/components/widgets/open-modals";
import { useProductThemeStyles } from "@/wab/client/product-ui-theme.styles";
import { usesProductTheme } from "@/wab/client/ui-theme";
import { cx } from "@/wab/shared/common";
import { theme as AntdTheme } from "antd";
// eslint-disable-next-line no-restricted-imports
import { Modal as AntdModal, ModalProps } from "antd";
import { createStyles } from "antd-style";
import * as React from "react";
import { useCallback } from "react";

const useModalStyles = createStyles(() => ({
  root: {
    // Full-bleed content must stay inside the native modal's rounded surface.
    "& .ant-modal-container": { overflow: "hidden" },
  },
}));

/** Wrapper around antd Modal to provide proper focus trapping. */
export function Modal({ modalRender, ...props }: ModalProps) {
  const scope = React.useRef<HTMLDivElement>(null);
  useStudioEscape(scope, props.open ?? false, (event) => {
    if (props.keyboard !== false) {
      props.onCancel?.(event as unknown as Parameters<NonNullable<ModalProps["onCancel"]>>[0]);
    }
  });
  const { token } = AntdTheme.useToken();
  const { styles } = useProductThemeStyles(token);
  const { styles: modalStyles } = useModalStyles();
  useTrackOpenModal(props.open ?? false);
  const wrappedModalRender = useCallback(
    (node: React.ReactNode) => {
      const wrappedNode = (
        <ModalScope ref={scope} active={props.open ?? false} allowKeyCombos={["esc"]}>{node}</ModalScope>
      );
      if (modalRender) {
        return modalRender(wrappedNode);
      } else {
        return wrappedNode;
      }
    },
    [modalRender, props.open],
  );
  return (
    <AntdModal
      modalRender={wrappedModalRender}
      {...props}
      keyboard={false}
      className={cx(
        props.className,
        modalStyles.root,
        usesProductTheme(window.location.pathname) && styles.root,
      )}
    />
  );
}
