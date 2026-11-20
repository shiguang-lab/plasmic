import { InspectorReadOnly } from "@/wab/client/components/studio/inspector-access";
import { useRepeatingElementInputs } from "@/wab/client/studio-ctx/state-management-inputs";
import { useCustomFunctionsSchema } from "@/wab/client/studio-ctx/custom-functions-schema-react";
import { useInspectorCanvasEnv } from "@/wab/client/studio-ctx/inspector-state";
import { DataPickerEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/DataPickerEditor";
import { StringPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/StringPropEditor";
import { LabeledItemRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import CloseIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Close";
import MinusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Minus";
import { Repeat2 } from "lucide";
import { useStudioEscape } from "@/wab/client/hooks/useStudioEscape";
import { isContextMenuOpen } from "@/wab/client/components/ContextMenu";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import styles from "@/wab/client/components/sidebar-tabs/RepeatingElementControl.module.scss";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { toVarName } from "@/wab/shared/codegen/util";
import { ensureArray, uniqueName, withoutNils } from "@/wab/shared/common";
import {
  code,
  createExprForDataPickerValue,
} from "@/wab/shared/core/exprs";
import { mkVar } from "@/wab/shared/core/lang";
import { tryGetTplOwnerComponent } from "@/wab/shared/core/tpls";
import { Rep, TplNode } from "@/wab/shared/model/classes";
import { Button, Popover, Tooltip } from "antd";
import { tryEvalExpr } from "@/wab/shared/eval";
import cx from "classnames";
import React from "react";

function RepeatIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {Repeat2.map(([tag, attributes], index) =>
        React.createElement(tag, { ...attributes, key: index }),
      )}
    </svg>
  );
}

const defaultElementName = "currentItem";
const defaultIndexName = "currentIndex";

export const RepeatingElementControl = React.memo(function RepeatingElementControl(props: {
  tpl: TplNode;
  viewCtx: ViewCtx;
}) {
  const inspecting = React.useContext(InspectorReadOnly);
  const { t: uiT } = useI18n();
  const { tpl, viewCtx } = props;
  const canvasEnv = useInspectorCanvasEnv(viewCtx, tpl, { forDataRepCollection: true });
  const ownerComponent = tryGetTplOwnerComponent(tpl);
  const [isDataPickerVisible, setIsDataPickerVisible] =
    React.useState<boolean>(false);

  const [open, setOpen] = React.useState(false);
  const [panelOffset, setPanelOffset] = React.useState(0);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const popup = React.useRef<HTMLDivElement>(null);
  const close = () => { setOpen(false); setIsDataPickerVisible(false); };
  useStudioEscape(popup, open && !isDataPickerVisible, () => { close(); trigger.current?.focus(); });

  // Although dataRep is in VariantSetting schema, it's not variantable. We
  // just set and use it from the base variant setting (see, for example,
  // serializeDataReps in codegen). Maybe it should be actually be moved out
  // from VariantSetting into TplNode. But while we don't do it, this control
  // just edits the dataRep in baseVs.
  const {snapshot, source} = useRepeatingElementInputs(viewCtx, ownerComponent ?? viewCtx.currentComponent(), tpl);
  const baseVs = snapshot.base ? source.resolve(snapshot.base) : undefined;
  const dataRep = snapshot.repetition ? source.resolve(snapshot.repetition) : undefined;
  const schema = useCustomFunctionsSchema(viewCtx.studioCtx);
  if (!baseVs || (inspecting && !dataRep)) { return null; }

  const evaluated = snapshot.collectionCode
    ? tryEvalExpr(snapshot.collectionCode, canvasEnv ?? {})
    : undefined;
  const count = evaluated?.err ? "—" : ensureArray(evaluated?.val).length;
  const remove = () => {
    viewCtx.change(() => { baseVs.dataRep = null; });
    close();
  };

  return (
    <Popover
      trigger="click"
      placement="leftTop"
      arrow={false}
      align={{ offset: [panelOffset, 0] }}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && (isDataPickerVisible || isContextMenuOpen())) { return; }
        if (nextOpen) {
          const button = trigger.current;
          const panel = button?.closest(".editor-inspector-header");
          setPanelOffset(button && panel ? panel.getBoundingClientRect().left - button.getBoundingClientRect().left - 8 : -8);
        }
        setOpen(nextOpen);
      }}
      destroyOnHidden
      content={
        <div ref={popup} className={styles.popover} role="dialog" aria-label={uiT("Repeat element")}>
          <div className={styles.heading}>
            <strong>{uiT("Repeat element")}</strong>
            {!inspecting && dataRep && <Tooltip title={uiT("Remove repetition")}>
              <Button type="text" size="small" aria-label={uiT("Remove repetition")} icon={<Icon icon={MinusIcon} />} onClick={remove} />
            </Tooltip>}
            <Button type="text" size="small" aria-label={uiT("Close")} icon={<Icon icon={CloseIcon} />} onClick={close} />
          </div>
          <LabeledItemRow
            label={uiT("Collection")}
            data-test-id="repeating-element-collection"
          >
            <DataPickerEditor
              viewCtx={viewCtx}
              value={snapshot.collectionValue}
              onChange={(val) => {
                if (!val) {
                  return;
                }
                const newExpr = createExprForDataPickerValue(val, code(`([])`));
                viewCtx.change(() => {
                  if (dataRep) {
                    dataRep.collection = newExpr;
                  } else {
                    baseVs.dataRep = new Rep({
                      collection: newExpr,
                      element: mkVar(defaultElementName),
                      index: mkVar(defaultIndexName),
                    });
                  }
                });
              }}
              visible={isDataPickerVisible}
              setVisible={setIsDataPickerVisible}
              data={canvasEnv}
              schema={schema}
              key={tpl.uid}
              context="Array of elements to then be iterated"
            />
          </LabeledItemRow>
          <LabeledItemRow
            label={uiT("Element name")}
            data-test-id="repeating-element-name"
          >
            <StringPropEditor
              disabled={!dataRep}
              aria-label={uiT("Element name")}
              onChange={(newElementName) => {
                if (!dataRep) { return; }
                viewCtx.change(() => {
                  // Ensure element name doesn't collide with index name
                  dataRep.element = mkVar(
                    uniqueName(
                      withoutNils([dataRep.index?.name]),
                      newElementName || defaultElementName,
                      {
                        separator: "",
                        normalize: toVarName,
                      },
                    ),
                  );
                });
              }}
              value={dataRep ? snapshot.elementName : defaultElementName}
              leftAligned
            />
          </LabeledItemRow>
          <LabeledItemRow
            label={uiT("Index name")}
            data-test-id="repeating-element-index-name"
          >
            <StringPropEditor
              disabled={!dataRep}
              aria-label={uiT("Index name")}
              onChange={(newIndexName) => {
                if (!dataRep) { return; }
                viewCtx.change(() => {
                  if (newIndexName) {
                    // Ensure index name doesn't collide with element name
                    dataRep.index = mkVar(
                      uniqueName([dataRep.element.name], newIndexName, {
                        separator: "",
                        normalize: toVarName,
                      }),
                    );
                  } else {
                    dataRep.index = null;
                  }
                });
              }}
              value={dataRep ? snapshot.indexName : defaultIndexName}
              leftAligned
            />
          </LabeledItemRow>
        </div>
      }
    >
      <Tooltip title={open ? null : uiT("Repeat element")}><TriggerTarget>
        <button
          type="button"
          ref={trigger}
          className={cx("editor-panel-repeat-trigger", styles.trigger, { [styles.active]: !!dataRep })}
          aria-label={uiT("Repeat element")}
          aria-expanded={open}
          data-test-id="inspector-repeat-trigger"
        >
          <Icon icon={RepeatIcon} size={14} />
          {dataRep && <span>{count}</span>}
        </button>
      </TriggerTarget></Tooltip>
    </Popover>
  );
});
