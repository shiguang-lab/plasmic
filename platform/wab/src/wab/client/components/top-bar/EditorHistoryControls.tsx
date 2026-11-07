import { TextAndShortcut } from "@/wab/client/components/menu-builder";
import { EditorIconAction } from "@/wab/client/components/top-bar/EditorActions";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useI18n } from "@/wab/client/i18n";
import { getComboForAction } from "@/wab/client/shortcuts/studio/studio-shortcuts";
import { ensure, spawn } from "@/wab/shared/common";
import { Tooltip } from "antd";
import React from "react";
import { useStore } from "zustand";

export function EditorHistoryControls() {
  const studioCtx = useStudioCtx();
  const { t } = useI18n();
  const undoLog = ensure(useStore(studioCtx.undoLogOwnerStore), "Studio undo owner must be initialized");
  const canUndo = useStore(undoLog.store, (state) => state.canUndo);
  const canRedo = useStore(undoLog.store, (state) => state.canRedo);
  const editable = useStore(studioCtx.uiEnvironment.store, (state) => state.canEditProject);
  return (
    <div className="editor-history-controls">
      <Tooltip
        title={
          <TextAndShortcut
            variant="tooltip"
            shortcut={getComboForAction("UNDO")}
          >
            {t("Undo")}
          </TextAndShortcut>
        }
      >
        <EditorIconAction
          action="Undo"
          disabled={!editable || !canUndo}
          onClick={() => spawn(studioCtx.undo())}
        />
      </Tooltip>
      <Tooltip
        title={
          <TextAndShortcut
            variant="tooltip"
            shortcut={getComboForAction("REDO")}
          >
            {t("Redo")}
          </TextAndShortcut>
        }
      >
        <EditorIconAction
          action="Redo"
          disabled={!editable || !canRedo}
          onClick={() => spawn(studioCtx.redo())}
        />
      </Tooltip>
    </div>
  );
}
