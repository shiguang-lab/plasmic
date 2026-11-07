import {
  EditableLabel,
  EditableLabelHandles,
} from "@/wab/client/components/widgets/EditableLabel";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { useI18n } from "@/wab/client/i18n";
import { VARIANTS_CAP } from "@/wab/shared/Labels";
import { VariantGroup } from "@/wab/shared/model/classes";
import * as React from "react";
import { useStore } from "zustand";

interface EditableGroupLabelProps {
  onEdit: (name: string) => void;
  defaultEditing?: boolean;
  group: VariantGroup;
}

function EditableGroupLabel_(
  { group, onEdit, defaultEditing }: EditableGroupLabelProps,
  ref: React.Ref<EditableLabelHandles>,
) {
  const { t: studioUiT, label } = useI18n();
  const studioCtx = useStudioCtx();

  const paramRef = useStore(studioCtx.modelSnapshots.field(group, "param"));
  const param = studioCtx.modelSnapshots.resolve(paramRef);
  const variableRef = useStore(
    studioCtx.modelSnapshots.field(param, "variable"),
  );
  const variable = studioCtx.modelSnapshots.resolve(variableRef);
  const name = useStore(studioCtx.modelSnapshots.field(variable, "name"));

  return (
    <EditableLabel
      labelFactory={(p) => <div {...p} className="flex-fill" />}
      value={name}
      ref={ref}
      doubleClickToEdit
      defaultEditing={defaultEditing}
      inputBoxPlaceholder={studioUiT("{part1} group name", {
        part1: label(VARIANTS_CAP),
      })}
      onEdit={onEdit}
    />
  );
}

export const EditableGroupLabel = React.forwardRef(EditableGroupLabel_);
