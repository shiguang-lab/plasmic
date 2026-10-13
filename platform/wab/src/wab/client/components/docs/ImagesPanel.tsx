import { useDocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import ImageListItem from "@/wab/client/components/docs/ImageListItem";
import { Matcher } from "@/wab/client/components/view-common";
import { useI18n } from "@/wab/client/i18n";
import {
  DefaultImagesPanelProps,
  PlasmicImagesPanel,
} from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicImagesPanel";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Alert } from "antd";
import { observer } from "mobx-react";
import * as React from "react";

type ImagesPanelProps = DefaultImagesPanelProps;

const ImagesPanel = observer(function ImagesPanel(props: ImagesPanelProps) {
  const { t: studioUiT } = useI18n();

  const docsCtx = useDocsPortalCtx();
  const [query, setQuery] = React.useState("");
  const matcher = new Matcher(query);
  const icons = docsCtx.studioCtx.site.imageAssets.filter(
    (value) =>
      value.type === ImageAssetType.Icon &&
      !!value.dataUri &&
      matcher.matches(value.name),
  );

  return (
    <PlasmicImagesPanel
      {...props}
      componentsContainer={{
        as: Scrollbar,
        style: { flex: 1, minHeight: 0, height: "auto", overflow: "hidden" },
        props: { scrollX: false },
      }}
      searchbox={{
        value: query,
        onChange: (e) => setQuery(e.target.value),
        autoFocus: true,
      }}
    >
      <>
        {icons.map((icon) => (
          <ImageListItem key={icon.uid} icon={icon} docsCtx={docsCtx} />
        ))}

        {icons.length === 0 && (
          <Alert
            className="m-m"
            style={{ width: "100%" }}
            type="warning"
            showIcon
            message={studioUiT("No icons.")}
          />
        )}
      </>
    </PlasmicImagesPanel>
  );
});

export default ImagesPanel;
