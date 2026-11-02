import { PropEditorRowWrapper } from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import Button from "@/wab/client/components/widgets/Button";
import { UiText } from "@/wab/client/i18n/UiText";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { isKnownFunctionType } from "@/wab/shared/model/classes";
import { observer } from "mobx-react";
import React from "react";

export const CanvasComponentPartSection = observer(function CanvasComponentPartSection({
  viewCtx, interactions,
}: { viewCtx: ViewCtx; interactions: boolean }) {
  const part = viewCtx.inspectorComponentPart();
  if (!part) {
    return null;
  }
  const expsProvider = new TplExpsProvider(viewCtx, part.tpl);
  return (
    <SidebarSection title={part.displayName}>
      <div className="panel-row">
        <Button onClick={() => viewCtx.setFocusedComponentPart(undefined)}>
          <UiText message="Select component" />
        </Button>
      </div>
      {part.props.map((name) => {
        const param = part.tpl.component.params.find((p) => p.variable.name === name);
        return param && isKnownFunctionType(param.type) === interactions ? (
          <PropEditorRowWrapper key={param.uuid} viewCtx={viewCtx} tpl={part.tpl} param={param} expsProvider={expsProvider} />
        ) : null;
      })}
    </SidebarSection>
  );
});
