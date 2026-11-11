import { VirtualListScrollbar } from "@/wab/client/components/widgets/VirtualListScrollbar";
import React from "react";
import { FixedSizeList, ListChildComponentProps } from "react-window";
import ResizeObserver from "resize-observer-polyfill";

type RenderRow = (index: number) => React.ReactNode;

function Row({ data, index, style }: ListChildComponentProps) {
  const renderRow: RenderRow = data;
  return <div style={style}>{renderRow(index)}</div>;
}

export function DataPickerVirtualList({
  count,
  rowHeight,
  renderRow,
  itemKey,
  selectedIndex,
  resetKey,
}: {
  count: number;
  rowHeight: number;
  renderRow: RenderRow;
  itemKey: (index: number) => React.Key;
  selectedIndex?: number;
  resetKey?: string;
}) {
  const container = React.useRef<HTMLDivElement>(null);
  const list = React.useRef<FixedSizeList>(null);
  const [height, setHeight] = React.useState(0);
  React.useLayoutEffect(() => {
    const element = container.current;
    if (!element) {
      return;
    }
    const measure = () => setHeight(element.clientHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  React.useLayoutEffect(() => {
    list.current?.scrollTo(0);
  }, [resetKey]);
  React.useLayoutEffect(() => {
    if (selectedIndex !== undefined && selectedIndex >= 0) {
      list.current?.scrollToItem(selectedIndex, "smart");
    }
  }, [selectedIndex, height]);

  return (
    <div ref={container} style={{ flex: 1, minHeight: 0, minWidth: 0, position: "relative", width: "100%" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <FixedSizeList
          ref={list}
          height={height || rowHeight}
          width="100%"
          itemCount={count}
          itemData={renderRow}
          itemKey={itemKey}
          itemSize={rowHeight}
          outerElementType={VirtualListScrollbar}
          overscanCount={3}
        >
          {Row}
        </FixedSizeList>
      </div>
    </div>
  );
}
