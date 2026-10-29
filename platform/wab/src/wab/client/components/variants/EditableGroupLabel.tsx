import {
  EditableLabel,
  EditableLabelHandles,
} from "@/wab/client/components/widgets/EditableLabel";
import { useI18n } from "@/wab/client/i18n";
import { VARIANTS_CAP } from "@/wab/shared/Labels";
import { VariantGroup } from "@/wab/shared/model/classes";
import { observer } from "mobx-react";
import * as React from "react";

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

  return (
    <EditableLabel
      labelFactory={(p) => <div {...p} className="flex-fill" />}
      value={group.param.variable.name}
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

export const EditableGroupLabel = observer(
  React.forwardRef(EditableGroupLabel_),
);
