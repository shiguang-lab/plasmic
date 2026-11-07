import { useQueryBuilderStyles } from "@/wab/client/components/QueryBuilder/QueryBuilder.styles";
import "@/wab/client/components/QueryBuilder/QueryBuilder.scss";
import { ActionButton } from "@/wab/client/components/QueryBuilder/Components/ActionButton";
import { NativeValueEditor } from "@/wab/client/components/QueryBuilder/Components/NativeValueEditor";
import { useI18n } from "@/wab/client/i18n";
import { arrayEq } from "@/wab/shared/common";
import { createQueryBuilderConfig } from "@/wab/shared/query-builder";
import * as dndKit from "@dnd-kit/core";
import type { QueryBuilderConfig } from "@plasmicapp/host";
import { QueryBuilderAntD } from "@react-querybuilder/antd";
import type { CustomCanDropParams } from "@react-querybuilder/dnd";
import { QueryBuilderDnD } from "@react-querybuilder/dnd";
import { createDndKitAdapter } from "@react-querybuilder/dnd/dnd-kit";
import React from "react";
import {
  ActionProps,
  QueryBuilder,
  RuleGroupType,
  ValueEditorProps,
  isRuleGroup,
} from "react-querybuilder";
import "react-querybuilder/dist/query-builder.css";

const dnd = createDndKitAdapter(dndKit);
export function canMoveFilter({
  dragging,
  hovering,
  groupItems,
}: CustomCanDropParams) {
  return (
    dragging.qbId === hovering.qbId &&
    !groupItems &&
    arrayEq(
      dragging.path.slice(0, -1),
      "rules" in hovering ? hovering.path : hovering.path.slice(0, -1),
    )
  );
}
export type RenderQueryValue = (
  props: ValueEditorProps,
  renderInput: (value?: any) => React.ReactElement,
) => React.ReactElement;

function pruneEmptyGroups(tree: RuleGroupType): RuleGroupType {
  return {
    ...tree,
    rules: tree.rules
      .map((rule) => (isRuleGroup(rule) ? pruneEmptyGroups(rule) : rule))
      .filter((rule) => !isRuleGroup(rule) || rule.rules.length > 0),
  };
}
function ValueEditor(props: ValueEditorProps) {
  const renderInput = (...args: [any?]) => (
    <NativeValueEditor
      field={props.fieldData}
      operator={props.operator}
      value={args.length ? args[0] : props.value}
      disabled={props.disabled}
      setValue={(next) => {
        if (!props.disabled) {
          props.handleOnChange(next);
        }
      }}
    />
  );
  if (["between", "notBetween"].includes(props.operator)) {
    const values = Array.isArray(props.value) ? props.value : [];
    return (
      <div className={`${props.className} flex gap-sm`}>
        {[0, 1].map((index) => (
          <ValueEditor
            key={index}
            {...props}
            operator="="
            value={values[index]}
            handleOnChange={(value) => {
              const next = [...values];
              next[index] = value;
              if (!props.disabled) {
                props.handleOnChange(next);
              }
            }}
          />
        ))}
      </div>
    );
  }
  if (["null", "notNull"].includes(props.operator)) {
    return <></>;
  }
  const render: RenderQueryValue | undefined = props.context?.renderValueEditor;
  return (
    <div className={props.className}>
      {render ? render(props, renderInput) : renderInput()}
    </div>
  );
}
function Action({
  type,
  ...props
}: ActionProps & { type: "addRule" | "addGroup" | "delRule" | "delGroup" }) {
  const { label } = useI18n();
  return (
    <ActionButton
      type={type}
      label={label(
        type === "addRule"
          ? "Add rule"
          : type === "addGroup"
            ? "Add group"
            : "Delete",
      )}
      onClick={props.handleOnClick}
      readonly={props.disabled}
    />
  );
}
const controls = {
  valueEditor: ValueEditor,
  addRuleAction: (props: ActionProps) => <Action {...props} type="addRule" />,
  addGroupAction: (props: ActionProps) => <Action {...props} type="addGroup" />,
  removeRuleAction: (props: ActionProps) => (
    <Action {...props} type="delRule" />
  ),
  removeGroupAction: (props: ActionProps) => (
    <Action {...props} type="delGroup" />
  ),
};

export function FilterQueryBuilder({
  config,
  value,
  onChange,
  disabled = false,
  renderValueEditor,
}: {
  config: QueryBuilderConfig;
  value: RuleGroupType;
  onChange: (tree: RuleGroupType) => void;
  disabled?: boolean;
  renderValueEditor?: RenderQueryValue;
}) {
  const { label } = useI18n();
  const { styles } = useQueryBuilderStyles();
  const native = React.useMemo(
    () => createQueryBuilderConfig(config, disabled),
    [config, disabled],
  );
  return (
    <div className={`query-builder-container query-builder ${styles.root}`}>
      <QueryBuilderAntD>
        <QueryBuilderDnD dnd={dnd} canDrop={canMoveFilter}>
          <QueryBuilder
            {...native}
            query={value}
            context={{ renderValueEditor }}
            controlElements={{
              ...controls,
              ...(config.showAddGroupAction === false
                ? { addGroupAction: null }
                : {}),
            }}
            onAddGroup={() => config.showAddGroupAction !== false}
            combinators={native.combinators.map((item) => ({
              ...item,
              label: label(item.label),
            }))}
            translations={{
              notToggle: { label: label("Skip"), title: label("Skip") },
            }}
            enableMountQueryChange={false}
            enableDragAndDrop={!disabled}
            addRuleToNewGroups
            listsAsArrays
            resetOnOperatorChange
            getDefaultValue={({ operator }, { fieldData }) =>
              fieldData.defaultValue ??
              (["between", "notBetween", "in", "notIn"].includes(operator)
                ? []
                : "")
            }
            onQueryChange={(next) => {
              if (!disabled) {
                onChange(pruneEmptyGroups(next));
              }
            }}
          />
        </QueryBuilderDnD>
      </QueryBuilderAntD>
    </div>
  );
}
