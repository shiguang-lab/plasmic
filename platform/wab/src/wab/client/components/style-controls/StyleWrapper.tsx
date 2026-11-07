import { useStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import { DefinedIndicator } from "@/wab/client/components/style-controls/DefinedIndicator";
import {
  getLabelForStyleName,
  StyleComponentContext,
  WithStyleContextMenu,
} from "@/wab/client/components/style-controls/StyleComponent";
import { ensure, ensureArray } from "@/wab/shared/common";
import classNames from "classnames";
import * as React from "react";

export function StyleWrapper(props: {
  styleName: string | string[];
  showDefinedIndicator?: boolean;
  displayStyleName?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const { showDefinedIndicator = false, styleName, displayStyleName, className } = props;
  const context = React.useContext(StyleComponentContext);
  const sc = ensure(context, "StyleWrapper requires a StyleComponent");
  const styleNames = ensureArray(styleName);
  const indicators = useStyleIndicators(sc.props.expsProvider, showDefinedIndicator ? styleNames : []);
    return (
      <WithStyleContextMenu
        className={`style-wrapper ${className}`}
        styleNames={styleNames}
        displayStyleName={displayStyleName}
        sc={sc}
      >
        {showDefinedIndicator && (
          <div
            className={classNames({
              "style-wrapper__defined-container": true,
            })}
          >
            <DefinedIndicator
              type={indicators.filter((indicator) => indicator.source !== "none")}
              label={
                displayStyleName
                  ? getLabelForStyleName(displayStyleName)
                  : styleNames.length === 1
                    ? getLabelForStyleName(styleNames[0])
                    : undefined
              }
            />
          </div>
        )}
        {props.children}
      </WithStyleContextMenu>
    );
}

