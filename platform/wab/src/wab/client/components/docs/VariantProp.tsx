import { XMultiSelect } from "@/wab/client/components/XMultiSelect";
import { DocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import Select from "@/wab/client/components/widgets/Select";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { PlasmicVariantProp } from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicVariantProp";
import { ensure, ensureArray } from "@/wab/shared/common";
import { DocsVariantGroup } from "@/wab/client/components/docs/docs-model-projections";
import { useDocsFocusedComponentRef } from "@/wab/client/components/docs/DocsModelResources";
import { Tooltip } from "antd";
import * as React from "react";
import { useStore } from "zustand";

interface VariantPropProps {
  docsCtx: DocsPortalCtx;
  group: DocsVariantGroup;
}

function VariantProp(props: VariantPropProps) {
  const { t: uiT } = useI18n();
  const { docsCtx, group } = props;
  const componentRef = ensure(useDocsFocusedComponentRef(docsCtx), "Missing focused component");
  const snapshots = docsCtx.models.snapshots;
  const component = snapshots.resolve(componentRef);
  const param = snapshots.resolve(group.param);
  const name = group.name;
  const selected = useStore(docsCtx.getComponentStore(component), (state) => state.toggles.get(param));
  const value = group.options.filter((option) => ensureArray(selected).includes(snapshots.resolve(option.ref)));
  const tsType = group.type;
  const isToggle = group.isToggle;
  return (
    <PlasmicVariantProp
      label={name}
      type={
        <Tooltip title={<code>{tsType}</code>}>
          <span>{tsType}</span>
        </Tooltip>
      }
      isToggle={isToggle}
      toggle={
        isToggle
          ? {
              isChecked: value.length > 0,
              onChange: (checked) => {
                if (checked) {
                  docsCtx.setComponentToggle(
                    component,
                    param,
                    snapshots.resolve(ensure(group.options[0], "Toggle variant missing").ref),
                  );
                } else {
                  docsCtx.setComponentToggle(component, param, undefined);
                }
              },
              "aria-label": name,
            }
          : undefined
      }
    >
      {group.isToggle ? null : group.multi ? (
        <XMultiSelect
          className="flex-fill dropdown-container--bordered"
          options={group.options.filter((option) => !value.includes(option))}
          itemKey={(option) => (option ? option.uuid : "")}
          selectedItems={value}
          onSelect={(item) => {
            docsCtx.setComponentToggle(component, param, [...value, item].map((option) => snapshots.resolve(option.ref)));
          }}
          onUnselect={(item) => {
            docsCtx.setComponentToggle(
              component,
              param,
              value.filter((option) => option !== item).map((option) => snapshots.resolve(option.ref)),
            );
          }}
          filterOptions={(options, input) => {
            if (!input) {
              return options;
            }
            return options.filter((op) =>
              op.name.toLowerCase().includes(input.toLowerCase()),
            );
          }}
          renderOption={(option) => option.name}
          renderSelectedItem={(option) => option.name}
          renderInput={(options) => (
            <input {...options} className="transparent" />
          )}
          placeholder={uiT("(Unset)")}
        />
      ) : (
        <Select
          value={value.length > 0 ? value[0].uuid : null}
          onChange={(key) => {
            if (key === "") {
              docsCtx.setComponentToggle(component, param, undefined);
            } else {
              const selectedOption = group.options.find((option) => option.uuid === key);
              docsCtx.setComponentToggle(component, param, selectedOption && snapshots.resolve(selectedOption.ref));
            }
          }}
          placeholder={uiT("(Unset)")}
          aria-label={name}
        >
          {[
            <Select.Option value={null} key="" textValue={uiT("Unset")}>
              <em>
                <UiText message={"(Unset)"} />
              </em>
            </Select.Option>,
            ...group.options.map((variant) => (
              <Select.Option
                key={variant.uuid}
                value={variant.uuid}
                textValue={variant.varName}
              >
                {variant.varName}
              </Select.Option>
            )),
          ]}
        </Select>
      )}
    </PlasmicVariantProp>
  );
}

export default VariantProp;
