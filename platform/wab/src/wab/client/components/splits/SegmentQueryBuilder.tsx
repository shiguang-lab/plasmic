import "@/wab/client/components/QueryBuilder/QueryBuilder.scss";
import {
  AwesomeBuilder,
  QueryBuilderConfig,
} from "@/wab/client/components/QueryBuilder/QueryBuilderConfig";
import { getEmptyTree } from "@/wab/client/components/QueryBuilder/query-builder-utils";
import { getUiLocale, useI18n } from "@/wab/client/i18n";
import { translate } from "@/wab/client/i18n/locales";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { TraitMeta, TraitRegistration } from "@plasmicapp/host";
import {
  Config,
  Field,
  ImmutableTree,
  Utils as QbUtils,
  Query,
} from "@react-awesome-query-builder/antd";
import * as React from "react";

const InitialConfig = QueryBuilderConfig;

const baseConfig = {
  ...InitialConfig,
  fields: {
    time: {
      label: "Time",
      fieldName: "time",
      type: "datetime",
      excludeOperators: ["is_null", "is_not_null"],
    } as Field,
  },
} as Config;

interface SegmentQueryBuilderProps {
  saveLogic: (logic: any) => void;
  logic: any;
}

function convertRegisteredTraitsToQBuilder(traits: TraitRegistration[]) {
  function convertMeta(meta: TraitMeta) {
    if (meta.type === "choice") {
      return {
        type: "select",
        fieldSettings: {
          listValues: meta.options.map((option) => ({
            value: option,
            title: option,
          })),
        },
      };
    }
    return {
      type: meta.type,
    };
  }
  return Object.fromEntries(
    traits.map(({ trait, meta }) => {
      return [
        trait,
        {
          label: meta.label ?? trait,
          ...convertMeta(meta),
        },
      ];
    }),
  );
}

function SegmentQueryBuilder_(
  props: SegmentQueryBuilderProps,
  outerRef: React.Ref<HTMLDivElement>,
) {
  const { logic, saveLogic } = props;
  const { t } = useI18n();

  const studioCtx = useStudioCtx();
  const registeredTraits = studioCtx.getRegisteredTraits();

  const config = {
    ...baseConfig,
    fields: {
      ...baseConfig.fields,
      time: { ...baseConfig.fields.time, label: t("Time") },
      ...convertRegisteredTraitsToQBuilder(registeredTraits),
    },
  } as Config;

  const [state, setState] = React.useState<{
    tree: ImmutableTree;
  }>({
    tree:
      QbUtils.loadFromJsonLogic(logic, config) ??
      QbUtils.loadTree(getEmptyTree(config, { appendFirstField: true })),
  });
  const handleChange = (_tree: ImmutableTree) => {
    setState({ tree: _tree });
    const jsonLogic = QbUtils.jsonLogicFormat(_tree, config);
    if ((jsonLogic.errors ?? []).length === 0) {
      saveLogic(jsonLogic.logic);
    }
  };

  return (
    <div className="plasmic-query-builder-scope" ref={outerRef}>
      <Query
        {...config}
        value={state.tree}
        onChange={handleChange}
        renderBuilder={AwesomeBuilder}
      />
    </div>
  );
}

export function getHumanFormatRules(logic: any) {
  const studioCtx = useStudioCtx();
  const registeredTraits = studioCtx.getRegisteredTraits();

  const config = {
    ...baseConfig,
    fields: {
      ...baseConfig.fields,
      time: {
        ...baseConfig.fields.time,
        label: translate(getUiLocale(), "Time"),
      },
      ...convertRegisteredTraitsToQBuilder(registeredTraits),
    },
  } as Config;
  const tree = QbUtils.loadFromJsonLogic(logic, config);
  if (!tree) {
    return "";
  }
  return QbUtils.queryString(tree, config, true);
}

const SegmentQueryBuilder = React.forwardRef(SegmentQueryBuilder_);
export default SegmentQueryBuilder;
