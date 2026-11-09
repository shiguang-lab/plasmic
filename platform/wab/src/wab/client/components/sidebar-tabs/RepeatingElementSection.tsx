import { useRepeatingElementInputs } from "@/wab/client/studio-ctx/state-management-inputs";
import { useCustomFunctionsSchema } from "@/wab/client/studio-ctx/custom-functions-schema-react";
import { useInspectorCanvasEnv } from "@/wab/client/studio-ctx/inspector-state";
import { DataPickerEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/DataPickerEditor";
import { StringPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/StringPropEditor";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { LabeledItemRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import { IconLinkButton } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { toVarName } from "@/wab/shared/codegen/util";
import { ensure, uniqueName, withoutNils } from "@/wab/shared/common";
import {
  code,
  createExprForDataPickerValue,
} from "@/wab/shared/core/exprs";
import { mkVar } from "@/wab/shared/core/lang";
import { tryGetTplOwnerComponent } from "@/wab/shared/core/tpls";
import { ObjectPath, Rep, TplNode } from "@/wab/shared/model/classes";
import { Menu } from "antd";
import React from "react";

const defaultElementName = "currentItem";
const defaultIndexName = "currentIndex";

export const RepeatingElementSection = React.memo(function RepeatingElementSection(props: {
  tpl: TplNode;
  viewCtx: ViewCtx;
}) {
  const { t: uiT } = useI18n();
  const { tpl, viewCtx } = props;
  const canvasEnv = useInspectorCanvasEnv(viewCtx, tpl, { forDataRepCollection: true });
  const ownerComponent = tryGetTplOwnerComponent(tpl);
  const [isDataPickerVisible, setIsDataPickerVisible] =
    React.useState<boolean>(false);

  // Although dataRep is in VariantSetting schema, it's not variantable. We
  // just set and use it from the base variant setting (see, for example,
  // serializeDataReps in codegen). Maybe it should be actually be moved out
  // from VariantSetting into TplNode. But while we don't do it, this section
  // just edits the dataRep in baseVs.
  const {snapshot, source} = useRepeatingElementInputs(viewCtx, ownerComponent ?? viewCtx.currentComponent(), tpl);
  const baseVs = snapshot.base ? source.resolve(snapshot.base) : undefined;
  const dataRep = snapshot.repetition ? source.resolve(snapshot.repetition) : undefined;
  const schema = useCustomFunctionsSchema(viewCtx.studioCtx);
  if (!baseVs) {return null;}

  const resetDataRep = () => {
    viewCtx.change(() => {
      ensure(baseVs, "Base variant setting").dataRep = new Rep({
        collection: new ObjectPath({
          path: ["[2, 3, 4]"],
          fallback: null,
        }),
        element: mkVar(defaultElementName),
        index: mkVar(defaultIndexName),
      });
    });
  };

  return (
    <SidebarSection
      title={uiT("Repeat element")}
      isHeaderActive={!!dataRep}
      controls={
        !dataRep && (
          <IconLinkButton
            onClick={resetDataRep}
            aria-label={uiT("Repeat element")}
            data-test-id="btn-repeating-element-add"
          >
            <Icon icon={PlusIcon} />
          </IconLinkButton>
        )
      }
      makeHeaderMenu={
        dataRep
          ? () => (
              <Menu>
                <Menu.Item
                  onClick={() => {
                    viewCtx.change(() => {
                      ensure(baseVs, "Base variant setting").dataRep = null;
                    });
                  }}
                >
                  <UiText message={"Remove repetition"} />
                </Menu.Item>
              </Menu>
            )
          : undefined
      }
      data-test-id="repeating-element-section"
    >
      {!!dataRep && (
        <>
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
                  dataRep.collection = newExpr;
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
              disabled={false}
              onChange={(newElementName) => {
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
              value={snapshot.elementName}
              leftAligned
            />
          </LabeledItemRow>
          <LabeledItemRow
            label={uiT("Index name")}
            data-test-id="repeating-element-index-name"
          >
            <StringPropEditor
              disabled={false}
              onChange={(newIndexName) => {
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
              value={snapshot.indexName}
              leftAligned
            />
          </LabeledItemRow>
        </>
      )}
    </SidebarSection>
  );
});
