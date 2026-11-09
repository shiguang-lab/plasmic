import styles from "@/wab/client/components/canvas/EditableNodeLabel.module.sass";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { Textbox } from "@/wab/client/components/widgets/Textbox";
import { useI18n } from "@/wab/client/i18n";
import RepeatingsvgIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__RepeatingSvg";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { InlineEdit, type InlineEditHelpers } from "@/wab/commons/components/InlineEdit";
import { OnClickAway } from "@/wab/commons/components/OnClickAway";
import { cx, ensure, spawn } from "@/wab/shared/common";
import * as Tpls from "@/wab/shared/core/tpls";
import { isTplNamable, isTplSlot } from "@/wab/shared/core/tpls";
import {
  ArenaFrame,
  TplSlot,
  isKnownArenaFrame,
} from "@/wab/shared/model/classes";
import { Tooltip } from "antd";
import { useStore } from "zustand";
import * as React from "react";
import { useEffect } from "react";

type EditableNodeLabelProps = {
  studioCtx: StudioCtx;
  viewCtx?: ViewCtx;
  className?: string;
  displayName: string;
  icon?: React.ReactNode;
  isRepeated?: boolean;
  nameable?: ArenaFrame | Tpls.TplNamable | TplSlot;
  onChangeEditing?: (editing: boolean) => void;
};

export function EditableNodeLabel(props: EditableNodeLabelProps) {
  return <InlineEdit render={(helpers) => <EditableNodeLabelContent {...props} {...helpers} />} />;
}

function EditableNodeLabelContent(props: EditableNodeLabelProps & InlineEditHelpers) {
  const { editing, onStart, onDone } = props;
  const { t: uiT } = useI18n();
  const {
    studioCtx,
    viewCtx,
    className,
    displayName,
    icon,
    isRepeated,
    nameable,
  } = props;

  const isRenamingFocused = useStore(studioCtx.renamingFocusedStore);
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [editWidth, setEditWidth] = React.useState(75);

        const startEditing = () => {
          setEditWidth(Math.max(75, (textRef.current?.offsetWidth ?? 0) + 2));
          onStart();
        };
        useEffect(() => props.onChangeEditing?.(editing), [editing]);

        useEffect(() => {
          if (isRenamingFocused && !editing) {
            if (nameable) {
              startEditing();
            }
            studioCtx.endRenamingFocused();
          }
        }, [isRenamingFocused]);

        return editing ? (
          <div className={cx(className, styles.container)}>
            {icon && <div className="InlineIcon mr-sm">{icon}</div>}
            {nameable && (
              <OnClickAway onDone={onDone}>
                <div>
                  <RenameTextbox
                    nameable={nameable}
                    // We specify a key here to re-mount the Textbox when we
                    // switch to a different node. That makes sure that our
                    // onEdit handler will fire, and the current node is renamed.
                    key={nameable.uid}
                    styleType={["seamless", "inverted", "autoheight"]}
                    noOutline
                    style={{ font: "inherit" }}
                    wrapperProps={{
                      style: {
                        width: editWidth,
                        minHeight: 0,
                      },
                    }}
                    selectAllOnFocus
                    autoFocus
                    onBlur={onDone}
                    onEnter={onDone}
                    onEscape={onDone}
                    skipEditOnEnter={true}
                    onEdit={(name) => {
                      spawn(
                        studioCtx.changeUnsafe(() => {
                          if (isTplNamable(nameable)) {
                            ensure(viewCtx, "viewCtx is undefined")
                              .getViewOps()
                              .renameTpl(name, nameable);
                          } else if (isTplSlot(nameable)) {
                            ensure(viewCtx, "viewCtx is undefined")
                              .getViewOps()
                              .tryRenameParam(name, nameable.param);
                          } else {
                            ensure(viewCtx, "viewCtx is undefined")
                              .getViewOps()
                              .renameNode(nameable, name);
                          }
                          onDone();
                        }),
                      );
                    }}
                  />
                </div>
              </OnClickAway>
            )}
          </div>
        ) : (
          <div
            className={cx(className, styles.container)}
            onDoubleClick={nameable ? startEditing : undefined}
          >
            <>
              {icon && <div className="InlineIcon mr-sm">{icon}</div>}
              <span ref={textRef}>{displayName}</span>
              {isRepeated && (
                <Tooltip title={uiT("Repeated element")} mouseEnterDelay={0.5}>
                  <Icon
                    className={styles.repeatedElementIcon}
                    icon={RepeatingsvgIcon}
                  />
                </Tooltip>
              )}
            </>
          </div>
        );
}

/** Capture the input default once for each editing target; drafts own subsequent text. */
function RenameTextbox({
  nameable,
  ...props
}: React.ComponentProps<typeof Textbox> & {
  nameable: ArenaFrame | Tpls.TplNamable | TplSlot;
}) {
  const [initialName] = React.useState(() =>
    isTplSlot(nameable)
      ? nameable.param.variable.name
      : isKnownArenaFrame(nameable)
        ? nameable.container.component.name
        : nameable.name || "",
  );
  const finished = React.useRef(false);
  return (
    <Textbox
      {...props}
      defaultValue={initialName}
      onEscape={(value) => {
        finished.current = true;
        props.onEscape?.(value);
      }}
      onEdit={(value) => {
        // Textbox also commits edited inputs during its unmount cleanup.
        if (!finished.current) {
          finished.current = true;
          props.onEdit?.(value);
        }
      }}
    />
  );
}
