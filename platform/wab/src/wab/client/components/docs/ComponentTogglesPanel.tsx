import { CodeSnippet } from "@/wab/client/components/coding/CodeDisplay";
import { useDocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import { DocsTooltip } from "@/wab/client/components/docs/DocsTooltip";
import ElementProp from "@/wab/client/components/docs/ElementProp";
import LinkedProp from "@/wab/client/components/docs/LinkedProp";
import SlotProp from "@/wab/client/components/docs/SlotProp";
import VariantProp from "@/wab/client/components/docs/VariantProp";
import { SidebarModalProvider } from "@/wab/client/components/sidebar/SidebarModal";
import { UiText } from "@/wab/client/i18n/UiText";
import { PlasmicComponentTogglesPanel } from "@/wab/client/plasmic/plasmic_kit_docs_portal/PlasmicComponentTogglesPanel";
import { DocsComponentModel } from "@/wab/client/components/docs/docs-model-projections";
import { useDocsFocusedComponentRef } from "@/wab/client/components/docs/DocsModelResources";
import type { ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { Component } from "@/wab/shared/model/classes";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import * as React from "react";
import { useLocalStorage } from "react-use";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

interface ComponentTogglesPanelProps {}

function ComponentTogglesPanel(_props: ComponentTogglesPanelProps) {
  const docsCtx = useDocsPortalCtx();
  const ref = useDocsFocusedComponentRef(docsCtx);
  return ref ? <FocusedComponentTogglesPanel docsCtx={docsCtx} componentRef={ref} /> : null;
}

function FocusedComponentTogglesPanel({ docsCtx, componentRef }: { docsCtx: ReturnType<typeof useDocsPortalCtx>; componentRef: ModelRef<Component> }) {
  const component = useStore(docsCtx.models.getComponentStore(componentRef), useShallow((state) => ({ variantGroups: state.variantGroups, slots: state.slots, linkedProps: state.linkedProps, elements: state.elements, exportedName: state.exportedName, plasmicName: state.plasmicName })));
  const useLoader = useStore(
    docsCtx.store,
    (state) => state.codegenType === "loader",
  );

  const [dismissed, setDismissed] = useLocalStorage(
    "ComponentTogglesPanel--dismissComponentInfo",
    false,
  );

  const variantGroups = component.variantGroups;
  const slots = component.slots;
  const otherProps = component.linkedProps;
  const namedNodes = component.elements;

  return (
    <SidebarModalProvider>
      <PlasmicComponentTogglesPanel
        body={{
          as: Scrollbar,
          style: { overflow: "hidden" },
          props: { scrollX: false },
        }}
        explanation={{
          defaultExpanded: !dismissed,
          children: (isExpanded) =>
            useLoader ? (
              <CmsComponentMessage
                component={component}
                isExpanded={isExpanded}
              />
            ) : (
              <BlackboxComponentMessage
                component={component}
                isExpanded={isExpanded}
              />
            ),

          onToggle: (expanded) => {
            if (!expanded && !dismissed) {
              setDismissed(true);
            }
          },
        }}
        header={
          useLoader
            ? component.exportedName
            : component.plasmicName
        }
        variantsHeader={
          variantGroups.length === 0
            ? { render: () => null }
            : {
                wrapChildren: (content) => (
                  <>
                    {content}
                    <VariantPropsTooltip />
                  </>
                ),
              }
        }
        variantPropsContainer={{
          ...(variantGroups.length === 0 && { render: () => null }),
        }}
        variantProps={variantGroups.map((group) => (
          <VariantProp key={group.ref.uid} docsCtx={docsCtx} group={group} />
        ))}
        slotPropsHeader={
          slots.length === 0
            ? { render: () => null }
            : {
                wrapChildren: (content) => (
                  <>
                    {content}
                    <SlotPropsTooltip />
                  </>
                ),
              }
        }
        slotPropsContainer={{
          ...(slots.length === 0 && { render: () => null }),
        }}
        slotProps={slots.map((slot) => (
          <SlotProp key={slot.ref.uid} docsCtx={docsCtx} slot={slot} />
        ))}
        linkedPropsHeader={{
          ...(otherProps.length === 0 && { render: () => null }),
        }}
        linkedPropsContainer={{
          ...(otherProps.length === 0 && { render: () => null }),
        }}
        linkedProps={otherProps.map((prop) => (
          <LinkedProp key={prop.param.uid} docsCtx={docsCtx} param={prop} />
        ))}
        elementPropsHeader={
          namedNodes.length === 0
            ? { render: () => null }
            : {
                wrapChildren: (content) => (
                  <>
                    {content}
                    <ElementPropsTooltip />
                  </>
                ),
              }
        }
        elementPropsContainer={{
          ...(namedNodes.length === 0 && { render: () => null }),
        }}
        elementProps={namedNodes.map((node) => (
          <ElementProp
            key={node.uuid}
            docsCtx={docsCtx}
            node={node}
          />
        ))}
        resetButton={{
          onClick: () => docsCtx.resetComponentToggles(docsCtx.models.snapshots.resolve(componentRef)),
        }}
      />
    </SidebarModalProvider>
  );
}

export default ComponentTogglesPanel;

function CmsComponentMessage(props: {
  component: Pick<DocsComponentModel, "exportedName" | "plasmicName">;
  isExpanded: boolean;
}) {
  const componentName = props.component.exportedName;
  if (!props.isExpanded) {
    return (
      <span>
        {" "}
        <UiText message={"To render"} /> <strong>{componentName}</strong>{" "}
        <UiText message={"with PlasmicComponent"} />{" "}
      </span>
    );
  }
  return (
    <div>
      {" "}
      <UiText message={"To render"} />{" "}
      <strong>
        <code>{componentName}</code>
      </strong>{" "}
      <UiText
        message={
          'with PlasmicComponent, simply pass it as the "component" prop.'
        }
      />{" "}
    </div>
  );
}
function BlackboxComponentMessage(props: {
    component: Pick<DocsComponentModel, "exportedName" | "plasmicName">;
    isExpanded: boolean;
  }) {
    const { component, isExpanded } = props;
    const firstSentence = (
      <>
        {" "}
        <UiText message={"For"} />{" "}
        <strong>
          <code>{component.exportedName}</code>
        </strong>{" "}
        <UiText message={", Plasmic generates two React components:"} />{" "}
      </>
    );

    if (!isExpanded) {
      return <span>{firstSentence}</span>;
    } else {
      return (
        <div className={"vlist-gap-sm"}>
          <p>{firstSentence}</p>
          <ul className="disc-list">
            <li>
              <strong>
                <code>{component.plasmicName}</code>
              </strong>{" "}
              <UiText
                message={
                  ": a purely presentational component, for rendering the design. Will be updated by Plasmic when design changes."
                }
              />{" "}
            </li>
            <li>
              <strong>
                <code>{component.exportedName}</code>
              </strong>{" "}
              <UiText
                message={
                  ": a wrapper component, owned by you, where you instantiate"
                }
              />{" "}
              <code>{component.plasmicName}</code>{" "}
              <UiText message={"and attach state, data, and behavior."} />{" "}
            </li>
          </ul>
          <p>
            {" "}
            <UiText
              message={"Try the different props and overrides you can pass to"}
            />{" "}
            <code>{component.exportedName}</code>{" "}
            <UiText message={"component below."} />{" "}
            <a
              href="https://www.plasmic.app/learn/codegen-guide/"
              target="_blank"
            >
              {" "}
              <UiText message={"See details"} />{" "}
            </a>
            .
          </p>
        </div>
      );
    }
  }

function VariantPropsTooltip() {
  return (
    <DocsTooltip>
      {" "}
      <UiText
        message={
          "Each variant is exposed as a React prop. For toggle variants, pass a boolean; for single-choice variants, pass an option string; for multi-choice variants, pass an array of options or an object mapping option to"
        }
      />{" "}
      <code>true</code> <UiText message={"or"} /> <code>false</code>.{" "}
      <a
        href="https://www.plasmic.app/learn/codegen-guide/#variant-props"
        target="_blank"
      >
        <UiText message={"Learn more."} />
      </a>
    </DocsTooltip>
  );
}

function SlotPropsTooltip() {
  return (
    <DocsTooltip>
      {" "}
      <UiText
        message={"Each slot is exposed as a React prop; pass in any"}
      />{" "}
      <code>React.ReactNode</code>{" "}
      <UiText message={"to customize the content of each slot."} />{" "}
      <a
        href="https://www.plasmic.app/learn/codegen-guide/#slot-props"
        target="_blank"
      >
        <UiText message={"Learn more."} />
      </a>
    </DocsTooltip>
  );
}

function ElementPropsTooltip() {
  return (
    <DocsTooltip placement="right" maxWidth={400}>
      {() => (
        <>
          {" "}
          <UiText
            message={
              "Each element with a name in Plasmic can be customized with these element override props. You can attach event handlers, modify content or attributes, add wrappers, or completely replace an element with something else. Some examples below:"
            }
          />{" "}
          <CodeSnippet language="typescript" className="mt-m">
            {`
element={{
  // Override the element type
  as: "button",

  // Attach event handlers (or add any prop)
  props: {
    onClick: () => ...
  },

  // Wrap with an element
  wrap: content => <Tooltip>{content}</Tooltip>,

  // Insert a child at the end
  wrapChildren: children => (
    <>{children}<InfoPopup /></>
  )
}}

// Completely replace with something else
element={{
  render: (ps) => <Link to="..." {...ps} />
}}

// Don't render at all
element={{
  render: () => null
}}
            `.trim()}
          </CodeSnippet>
          <a
            href="https://www.plasmic.app/learn/codegen-guide/#override-props"
            target="_blank"
          >
            <UiText message={"Learn more."} />
          </a>
        </>
      )}
    </DocsTooltip>
  );
}
