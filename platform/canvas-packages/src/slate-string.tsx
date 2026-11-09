import * as React from "react";
import { Editor, Element, Node, Path, Text } from "slate";
import { IS_ANDROID, MARK_PLACEHOLDER_SYMBOL } from "slate-dom";
import { ReactEditor, useSlateStatic } from "slate-react";

/** Slate leaf rendering belongs to the iframe module graph, including React,
 * Slate context and the public React Compiler runtime. */
export function SlateString({ isLast, leaf, parent, text }: {
  isLast: boolean;
  leaf: Text;
  parent: Element;
  text: Text;
}) {
  // Slate's provider owns a ReactEditor; host projects own CustomTypes.
  const editor = useSlateStatic() as Editor & ReactEditor;
  const path = ReactEditor.findPath(editor, text);
  const parentPath = Path.parent(path);
  const isMarkPlaceholder = Boolean(Reflect.get(leaf, MARK_PLACEHOLDER_SYMBOL));
  if (editor.isVoid(parent)) {
    return <ZeroWidthString length={Node.string(parent).length} />;
  }
  if (leaf.text === "" && parent.children[parent.children.length - 1] === text && !editor.isInline(parent) && Editor.string(editor, parentPath) === "") {
    return <ZeroWidthString isLineBreak isMarkPlaceholder={isMarkPlaceholder} />;
  }
  if (leaf.text === "") { return <ZeroWidthString isMarkPlaceholder={isMarkPlaceholder} />; }
  return <TextString text={leaf.text} isTrailing={isLast && leaf.text.endsWith("\n")} />;
}

/** Preserve the browser's TextNode when native editing already produced the
 * right content. React owns the span; the layout effect synchronizes its text. */
export function TextString({ text, isTrailing = false }: { text: string; isTrailing?: boolean }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const content = `${text ?? ""}${isTrailing ? "\n" : ""}`;
  const [initialText] = React.useState(content);
  React.useLayoutEffect(() => {
    if (ref.current && ref.current.textContent !== content) { ref.current.textContent = content; }
  });
  return <MemoizedText ref={ref}>{initialText}</MemoizedText>;
}

const MemoizedText = React.memo(function MemoizedText({ children, ref }: { children: string; ref?: React.Ref<HTMLSpanElement> }) {
  return <span data-slate-string ref={ref}>{children}</span>;
});

function ZeroWidthString({ length = 0, isLineBreak = false, isMarkPlaceholder = false }: {
  length?: number;
  isLineBreak?: boolean;
  isMarkPlaceholder?: boolean;
}) {
  // Android needs this character at line boundaries for IME range resolution.
  return <span data-slate-zero-width={isLineBreak ? "n" : "z"} data-slate-length={length} data-slate-mark-placeholder={isMarkPlaceholder || undefined}>
    {!IS_ANDROID || !isLineBreak ? "\uFEFF" : null}
    {isLineBreak ? <br /> : null}
  </span>;
}
