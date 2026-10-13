import { useCmsLayoutStyles } from "@/wab/client/components/cms/CmsLayout.styles";
import { PlasmicCmsEntryDetails } from "@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsEntryDetails";
import { PlasmicCmsModelDetails } from "@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsModelDetails";
import { PlasmicCmsSettingsPage } from "@/wab/client/plasmic/plasmic_kit_cms/PlasmicCmsSettingsPage";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import * as React from "react";

// Reuse the generated header nodes, while the shared Scrollbar owns the body.
export const CmsDetailsLayout = React.forwardRef<
  HTMLDivElement,
  React.PropsWithChildren<{ className?: string; header?: React.ReactNode }>
>(function CmsDetailsLayout({ className, header, children }, ref) {
  const { styles, cx } = useCmsLayoutStyles();
  return (
    <div ref={ref} className={cx(className, styles.details)}>
      {header && <div className={styles.detailsHeader}>{header}</div>}
      <Scrollbar scrollX={false} className={styles.detailsBody}>
        <div className={styles.detailsContent}>{children}</div>
      </Scrollbar>
    </div>
  );
});

export const CmsEntryDetailsLayout = React.forwardRef<
  HTMLDivElement,
  Pick<
    React.ComponentProps<typeof PlasmicCmsEntryDetails>,
    | "className"
    | "children"
    | "entryName"
    | "entryNameValue"
    | "saveStatus"
    | "historyButton"
    | "previewButton"
    | "publishButton"
    | "menuButton"
  >
>(function CmsEntryDetailsLayout(
  {
    className,
    children,
    entryName,
    entryNameValue,
    saveStatus,
    historyButton,
    previewButton,
    publishButton,
    menuButton,
  },
  ref,
) {
  return (
    <CmsDetailsLayout
      ref={ref}
      className={className}
      header={
        <>
          <PlasmicCmsEntryDetails.left
            entryName={entryName}
            entryNameValue={entryNameValue}
            saveStatus={saveStatus}
          />
          <PlasmicCmsEntryDetails.right
            historyButton={historyButton}
            previewButton={previewButton}
            publishButton={publishButton}
            menuButton={menuButton}
          />
        </>
      }
    >
      {children}
    </CmsDetailsLayout>
  );
});

export const CmsModelDetailsLayout = React.forwardRef<
  HTMLDivElement,
  Pick<
    React.ComponentProps<typeof PlasmicCmsModelDetails>,
    | "className"
    | "children"
    | "modelName"
    | "modelNameValue"
    | "saveButton"
    | "menuButton"
  >
>(function CmsModelDetailsLayout(
  { className, children, modelName, modelNameValue, saveButton, menuButton },
  ref,
) {
  return (
    <CmsDetailsLayout
      ref={ref}
      className={className}
      header={
        <>
          <PlasmicCmsModelDetails.left
            modelName={modelName}
            modelNameValue={modelNameValue}
          />
          <PlasmicCmsModelDetails.right
            saveButton={saveButton}
            menuButton={menuButton}
          />
        </>
      }
    >
      {children}
    </CmsDetailsLayout>
  );
});

export const CmsSettingsLayout = React.forwardRef<
  HTMLDivElement,
  Pick<
    React.ComponentProps<typeof PlasmicCmsSettingsPage>,
    "className" | "details" | "duplicateButton" | "saveButton"
  > & {
    content: React.ReactNode;
  }
>(function CmsSettingsLayout(
  { className, content, details, duplicateButton, saveButton },
  ref,
) {
  return (
    <CmsDetailsLayout
      ref={ref}
      className={className}
      header={
        <>
          <PlasmicCmsSettingsPage.left details={details} />
          <PlasmicCmsSettingsPage.right
            duplicateButton={duplicateButton}
            saveButton={saveButton}
          />
        </>
      }
    >
      {content}
    </CmsDetailsLayout>
  );
});
