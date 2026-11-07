import { ColorSwatch } from "@/wab/client/components/style-controls/ColorSwatch";
import { Matcher } from "@/wab/client/components/view-common";
import { PlainLinkButton } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { IconButton } from "@/wab/client/components/widgets/IconButton";
import { VirtualListScrollbar } from "@/wab/client/components/widgets/VirtualListScrollbar";
import { useToggleDisplayed } from "@/wab/client/dom-utils";
import { useI18n } from "@/wab/client/i18n";
import { PlusIcon } from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import SearchIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Search";
import { cx, spawn } from "@/wab/shared/common";
import Chroma from "@/wab/shared/utils/color-utils";
import { Tooltip } from "antd";
import Downshift from "downshift";
     
import React from "react";
import { FixedSizeList } from "react-window";

const GRID_SIZE = 32;
const ROW_SIZE = 32;

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
  const {
    rows,
    onAddToken,
    hideAddToken,
  } = props;
  const maxRows = props.maxRows ?? 5;
  const listRef = React.useRef<FixedSizeList | null>(null);
  const [query, setQuery] = React.useState("");
  const hasQuery = !!query && query.trim() !== "";
  const matcher = new Matcher(hasQuery ? query : "", {
    matchMiddleOfWord: true,
  });
  const matchedRows = hasQuery
    ? rows.filter(
        (t) =>
          matcher.matches(t.name) ||
          matcher.matches(Chroma.stringify(t.color)),
      )
    : rows;
  const inputRef = React.useRef<HTMLInputElement>(null);

  // TODO: measure actual width available to us
  const width = 240;
  const numCols = Math.ceil(width / GRID_SIZE) - 1;
  const numRows = Math.ceil(rows.length / numCols);

  useToggleDisplayed(inputRef, () => {
    if (props.autoFocusSearch && inputRef.current) {
      inputRef.current.focus();
    }
  });

  const selectedId = rows.find((row) => row.selected)?.id;
  React.useEffect(() => {
    if (listRef.current) {
      if (!hasQuery && selectedId !== undefined) {
        const index = rows.findIndex((row) => row.id === selectedId);
        if (index >= 0) {
          const rowIndex = Math.ceil(index / numCols);
          listRef.current.scrollToItem(rowIndex, "smart");
        }
      }
    }
  }, [selectedId]);

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
      onStateChange={(change) => {
        if (listRef.current) {
          if (change.highlightedIndex != null) {
            listRef.current.scrollToItem(change.highlightedIndex, "smart");
          }
        }
      }}
      itemCount={hasQuery ? matchedRows.length : undefined}
    >
      {(downshift) => {
        const height = hasQuery
          ? Math.min(maxRows, matchedRows.length) * ROW_SIZE
          : Math.min(maxRows, numRows) * GRID_SIZE;
        return (
          <div className={props.className}>
            <div className="flex flex-vcenter">
              <Icon icon={SearchIcon} className="dimdimfg" />
              <input
                className="ml-sm flex-fill mr-sm"
                placeholder={uiT("Search for token")}
                {...downshift.getInputProps({
                  onKeyDown: (e) => {
                    if (e.key === "Enter") {
                      // Don't propagate Enter key, in case we are in a modal
                      e.stopPropagation();
                    }
                  },
                  ref: inputRef,
                })}
                value={query}
                onChange={(e) => {
                  setQuery(e.currentTarget.value);
                }}
                autoFocus={props.autoFocusSearch}
              />
              {hideAddToken ? null : (
                <Tooltip title={uiT("Create a new color token")}>
                  <IconButton onClick={() => spawn(onAddToken())} type="round">
                    <Icon icon={PlusIcon} />
                  </IconButton>
                </Tooltip>
              )}
            </div>
            <div className="SwatchItemList mt-m" {...downshift.getMenuProps()}>
              <FixedSizeList
                outerElementType={VirtualListScrollbar}
                width={"100%"}
                height={height + 5}
                itemSize={hasQuery ? ROW_SIZE : GRID_SIZE}
                itemCount={hasQuery ? matchedRows.length : numRows}
                ref={listRef}
                overscanCount={5}
              >
                {({ index, style }) => {
                  if (hasQuery) {
                    const token = matchedRows[index];
                    if (!token) {
                      return null;
                    }
                    return (
                      <Tooltip
                        key={`tooltip-${token.id}`}
                        title={`${token.name} (${Chroma.stringify(
                          token.color,
                        )})`}
                      >
                        <div
                          {...downshift.getItemProps({
                            item: token,
                            key: token.id,
                            style: style,
                            index,
                            onMouseDown: () => token.onSelect(),
                            className: cx({
                              NamedSwatch: true,
                              "NamedSwatch--highlighted":
                                downshift.highlightedIndex === index,
                              "NamedSwatch--selected": token.selected,
                              "pl-m": true,
                            }),
                          })}
                        >
                          <ColorSwatch
                            color={token.color}
                            isSelected={token.selected}
                          />
                          <div className="text-ellipsis ml-m">
                            {matcher.boldSnippets(token.name)} (
                            {matcher.boldSnippets(
                              Chroma.stringify(token.color),
                            )}
                            )
                          </div>
                        </div>
                      </Tooltip>
                    );
                  } else {
                    const rowItems = rows.slice(
                      numCols * index,
                      numCols * index + numCols,
                    );
                    return (
                      <div
                        className="flex flex-vcenter flex-hcenter"
                        style={style}
                      >
                        {rowItems.map((token) => (
                          <Tooltip
                            key={token.id}
                            title={`${token.name} (${Chroma.stringify(
                              token.color,
                            )})`}
                          >
                            <PlainLinkButton
                              key={token.id}
                              onMouseDown={() => token.onSelect()}
                              className="flex flex-vcenter flex-hcenter SwatchButton"
                              style={{
                                width: GRID_SIZE,
                                height: GRID_SIZE,
                              }}
                            >
                              <ColorSwatch
                                color={token.color}
                                isSelected={token.selected}
                              />
                            </PlainLinkButton>
                          </Tooltip>
                        ))}
                      </div>
                    );
                  }
                }}
              </FixedSizeList>
            </div>
          </div>
        );
      }}
    </Downshift>
  );
};
