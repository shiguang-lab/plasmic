import { BranchPanelTop } from "@/wab/client/components/sidebar-tabs/ProjectPanel/ProjectPanelTop";
import { useI18n } from "@/wab/client/i18n";
import { useStudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useInteractOutsideWithCommonExceptions } from "@/wab/commons/components/OnClickAway";
import { BranchesOutlined, DownOutlined } from "@ant-design/icons";
import { Button, Popover } from "antd";
import { createStyles } from "antd-style";
import { observer } from "mobx-react";
import * as React from "react";

const useStyles = createStyles(({ token }) => ({
  trigger: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    maxWidth: 180,
    flexShrink: 0,
    height: 32,
    padding: "0 10px",
    borderRadius: 6,
    background: token.colorFillTertiary,
    color: token.colorTextSecondary,
    fontSize: 12,
  },
  name: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
}));

export interface BranchSwitcherProps {
  className?: string;
}

const BranchSwitcher = observer(function BranchSwitcher({
  className,
}: BranchSwitcherProps) {
  const studioCtx = useStudioCtx();
  const { t } = useI18n();
  const { styles, cx } = useStyles();
  const currentBranchName = studioCtx.dbCtx().branchInfo?.name ?? "main";
  const [visible, setVisible] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  useInteractOutsideWithCommonExceptions({
    ref: panelRef,
    isDisabled: !visible,
    exceptSelectors: ["#branch-nav-button"],
    onInteractOutside: () => setVisible(false),
  });
  const closeOnEscape = (event: React.KeyboardEvent) => {
    if (visible && event.key === "Escape") {
      event.stopPropagation();
      setVisible(false);
    }
  };
  return (
    <Popover
      placement="bottomLeft"
      trigger="click"
      arrow={false}
      destroyOnHidden
      open={visible}
      onOpenChange={setVisible}
      styles={{
        container: { width: 320, maxWidth: "calc(100vw - 24px)", padding: 8 },
      }}
      content={() => (
        <div ref={panelRef} onKeyDownCapture={closeOnEscape}>
          <BranchPanelTop onClose={() => setVisible(false)} />
        </div>
      )}
    >
      <Button
        id="branch-nav-button"
        type="text"
        className={cx(styles.trigger, className)}
        aria-label={`${t("Branches")}: ${currentBranchName}`}
        aria-expanded={visible}
        title={`${t("Branches")}: ${currentBranchName}`}
        onKeyDownCapture={closeOnEscape}
        icon={<BranchesOutlined />}
      >
        <span className={styles.name}>{currentBranchName}</span>
        <DownOutlined style={{ fontSize: 10 }} />
      </Button>
    </Popover>
  );
});

export default BranchSwitcher;
