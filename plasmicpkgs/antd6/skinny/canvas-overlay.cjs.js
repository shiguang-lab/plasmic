'use strict';

var host = require('@plasmicapp/host');
var React = require('react');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

function getSelectedCanvasItemKey(items) {
  const index = items.findIndex((item) => React__default.default.isValidElement(item) && item.props.__canvas?.selected);
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
    if (!React__default.default.isValidElement(child)) {
      return;
    }
    if (isItem(child)) {
      items.push(child);
    } else {
      items.push(...getCanvasItems(child.props.children, isItem));
    }
  });
  return items;
}
function useCanvasOverlay(props, triggerSlotName) {
  const canvas = host.usePlasmicCanvasContext();
  const selection = host.usePlasmicCanvasComponentInfo(props);
  const isEditing = !!canvas && !canvas.interactive;
  const {
    open,
    __canvas,
    ...rest
  } = props;
  const onReveal = __canvas?.onReveal;
  const autoOpen = !!canvas && !!selection?.selected && (!triggerSlotName || selection.slot !== triggerSlotName);
  const state = canvas ? selection?.getState?.("open", open, props.defaultOpen) : void 0;
  const autoOpened = autoOpen && !state && !open;
  const editingOpen = autoOpen || !!open;
  if (state && !selection?.states?.open) {
    const handler = rest.onOpenChange;
    rest.onOpenChange = (next, ...args) => {
      state.set(!isEditing && open !== void 0 ? open : next);
      if (!isEditing) {
        handler?.(next, ...args);
      }
    };
  }
  const resolvedOpen = state ? !!state.value : canvas ? editingOpen : open;
  const revealed = state?.revealed ?? autoOpened;
  const previous = React.useRef({ isEditing, open: resolvedOpen, revealed });
  const silentTransition = React.useRef(revealed);
  const nativeTransition = React.useRef(false);
  const destroyEditingContent = React.useRef(false);
  if (!isEditing || resolvedOpen) {
    destroyEditingContent.current = false;
  } else if (previous.current.isEditing && previous.current.open) {
    destroyEditingContent.current = true;
  }
  if (previous.current.open !== resolvedOpen) {
    silentTransition.current = !nativeTransition.current && (previous.current.isEditing !== isEditing || revealed || previous.current.revealed);
    nativeTransition.current = false;
  }
  previous.current = { isEditing, open: resolvedOpen, revealed };
  const lifecycleProps = rest;
  const { onOpenChange, afterOpenChange, afterClose } = lifecycleProps;
  lifecycleProps.onOpenChange = (next, ...args) => {
    if (isEditing && (next || !state)) {
      return;
    }
    if (!isEditing) {
      silentTransition.current = false;
      nativeTransition.current = true;
    }
    return onOpenChange?.(next, ...args);
  };
  if (afterOpenChange) {
    lifecycleProps.afterOpenChange = (next) => {
      if (!isEditing && !silentTransition.current) {
        afterOpenChange(next);
      }
    };
  }
  if (afterClose) {
    lifecycleProps.afterClose = () => {
      if (!isEditing && !silentTransition.current) {
        afterClose();
      }
    };
  }
  React.useEffect(() => {
    if (autoOpened) {
      onReveal?.();
    }
  }, [autoOpened, onReveal]);
  return {
    props: rest,
    isEditing,
    destroyOnHidden: destroyEditingContent.current ? true : props.destroyOnHidden,
    // Studio already resolves the selection reveal. Its effective value must
    // not be fed back as a new reveal request after a real UI event closes it.
    open: resolvedOpen
  };
}

exports.getCanvasItems = getCanvasItems;
exports.getSelectedCanvasItemKey = getSelectedCanvasItemKey;
exports.renderCanvasSlot = renderCanvasSlot;
exports.useCanvasOverlay = useCanvasOverlay;
//# sourceMappingURL=canvas-overlay.cjs.js.map
