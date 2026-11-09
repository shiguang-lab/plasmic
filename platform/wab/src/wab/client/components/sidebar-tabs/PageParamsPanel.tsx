import { StringPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/StringPropEditor";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { LabeledItemRow } from "@/wab/client/components/sidebar/sidebar-helpers";
import { PageParamsTooltip } from "@/wab/client/components/widgets/DetailedTooltips";
import { LabelWithDetailedTooltip } from "@/wab/client/components/widgets/LabelWithDetailedTooltip";
import { UiText } from "@/wab/client/i18n/UiText";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { Component } from "@/wab/shared/model/classes";
import { extractPathParamMetas } from "@/wab/shared/utils/url-utils";
import { useStore } from "zustand";
import { usePageMetadata } from "@/wab/client/components/sidebar-tabs/page-metadata-state";
import { ok } from "neverthrow";
import React from "react";

function PageParamsPanel(props: {
  page: Component;
}) {
  const { page } = props;
  const sc = useStudioCtx();

  const pageMeta = usePageMetadata(page);
  const path = useStore(sc.modelSnapshots.field(pageMeta, "path"));
  const values = useStore(sc.modelSnapshots.field(pageMeta, "params"));
  const params = extractPathParamMetas({ path, params: values });

  if (params.length === 0) {
    return null;
  }

  const changePageParam = async (param: string, value: string) => {
    await sc.change(() => {
      pageMeta.params[param] = value;
      return ok();
    });
  };

  return (
    <SidebarSection
      title={
        <LabelWithDetailedTooltip tooltip={<PageParamsTooltip />}>
          <UiText message={"Preview parameters"} />
        </LabelWithDetailedTooltip>
      }
      isHeaderActive={true}
    >
      {params.map((param) => (
        <LabeledItemRow
          key={param.key}
          label={param.key}
          data-test-id={`page-param-${param.key}`}
        >
          <StringPropEditor
            disabled={false}
            leftAligned={true}
            onChange={(v) => changePageParam(param.key, v)}
            value={values[param.key]}
          />
        </LabeledItemRow>
      ))}
    </SidebarSection>
  );
}

export default PageParamsPanel;
