import configSearch from "@/wab/client/components/style-controls/ConfigSearch.module.scss";
import { ColorSwatch } from "@/wab/client/components/style-controls/ColorSwatch";
import { Matcher } from "@/wab/client/components/view-common";
import { PlainLinkButton } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useToggleDisplayed } from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import { PlusIcon } from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import SearchIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Search";
import { cx, spawn } from "@/wab/shared/common";
import Chroma from "@/wab/shared/utils/color-utils";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button, Input, Space, Tooltip } from "antd";
import Downshift from "downshift";

import React from "react";

const GRID_SIZE = 32;

export interface ColorTokenSelectorRow {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

export const ColorTokenSelector = function ColorTokenSelector(props: {
  rows: readonly ColorTokenSelectorRow[];
  onAddToken: () => void | Promise<void>;
  className?: string;
  autoFocusSearch?: boolean;
  maxRows?: number;
  hideAddToken?: boolean;
}) {
  const { t: uiT } = useI18n();
  const { rows, onAddToken, hideAddToken } = props;
  const maxRows = props.maxRows ?? 5;
  const [query, setQuery] = React.useState("");
  const hasQuery = !!query && query.trim() !== "";
  const matcher = new Matcher(hasQuery ? query : "", {
    matchMiddleOfWord: true,
  });
  const matchedRows = hasQuery
    ? rows.filter(
        (t) =>
          matcher.matches(t.name) || matcher.matches(Chroma.stringify(t.color)),
      )
    : rows;
  const listLayout = hasQuery;
  const inputRef = React.useRef<HTMLInputElement>(null);

  useToggleDisplayed(inputRef, () => {
    if (props.autoFocusSearch && inputRef.current) {
      inputRef.current.focus();
    }
  });

  return (
    <Downshift<ColorTokenSelectorRow>
      selectedItem={null}
      defaultHighlightedIndex={0}
      itemToString={() => ""}
      isOpen={true}
      onSelect={(item) => {
        if (item) {
          item.onSelect();
          setQuery("");
        }
      }}
      itemCount={listLayout ? matchedRows.length : undefined}
    >
      {(downshift) => {
        const inputProps = downshift.getInputProps({
          value: query,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.currentTarget.value),
          onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") { e.stopPropagation(); }
          },
        });
        return (
          <div className={props.className}>
            <Space.Compact block>
              <Input
                {...inputProps}
                className={configSearch.input}
                size="middle"
                ref={(handle) => { inputRef.current = handle?.input ?? null; }}
                prefix={<Icon icon={SearchIcon} className="dimdimfg" />}
                placeholder={uiT("Search for token")}
                aria-label={uiT("Search for token")}
                allowClear
                autoFocus={props.autoFocusSearch}
              />
              {hideAddToken ? null : (
                <Tooltip title={uiT("Create a new color token")}>
                  <Button
                    aria-label={uiT("Create a new color token")}
                    icon={<Icon icon={PlusIcon} />}
                    onClick={() => spawn(onAddToken())}
                  />
                </Tooltip>
              )}
            </Space.Compact>
            <div className="SwatchItemList mt-m" {...downshift.getMenuProps()}>
              <Scrollbar
                defer={false}
                scrollX={false}
                style={{ maxHeight: maxRows * GRID_SIZE, minWidth: 0 }}
              >
                <div
                  style={
                    listLayout
                      ? undefined
                      : {
                          display: "grid",
                          gridTemplateColumns: `repeat(auto-fill, ${GRID_SIZE}px)`,
                          justifyContent: "start",
                        }
                  }
                >
                  {matchedRows.map((token, index) => {
                    const color = Chroma.stringify(token.color);
                    return (
                      <Tooltip
                        key={token.id}
                        title={`${token.name} (${color})`}
                      >
                        {listLayout ? (
                          <div
                            {...downshift.getItemProps({
                              item: token,
                              index,
                              style: { height: GRID_SIZE },
                              className: cx("NamedSwatch pl-m", {
                                "NamedSwatch--highlighted":
                                  downshift.highlightedIndex === index,
                                "NamedSwatch--selected": token.selected,
                              }),
                            })}
                          >
                            <ColorSwatch
                              color={token.color}
                              isSelected={token.selected}
                            />
                            <div className="text-ellipsis ml-m">
                              {matcher.boldSnippets(token.name)} (
                              {matcher.boldSnippets(color)})
                            </div>
                          </div>
                        ) : (
                          <PlainLinkButton
                            onClick={token.onSelect}
                            aria-label={`${token.name} (${color})`}
                            aria-pressed={token.selected}
                            className="flex flex-vcenter flex-hcenter SwatchButton"
                            style={{ width: GRID_SIZE, height: GRID_SIZE }}
                          >
                            <ColorSwatch
                              color={token.color}
                              isSelected={token.selected}
                            />
                          </PlainLinkButton>
                        )}
                      </Tooltip>
                    );
                  })}
                </div>
              </Scrollbar>
            </div>
          </div>
        );
      }}
    </Downshift>
  );
};
