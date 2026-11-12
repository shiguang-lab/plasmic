import styles from "@/wab/client/components/canvas/EditableNodeLabel.module.sass";
import { Textbox } from "@/wab/client/components/widgets/Textbox";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  InlineEdit,
  type InlineEditHelpers,
} from "@/wab/commons/components/InlineEdit";
import { OnClickAway } from "@/wab/commons/components/OnClickAway";
import { cx, spawn } from "@/wab/shared/common";
import type { ArenaFrame } from "@/wab/shared/model/classes";
import * as React from "react";
import { useEffect } from "react";
import { useStore } from "zustand";

type EditableNodeLabelProps = {
  studioCtx: StudioCtx;
  viewCtx: ViewCtx;
  className?: string;
  displayName: string;
  icon?: React.ReactNode;
  nameable: ArenaFrame;
};

export function EditableNodeLabel(props: EditableNodeLabelProps) {
  return (
    <InlineEdit
      render={(helpers) => <EditableNodeLabelContent {...props} {...helpers} />}
    />
  );
}

function EditableNodeLabelContent(
  props: EditableNodeLabelProps & InlineEditHelpers,
) {
  const { editing, onStart, onDone } = props;
  const { studioCtx, viewCtx, className, displayName, icon, nameable } = props;

  const isRenamingFocused = useStore(studioCtx.renamingFocusedStore);
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [editWidth, setEditWidth] = React.useState(75);

  const startEditing = () => {
    setEditWidth(Math.max(75, (textRef.current?.offsetWidth ?? 0) + 2));
    onStart();
  };

  useEffect(() => {
    if (isRenamingFocused && !editing) {
      startEditing();
      studioCtx.endRenamingFocused();
    }
  }, [isRenamingFocused]);

  return editing ? (
    <div className={cx(className, styles.container)}>
      {icon && <div className="InlineIcon mr-sm">{icon}</div>}
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
                  viewCtx.getViewOps().renameNode(nameable, name);
                  onDone();
                }),
              );
            }}
          />
        </div>
      </OnClickAway>
    </div>
  ) : (
    <div
      className={cx(className, styles.container)}
      onDoubleClick={startEditing}
    >
      <>
        {icon && <div className="InlineIcon mr-sm">{icon}</div>}
        <span ref={textRef}>{displayName}</span>
      </>
    </div>
  );
}

/** Capture the input default once for each editing target; drafts own subsequent text. */
function RenameTextbox({
  nameable,
  ...props
}: React.ComponentProps<typeof Textbox> & {
  nameable: ArenaFrame;
}) {
  const [initialName] = React.useState(() => nameable.container.component.name);
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
