import sty from "@/wab/client/components/sidebar-tabs/ListStyleSection.module.scss";
import {
  FullRow,
  LabeledStyleSelectItem,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import {
  ExpsProvider,
  StylePanelSection,
} from "@/wab/client/components/style-controls/StyleComponent";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { listStyleCssProps } from "@/wab/shared/core/style-props";
import { observer } from "mobx-react";
import * as React from "react";

export const ListStyleSection = observer(ListStyleSection_);

function ListStyleSection_(props: { expsProvider: ExpsProvider }) {
  const { t: uiT } = useI18n();
  const { expsProvider } = props;

  return (
    <StylePanelSection
      title={"List"}
      expsProvider={expsProvider}
      styleProps={listStyleCssProps}
    >
      <FullRow>
        <LabeledStyleSelectItem
          styleName={"list-style-type"}
          tooltip={`List Style Type`}
          label={uiT("Type")}
          textRight={false}
          selectOpts={{
            options: [
              {
                value: "none",
                label: (
                  <span className="flex-vcenter">
                    <span className={sty.selectIcon}>&nbsp;</span>{" "}
                    <UiText message={"None"} />
                  </span>
                ),
              },
              {
                value: "disc",
                label: (
                  <span className="flex-vcenter">
                    <span className={sty.selectIcon}>•</span>{" "}
                    <UiText message={"Disc"} />
                  </span>
                ),
              },
              {
                value: "circle",
                label: (
                  <span className="flex-vcenter">
                    <span className={sty.selectIcon}>○</span>{" "}
                    <UiText message={"Circle"} />
                  </span>
                ),
              },
              {
                value: "square",
                label: (
                  <span className="flex-vcenter">
                    <span className={sty.selectIcon}>■</span>{" "}
                    <UiText message={"Square"} />
                  </span>
                ),
              },
              {
                value: "decimal",
                label: (
                  <span className="flex-vcenter">
                    <span className={sty.selectIcon}>1.</span>{" "}
                    <UiText message={"Decimal"} />
                  </span>
                ),
              },
              {
                value: "decimal-leading-zero",
                label: (
                  <span className="flex-vcenter">
                    <span className={sty.selectIcon}>01.</span>{" "}
                    <UiText message={"Decimal with leading zero"} />
                  </span>
                ),
              },
              {
                value: "upper-roman",
                label: (
                  <span className="flex-vcenter">
                    <span className={sty.selectIcon}>I.</span>{" "}
                    <UiText message={"Uppercase roman numerals"} />
                  </span>
                ),
              },
              {
                value: "lower-roman",
                label: (
                  <span className="flex-vcenter">
                    <span className={sty.selectIcon}>i.</span>{" "}
                    <UiText message={"Lowercase roman numerals"} />
                  </span>
                ),
              },
              {
                value: "upper-alpha",
                label: (
                  <span className="flex-vcenter">
                    <span className={sty.selectIcon}>A.</span>{" "}
                    <UiText message={"Uppercase letters"} />
                  </span>
                ),
              },
              {
                value: "lower-alpha",
                label: (
                  <span className="flex-vcenter">
                    <span className={sty.selectIcon}>a.</span>{" "}
                    <UiText message={"Lowercase letters"} />
                  </span>
                ),
              },
            ],
          }}
        />
      </FullRow>
      <FullRow>
        <LabeledStyleSelectItem
          styleName={"list-style-position"}
          tooltip={`List Style Position`}
          label={uiT("Position")}
          textRight={false}
          selectOpts={{
            options: [
              { value: "outside", label: "Outside" },
              { value: "inside", label: uiT("Inside") },
            ],
          }}
        />
      </FullRow>
    </StylePanelSection>
  );
}
