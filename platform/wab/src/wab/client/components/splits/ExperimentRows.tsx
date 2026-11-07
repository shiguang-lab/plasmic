import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { UiText } from "@/wab/client/i18n/UiText";
import PlasmicExperimentRow from "@/wab/client/plasmic/plasmic_kit_optimize/PlasmicExperimentRow";
import PlasmicExperimentRows from "@/wab/client/plasmic/plasmic_kit_optimize/PlasmicExperimentRows";
import type { ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import { SplitType } from "@/wab/shared/core/splits";
import { Split } from "@/wab/shared/model/classes";
import { Menu } from "antd";
import * as React from "react";
import { useStore } from "zustand";

interface ExperimentRowsProps {
  splits: readonly ModelRef<Split>[];
  type: SplitType;
  onClick: (_: Split) => void;
  onDelete?: (_: Split) => void;
}

export function ExperimentRows({ splits, ...props }: ExperimentRowsProps) {
  return (
    <PlasmicExperimentRows>
      {splits.map((split) => <ExperimentRow key={split.uid} split={split} {...props} />)}
    </PlasmicExperimentRows>
  );
}

function ExperimentRow({ split: splitRef, type, onClick, onDelete }: Omit<ExperimentRowsProps, "splits"> & { split: ModelRef<Split> }) {
  const models = useStudioCtx().modelSnapshots;
  const split = models.resolve(splitRef);
  const splitType = useStore(models.field(split, "splitType"));
  return splitType === type
    ? <ExperimentRowContent split={split} onClick={onClick} onDelete={onDelete} />
    : null;
}

function ExperimentRowContent({ split, onClick, onDelete }: Pick<ExperimentRowsProps, "onClick" | "onDelete"> & { split: Split }) {
  const models = useStudioCtx().modelSnapshots;
  const name = useStore(models.field(split, "name"));
  const status = useStore(models.field(split, "status"));
  return (
    <PlasmicExperimentRow
      title={name}
      status={status}
      onClick={() => onClick(split)}
      listItem={{
        height: 48,
        menu: onDelete ? (
          <Menu>
            <Menu.Item onClick={() => onDelete(split)}>
              <UiText message={"Delete"} />
            </Menu.Item>
          </Menu>
        ) : undefined,
      }}
    />
  );
}
