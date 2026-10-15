import ListItem from "@/wab/client/components/ListItem";
import { DataSourceOpExprSummary } from "@/wab/client/components/sidebar-tabs/DataSource/DataSourceOpPicker";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import { ERROR_ICON, NOT_RENDERED_ICON } from "@/wab/client/icons";
import TreeIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Tree";
import UnlockIcon from "@/wab/client/plasmic/plasmic_kit_design_system/PlasmicIcon__Unlock";
import ResponsivenessIcon from "@/wab/client/plasmic/plasmic_kit_design_system/icons/PlasmicIcon__Responsiveness";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { joinReactNodes } from "@/wab/commons/components/ReactUtil";
import { makeVariantName } from "@/wab/shared/Variants";
import { spawn } from "@/wab/shared/common";
import { isPageComponent } from "@/wab/shared/core/components";
import { isTplNamable, isTplSlot, summarizeTpl } from "@/wab/shared/core/tpls";
import {
  ChoicePropValuesLintIssue,
  InvalidDomNestingLintIssue,
  InvalidTplNestingLintIssue,
  InvisibleElementLintIssue,
  LinkedPropDriftLintIssue,
  LintIssue,
  LintIssueType,
  NonCssScreenVariantOverrideLintIssue,
  UnprotectedDataQueryLintIssue,
} from "@/wab/shared/linting/lint-types";
import { Component, TplNode } from "@/wab/shared/model/classes";
import { capitalizeFirst } from "@/wab/shared/strs";
import { Popover } from "antd";
import { observer } from "mobx-react";
import React, { ReactNode } from "react";

export function renderLintIssue(issue: LintIssue) {
  if (issue.type === "non-css-screen-variant-override") {
    return <ScreenVariantOverrideLintIssueRow issue={issue} />;
  } else if (
    issue.type === "invalid-dom-nesting" ||
    issue.type === "invalid-tpl-nesting"
  ) {
    return <InvalidDomNestingLintIssueRow issue={issue} />;
  } else if (issue.type === "invisible-element") {
    return <InvisibleElementLintIssueRow issue={issue} />;
  } else if (issue.type === "choice-prop-values") {
    return <ChoicePropValuesLintIssueRow issue={issue} />;
  } else if (issue.type === "unprotected-data-query") {
    return <UnprotectedDataQuerytLintIssueRow issue={issue} />;
  } else if (issue.type === "linked-prop-drift") {
    return <LinkedPropDriftLintIssueRow issue={issue} />;
  } else {
    return null;
  }
}

export function getLintIssueIcon(type: LintIssueType) {
  if (type === "non-css-screen-variant-override") {
    return <Icon icon={ResponsivenessIcon} />;
  } else if (type === "invalid-dom-nesting" || type === "invalid-tpl-nesting") {
    return <Icon icon={TreeIcon} />;
  } else if (type === "invisible-element") {
    return NOT_RENDERED_ICON;
  } else if (type === "choice-prop-values") {
    return ERROR_ICON;
  } else if (type === "unprotected-data-query") {
    return <Icon icon={UnlockIcon} />;
  } else if (type === "linked-prop-drift") {
    return ERROR_ICON;
  } else {
    return null;
  }
}

export function getLintIssueTypeName(type: LintIssueType) {
  if (type === "non-css-screen-variant-override") {
    return "Non-CSS overrides for responsive variants";
  } else if (type === "invalid-dom-nesting" || type === "invalid-tpl-nesting") {
    return "Invalid DOM nesting";
  } else if (type === "invisible-element") {
    return "Invisible element";
  } else if (type === "unprotected-data-query") {
    return "Unprotected data query";
  } else if (type === "linked-prop-drift") {
    return "Linked prop type mismatch";
  } else {
    return null;
  }
}

function renderIssueListItem(
  content: JSX.Element,
  elaboration: ReactNode = "hello",
) {
  return (
    <ListItem hideIcon style={{ paddingTop: 8, paddingBottom: 8, height: 48 }}>
      <Popover
        trigger={"click"}
        content={<div style={{ maxWidth: 300 }}>{elaboration}</div>}
      >
        <div className={"text-two-lines"} style={{ whiteSpace: "normal" }}>
          {content}
        </div>
      </Popover>
    </ListItem>
  );
}

const SCREEN_VARIANT_OVERRIDE_INSTRUCTIONS = (
  <>
    <p>
      <UiText message="Only Design tab (CSS) overrides are allowed in responsive variants. Do not override text content or attributes/props in responsive variants." />
    </p>
    <p>
      <UiText message="If you set non-CSS overrides in your responsive variant, the base variant will flash onto the screen first before your overrides, leading to a jarring and slow user experience." />
    </p>
    <p>
      <UiText message="If you need different content or attributes/props to appear in different breakpoints, consider using conditional visibility." />
    </p>
    <p>
      <a
        href={
          "https://docs.plasmic.app/learn/page-performance/#avoid-overriding-content-or-props-in-responsive-variants"
        }
        target={"_blank"}
      >
        <UiText message={"Learn more in the docs"} />
      </a>
      .
    </p>
  </>
);

const INVALID_DOM_NESTING_INSTRUCTIONS = (
  <>
    <p>
      <UiText message="HTML forbids certain nested elements, such as links within links, buttons within links, divs within paragraphs, etc." />
    </p>
    <p>
      <UiText message="The browser will try to unnest these illegal nestings, causing the final page to appear broken. Avoid these nestings!" />
    </p>
    <p>
      <a
        href={
          "https://docs.plasmic.app/learn/development-troubleshooting/#hydration-errors"
        }
        target={"_blank"}
      >
        <UiText message={"Learn more in the docs"} />
      </a>
      .
    </p>
  </>
);

const INVISIBLE_ELEMENT_INSTRUCTIONS = (
  <>
    <p>
      <UiText message="It looks like this element is invisible in all variants." />
    </p>
    <p>
      <UiText message="Every element that is invisible still adds to the total weight of the page sent down to the browser." />
    </p>
  </>
);

const PROP_ALLOWED_VALUES_INSTRUCTIONS = (
  <p>
    <UiText message="A choice prop changed its allowed values, and the current prop value is not valid." />
  </p>
);

const LINKED_PROP_DRIFT_INSTRUCTIONS = (
  <p>
    <UiText message="This prop is linked to a component prop whose type no longer matches. Re-link it, or update the component prop to match." />
  </p>
);

const UnprotectedDataQueryInstructions = ({
  currentRole,
  expectedRole,
}: {
  currentRole: string;
  expectedRole: string;
}) => {
  return (
    <>
      <p>
        <UiText message="This data operations has a lower role than the default role set in the project." />
      </p>
      <p>
        <UiText
          message="This may be unprotected data. Change the operation minimum role from {currentRole} to {expectedRole} so that it matches the project auth settings."
          values={{ currentRole, expectedRole }}
        />
      </p>
    </>
  );
};

const ScreenVariantOverrideLintIssueRow = observer(
  function ScreenVariantOverrideLintIssueRow(props: {
    issue: NonCssScreenVariantOverrideLintIssue;
  }) {
    const { issue } = props;
    const studioCtx = useStudioCtx();
    const content = (
      <UiText
        message="{element} overrides {property} in responsive variant {variant}."
        values={{
          element: <TplLink component={issue.component} tpl={issue.tpl} />,
          property:
            issue.prop.type === "attr" ? (
              <UiText
                message="attribute {name}"
                values={{ name: issue.prop.attr }}
              />
            ) : issue.prop.type === "arg" ? (
              <UiText
                message="prop {name}"
                values={{ name: issue.prop.param.variable.name }}
              />
            ) : (
              <UiText message="text content" />
            ),
          variant:
            issue.vs.variants.length === 1 ? (
              <strong>
                {makeVariantName({
                  variant: issue.vs.variants[0],
                  site: studioCtx.site,
                })}
              </strong>
            ) : (
              <UiText
                message="combination {variants}"
                values={{
                  variants: joinReactNodes(
                    issue.vs.variants.map((v) => (
                      <strong key={v.uuid}>
                        {makeVariantName({ variant: v, site: studioCtx.site })}
                      </strong>
                    )),
                    ", ",
                  ),
                }}
              />
            ),
        }}
      />
    );
    return renderIssueListItem(
      content,
      <>
        <p>{content}</p>

        {SCREEN_VARIANT_OVERRIDE_INSTRUCTIONS}
      </>,
    );
  },
);

const InvalidDomNestingLintIssueRow = observer(
  function InvalidDomNestingLintIssueRow(props: {
    issue: InvalidDomNestingLintIssue | InvalidTplNestingLintIssue;
  }) {
    const { issue } = props;
    const content = (
      <UiText
        message="{descendant} inside {ancestor} may render incorrectly."
        values={{
          descendant: (
            <TplLink component={issue.component} tpl={issue.descendantTpl} />
          ),
          ancestor: (
            <TplLink
              component={
                ("ancestorComponent" in issue
                  ? issue.ancestorComponent
                  : undefined) ?? issue.component
              }
              tpl={issue.ancestorTpl}
            />
          ),
        }}
      />
    );

    return renderIssueListItem(
      content,
      <>
        <p>{content}</p>

        {INVALID_DOM_NESTING_INSTRUCTIONS}
      </>,
    );
  },
);

const InvisibleElementLintIssueRow = observer(
  function InvisibleElementLintIssueRow(props: {
    issue: InvisibleElementLintIssue;
  }) {
    const { issue } = props;
    const content = (
      <UiText
        message="{element} is always invisible."
        values={{
          element: <TplLink component={issue.component} tpl={issue.tpl} />,
        }}
      />
    );
    return renderIssueListItem(
      content,
      <>
        <p>{content}</p>
        {INVISIBLE_ELEMENT_INSTRUCTIONS}
      </>,
    );
  },
);

const ChoicePropValuesLintIssueRow = observer(
  function ChoicePropValuesLintIssueRow(props: {
    issue: ChoicePropValuesLintIssue;
  }) {
    const { issue } = props;
    const content = (
      <UiText
        message="{element} prop {prop} value {value} is not allowed"
        values={{
          element: <TplLink component={issue.component} tpl={issue.tpl} />,
          prop: <code>{issue.propName}</code>,
          value: <code>{JSON.stringify(issue.value)}</code>,
        }}
      />
    );
    return renderIssueListItem(
      content,
      <>
        <p>{content}</p>
        <p>
          <UiText
            message="Allowed values: {values}"
            values={{
              values: <code>{JSON.stringify(issue.allowedValues)}</code>,
            }}
          />
        </p>
        {PROP_ALLOWED_VALUES_INSTRUCTIONS}
      </>,
    );
  },
);

const LinkedPropDriftLintIssueRow = observer(
  function LinkedPropDriftLintIssueRow(props: {
    issue: LinkedPropDriftLintIssue;
  }) {
    const { issue } = props;
    const content = (
      <UiText
        message="{element} prop {prop} no longer matches the linked component prop"
        values={{
          element: <TplLink component={issue.component} tpl={issue.tpl} />,
          prop: <strong>{issue.propName}</strong>,
        }}
      />
    );
    return renderIssueListItem(
      content,
      <>
        <p>{content}</p>
        {LINKED_PROP_DRIFT_INSTRUCTIONS}
      </>,
    );
  },
);

const UnprotectedDataQuerytLintIssueRow = observer(
  function UnprotectedDataQuerytLintIssueRow(props: {
    issue: UnprotectedDataQueryLintIssue;
  }) {
    const { issue } = props;
    const content = (
      <UiText
        message="{owner} has an unprotected query {query}"
        values={{
          owner: issue.tpl ? (
            <TplLink component={issue.component} tpl={issue.tpl} />
          ) : (
            <UiText
              message="{component} data queries"
              values={{
                component: <ComponentLink component={issue.component} />,
              }}
            />
          ),
          query: <DataSourceOpExprSummary expr={issue.expr} />,
        }}
      />
    );
    return renderIssueListItem(
      content,
      <>
        <p>{content}</p>
        <UnprotectedDataQueryInstructions
          currentRole={issue.currentRole}
          expectedRole={issue.expectedRole}
        />
      </>,
    );
  },
);

const TplLink = observer(function TplLink(props: {
  component: Component;
  tpl: TplNode;
}) {
  const { component, tpl } = props;
  const studioCtx = useStudioCtx();
  return (
    <a
      onClick={() => {
        spawn(studioCtx.setStudioFocusOnTpl(component, tpl));
      }}
    >
      {isTplNamable(tpl) && tpl.name ? (
        <>
          <UiText message={"Element"} /> <strong>{tpl.name}</strong>
        </>
      ) : isTplSlot(tpl) ? (
        <>
          <UiText
            message="Slot target {name}"
            values={{ name: <strong>{tpl.param.variable.name}</strong> }}
          />
        </>
      ) : (
        <UiText
          message="{part1} element"
          values={{
            part1: <UiLabel text={capitalizeFirst(summarizeTpl(tpl))} />,
          }}
        />
      )}
    </a>
  );
});

const ComponentLink = observer(function ComponentLink(props: {
  component: Component;
}) {
  const { component } = props;
  const studioCtx = useStudioCtx();
  return (
    <a
      onClick={() => {
        spawn(studioCtx.setStudioFocusOnTpl(component, component.tplTree));
      }}
    >
      {isPageComponent(component) ? (
        <UiText message={"Page"} />
      ) : (
        <UiText message={"Component"} />
      )}{" "}
      {component.name}
    </a>
  );
});
