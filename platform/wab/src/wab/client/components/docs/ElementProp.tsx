import { WithContextMenu } from "@/wab/client/components/ContextMenu";
import { DocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { iconForTplType } from "@/wab/client/icons";
import { DocsElement } from "@/wab/client/components/docs/docs-model-projections";
import { useDocsFocusedComponentRef } from "@/wab/client/components/docs/DocsModelResources";
import { TriggerTarget } from "@/wab/client/components/widgets/TriggerAnchor";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { PlasmicElementProp } from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicElementProp";
import { ensure } from "@/wab/shared/common";
import { Dropdown, Menu } from "antd";
import * as React from "react";

interface ElementPropProps {
  docsCtx: DocsPortalCtx;
  node: DocsElement;
}

function ElementProp(props: ElementPropProps) {
  const { t: studioUiT } = useI18n();

  const { docsCtx, node } = props;
  const { name, isRoot } = node;
  const componentRef = ensure(useDocsFocusedComponentRef(docsCtx), "Missing focused component");
  const component = docsCtx.models.snapshots.resolve(componentRef);

  const renderElementMenu = () => {
    return (
      <Menu onClick={(e) => e.domEvent.stopPropagation()}>
        {!node.isComponent && (
          <Menu.Item
            onClick={() =>
              docsCtx.setComponentOverride(
                component,
                isRoot ? "onClick" : name,
                isRoot ? [] : ["props", "onClick"],
                "(e) => null",
                isRoot,
              )
            }
          >
            {" "}
            <UiText message={"Attach event listeners"} />{" "}
          </Menu.Item>
        )}

        {!node.isComponent && (
          <Menu.Item
            onClick={() =>
              docsCtx.setComponentOverride(
                component,
                isRoot ? "children" : name,
                isRoot ? [] : ["props", "children"],
                "null",
                isRoot,
              )
            }
          >
            {" "}
            <UiText message={"Override content"} />{" "}
          </Menu.Item>
        )}

        <Menu.Item
          onClick={() =>
            docsCtx.setComponentOverride(
              component,
              name,
              ["props"],
              "{}",
              false,
            )
          }
        >
          {" "}
          <UiText message={"Override props"} />{" "}
        </Menu.Item>
        <Menu.Item
          onClick={() =>
            docsCtx.setComponentOverride(
              component,
              name,
              ["wrap"],
              "(content) => content",
              false,
            )
          }
        >
          {" "}
          <UiText message={"Wrap element"} />{" "}
        </Menu.Item>
        <Menu.Item
          onClick={() =>
            docsCtx.setComponentOverride(
              component,
              name,
              ["render"],
              "() => null",
              false,
            )
          }
        >
          {" "}
          <UiText message={"Replace element"} />{" "}
        </Menu.Item>
        {!node.isComponent && (
          <Menu.Item
            onClick={() =>
              docsCtx.setComponentOverride(
                component,
                name,
                ["wrapChildren"],
                '(children) => <>{children}{"new children"}</>',
                false,
              )
            }
          >
            {" "}
            <UiText message={"Insert additional children"} />{" "}
          </Menu.Item>
        )}

        {!node.isComponent && (
          <Menu.Item
            onClick={() =>
              docsCtx.setComponentOverride(
                component,
                name,
                ["as"],
                '"div"',
                false,
              )
            }
          >
            {" "}
            <UiText message={"Override element type"} />{" "}
          </Menu.Item>
        )}
      </Menu>
    );
  };

  return (
    <WithContextMenu overlay={renderElementMenu}>
      <PlasmicElementProp
        label={name}
        icon={<Icon icon={iconForTplType(node.iconType)} />}
        onMouseEnter={() => docsCtx.setFocusedElement(docsCtx.models.snapshots.resolve(node.ref))}
        onMouseLeave={() => docsCtx.setFocusedElement(undefined)}
        addButton={{
          props: {
            tooltip: studioUiT("Add override props"),
            tooltipPlacement: "right",
          },

          wrap: (x) => (
            <Dropdown popupRender={renderElementMenu} trigger={["click"]}>
              <TriggerTarget>{x}</TriggerTarget>
            </Dropdown>
          ),
        }}
        elementType={`<${node.elementType} />`}
      />
    </WithContextMenu>
  );
}

export default ElementProp;
