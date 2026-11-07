import type { Field, NameLabelPair } from "@react-querybuilder/core";
import { ContextDependentConfig } from "./shared-controls";

/** Native react-querybuilder fields and serializable editor options. */
export interface QueryBuilderConfig {
  fields: Field[];
  combinators?: NameLabelPair[];
  showNotToggle?: boolean;
  maxLevels?: number;
  showAddGroupAction?: boolean;
}

/** A condition editor whose value is JsonLogic. */
export interface QueryBuilderCore<Ctx extends any[]> {
  type: "queryBuilder";
  config: ContextDependentConfig<Ctx, QueryBuilderConfig>;
}
