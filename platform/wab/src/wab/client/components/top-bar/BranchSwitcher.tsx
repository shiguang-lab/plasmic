import branchSwitcherStyles from "./BranchSwitcher.module.less";
import { cx } from "@/wab/shared/common";
import { BranchPanelTop } from "@/wab/client/components/sidebar-tabs/ProjectPanel/ProjectPanelTop";
import { useI18n } from "@/wab/client/i18n";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useInteractOutsideWithCommonExceptions } from "@/wab/commons/components/OnClickAway";
import { BranchesOutlined } from "@ant-design/icons";
import { Button, Popover, Tooltip } from "antd";
import { useStore } from "zustand";
import * as React from "react";

export interface BranchSwitcherProps {
  className?: string;
}

function BranchSwitcher({
  className,
}: BranchSwitcherProps) {
  const studioCtx = useStudioCtx();
  const { t } = useI18n();

  const currentBranchName = useStore(studioCtx.uiEnvironment.store, (state) => state.branchName);
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
      <Tooltip
        trigger={["hover", "focus"]}
        title={`${t("Branches")}: ${currentBranchName}`}
        open={visible ? false : undefined}
      >
        <Button
          id="branch-nav-button"
          color="primary"
          variant="link"
          className={cx(branchSwitcherStyles.trigger, className)}
          aria-label={`${t("Branches")}: ${currentBranchName}`}
          aria-expanded={visible}
          onKeyDownCapture={closeOnEscape}
          icon={<BranchesOutlined />}
        />
      </Tooltip>
    </Popover>
  );
}

export default BranchSwitcher;
