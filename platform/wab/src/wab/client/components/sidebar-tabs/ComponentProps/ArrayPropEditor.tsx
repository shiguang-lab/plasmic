import { InspectorReadOnly } from "@/wab/client/components/studio/inspector-access";
import paintStyles from "@/wab/client/components/style-controls/PaintRows.module.scss";
import styles from "@/wab/client/components/sidebar-tabs/ComponentProps/ArrayPropEditor.module.scss";
import { ConnectorLine } from "@/wab/client/components/widgets/ConnectorLine";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { IconButton } from "@/wab/client/components/widgets/IconButton";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { createPortal } from "react-dom";
import {
  ItemFunc,
  ObjectPropEditor,
} from "@/wab/client/components/sidebar-tabs/ComponentProps/ObjectPropEditor";
import {
  ControlExtras,
  PropValueEditorContext,
  usePropValueEditorContext,
} from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { ListBox, ListBoxItem } from "@/wab/client/components/widgets";
import { useI18n } from "@/wab/client/i18n";
import {
  StudioPropType,
  getPropTypeDefaultValue,
  isPlainObjectPropType,
} from "@/wab/shared/code-components/code-components";
import {
  Dict,
  arrayMoveIndex,
  arrayRemoveAt,
  arrayReplaceAt,
} from "@/wab/shared/collections";
import { ensure, uncheckedCast } from "@/wab/shared/common";
import { PropType } from "@plasmicapp/host";
import React, { useState } from "react";

interface ArrayPropEditorProps<Value extends object> {
  subfields: Dict<PropType<unknown>>;
  itemNameFunc?: ItemFunc<Value, string | undefined>;
  canDeleteFunc?: ItemFunc<Value, boolean>;
  modalKey: string;
  ccContextData: any;
  componentPropValues: any;
  controlExtras: ControlExtras;
  onChange: (val: Value[]) => void;
  compositeValue: Value[] | undefined;
  evaluatedValue: Value[] | undefined;
  "data-plasmic-prop": string;
  propType: StudioPropType<any>;
  disabled?: boolean;
  headerElement?: HTMLElement | null;
}

export function ArrayPropEditor<
  Value extends object,
>({
  onChange,
  compositeValue,
  evaluatedValue,
  subfields,
  canDeleteFunc,
  itemNameFunc,
  modalKey,
  ccContextData,
  componentPropValues,
  controlExtras,
  "data-plasmic-prop": dataPlasmicProp,
  propType,
  disabled,
  headerElement,
}: ArrayPropEditorProps<Value>) {
  const { t: studioUiT } = useI18n();

  const [inspect, setInspect] = useState<number | undefined>(undefined);

  function addNewElement() {
    const fromEntries = Object.fromEntries(
      Object.entries(subfields)
        .filter(
          ([_, fieldPropType]) =>
            isPlainObjectPropType(fieldPropType) &&
            "defaultValue" in fieldPropType,
        )
        .map(([propName, fieldPropType]) => [
          propName,
          fieldPropType["defaultValue"],
        ]),
    );
    onChange([...(compositeValue ?? []), uncheckedCast(fromEntries)]);
    setInspect((compositeValue ?? []).length);
  }

  const valueEditorCtx = usePropValueEditorContext();
  const arrayItemType = ensure(
    isPlainObjectPropType(propType) &&
      propType.type === "array" &&
      propType.itemType !== undefined
      ? propType.itemType
      : undefined,
    `prop type not supported for array prop editor. Found: ${propType}`,
  );
  const itemTypeDefaultValue = arrayItemType
    ? getPropTypeDefaultValue(arrayItemType)
    : undefined;

  const inspecting = React.useContext(InspectorReadOnly);
  const isDragDisabled = disabled || (evaluatedValue?.length ?? 0) < 2;

  const addButton = (
    <IconButton
      size="small"
      aria-label={studioUiT("Add item")}
      tooltip={studioUiT("Add item")}
      data-test-id={`${dataPlasmicProp}-add-btn`}
      disabled={disabled}
      onClick={addNewElement}
    >
      <Icon icon={PlusIcon} />
    </IconButton>
  );

  return (
    <div className={styles.editor}>
      {!inspecting && (headerElement ? (
        createPortal(addButton, headerElement)
      ) : (
        <div className={styles.standaloneHeader}>{addButton}</div>
      ))}
      <ListBox
        onReorder={(from, to) => {
          if (!isDragDisabled && compositeValue) {
            onChange(arrayMoveIndex(compositeValue, from, to));
          }
        }}
        data-test-id={dataPlasmicProp}
        disabled={disabled}
      >
        {(evaluatedValue ?? []).map((evaluatedItem, index) => {
          const nextControlExtras: ControlExtras = {
            ...controlExtras,
            path: [...controlExtras.path, index],
            item: evaluatedItem,
          };
          const compositeItem = compositeValue
            ? compositeValue[index]
            : evaluatedItem;
          return (
            <ConnectorLine
              key={index}
              isLast={index === (evaluatedValue?.length ?? 0) - 1}
              className={styles.item}
            >
              <ListBoxItem
                className={paintStyles.fillItem}
                clickable={false}
                truncate={false}
                data-test-id={`${dataPlasmicProp}-${index}`}
                mainContent={
                  <PropValueEditorContext.Provider
                    value={{
                      ...valueEditorCtx,
                      defaultValue: itemTypeDefaultValue,
                    }}
                  >
                    <ObjectPropEditor
                      key={index}
                      componentPropValues={componentPropValues}
                      compositeValue={compositeItem}
                      evaluatedValue={evaluatedItem}
                      fields={subfields}
                      objectNameFunc={itemNameFunc ?? (() => `Item ${index}`)}
                      modalKey={modalKey}
                      ccContextData={ccContextData}
                      onChange={(newData) => {
                        if (compositeValue) {
                          onChange(
                            arrayReplaceAt(
                              compositeValue,
                              index,
                              uncheckedCast(newData),
                            ),
                          );
                        }
                      }}
                      listItem
                      onClose={() => {
                        if (inspect === index) {
                          setInspect(undefined);
                        }
                      }}
                      defaultShowModal={index === inspect}
                      controlExtras={nextControlExtras}
                      propType={arrayItemType}
                      disabled={disabled}
                    />
                  </PropValueEditorContext.Provider>
                }
                index={index}
                showDelete={
                  !disabled &&
                  canDeleteFunc?.(
                    evaluatedItem,
                    componentPropValues,
                    ccContextData,
                    nextControlExtras,
                  )
                }
                onRemove={() => {
                  if (compositeValue) {
                    onChange(arrayRemoveAt(compositeValue, index));
                  }
                }}
                disabled={disabled}
                isDragDisabled={isDragDisabled}
              />
            </ConnectorLine>
          );
        })}
      </ListBox>
    </div>
  );
}
