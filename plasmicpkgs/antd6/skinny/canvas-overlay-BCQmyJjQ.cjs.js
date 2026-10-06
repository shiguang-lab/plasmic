'use strict';

var host = require('@plasmicapp/host');
var React = require('react');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

function getSelectedCanvasItemKey(items) {
  const index = items.findIndex((item) => item.props.__plasmic_selection_prop__?.isSelected);
  return index < 0 ? void 0 : items[index].key ?? String(index);
}
function renderCanvasSlot(children, render) {
  if (React__default.default.isValidElement(children) && typeof children.props.children === "function") {
    const renderChildren = children.props.children;
    return React__default.default.cloneElement(children, { children: (...args) => renderCanvasSlot(renderChildren(...args), render) });
  }
  return render(children);
}
function getCanvasItems(children, isItem) {
  const items = [];
  React__default.default.Children.forEach(children, (child) => {
    if (!React__default.default.isValidElement(child)) return;
    if (isItem(child)) items.push(child);
    else items.push(...getCanvasItems(child.props.children, isItem));
  });
  return items;
}
const previewOpenProp = {
  type: "boolean",
  displayName: "Preview open",
  editOnly: true,
  description: "Show or hide the overlay on the editing canvas. When unset, follows selection without changing the runtime open state."
};
function useCanvasOverlay(props, triggerSlotName) {
  const canvas = host.usePlasmicCanvasContext();
  const selection = host.usePlasmicCanvasComponentInfo(props);
  const isEditing = !!canvas && !canvas.interactive;
  const {
    open,
    previewOpen,
    plasmicNotifyAutoOpenedContent,
    __plasmic_selection_prop__: _selection,
    ...rest
  } = props;
  const autoOpen = isEditing && !!selection?.isSelected && (!triggerSlotName || selection.selectedSlotName !== triggerSlotName);
  const autoOpened = autoOpen && previewOpen === void 0 && !open;
  React.useEffect(() => {
    if (autoOpened) {
      plasmicNotifyAutoOpenedContent?.();
    }
  }, [autoOpened, plasmicNotifyAutoOpenedContent]);
  return {
    props: rest,
    isEditing,
    open: isEditing ? previewOpen ?? (autoOpen || !!open) : open
  };
}

exports.getCanvasItems = getCanvasItems;
exports.getSelectedCanvasItemKey = getSelectedCanvasItemKey;
exports.previewOpenProp = previewOpenProp;
exports.renderCanvasSlot = renderCanvasSlot;
exports.useCanvasOverlay = useCanvasOverlay;
//# sourceMappingURL=canvas-overlay-BCQmyJjQ.cjs.js.map
