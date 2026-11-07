import { PublicLink } from "@/wab/client/components/PublicLink";
import { DocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import { ImagePreview } from "@/wab/client/components/style-controls/ImageSelector";
import {
  DefaultImageListItemProps,
  PlasmicImageListItem,
} from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicImageListItem";
import { toClassName } from "@/wab/shared/codegen/util";
import { asOne, ensure } from "@/wab/shared/common";
import { DocsIconRow, useDocsFocusedIconRef } from "@/wab/client/components/docs/DocsModelResources";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import * as React from "react";
import { useStore } from "zustand";

interface ImageListItemProps extends Omit<DefaultImageListItemProps, "icon"> {
  icon: DocsIconRow;
  docsCtx: DocsPortalCtx;
}

function ImageListItem(
  props: ImageListItemProps,
) {
  const { icon, docsCtx, ...rest } = props;
  const projectId = useStore(docsCtx.studioCtx.projectMetadataStore, (state) => state.id);
  const focused = useDocsFocusedIconRef(docsCtx);
  const selected = focused === icon.ref;
  const codegenType = useStore(docsCtx.store, (state) => state.codegenType);
  return (
    <PlasmicImageListItem
      {...rest}
      root={{
        render: ({ children, ...rest2 }) => {
          return (
            <PublicLink
              {...(rest2 as any)}
              children={asOne(children)}
              href={APP_ROUTES.projectDocsIcon.fill({
                projectId,
                iconIdOrClassName: toClassName(icon.name) || icon.uuid,
                codegenType: codegenType,
              })}
            />
          );
        },
      }}
      isSelected={selected}
      icon={
        <ImagePreview
          uri={ensure(icon.dataUri, "must have dataUri")}
          className="mr-ch"
          style={{
            width: 16,
            height: 16,
          }}
        />
      }
    >
      {icon.name}
    </PlasmicImageListItem>
  );
}

export default ImageListItem;
