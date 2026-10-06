import type { AntdColumnProps } from "./registerTable";

const attr = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const binding = (code: string) => `{{ ${code} }}`;

/** Preserve a column preset as editable nodes when the user explicitly converts it. */
export function columnTemplateHtml(props: AntdColumnProps): string {
  const value = 'cell == null ? "" : String(cell)';
  const label =
    props.displayLabel == null ? value : JSON.stringify(props.displayLabel);
  const text = (code = value) => `<span>${attr(binding(code))}</span>`;
  const component = (
    name: string,
    values: Record<string, unknown>,
    children = "",
    attributes = "",
  ) =>
    `<plasmic-component data-plasmic-component="plasmic-antd6-${name}" data-props="${attr(JSON.stringify(values))}" ${attributes}>${children}</plasmic-component>`;
  const visible = `data-visible-if="${attr(binding('cell != null && String(cell) !== ""'))}"`;
  const size = props.contentSize ?? 32;
  switch (props.displayType) {
    case "tag": {
      const option = `${JSON.stringify(props.tagOptions ?? [])}.find(option => option.value === String(tagValue))`;
      const colors =
        '["blue","green","orange","purple","cyan","magenta","red","gold"]';
      return component(
        "tag",
        {
          color: binding(
            `(${option})?.color || ${JSON.stringify(props.tagColor ?? "")} || ${colors}[Array.from(String(tagValue)).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) % 8]`,
          ),
        },
        `<slot name="children">${text(`(${option})?.label ?? String(tagValue)`)}</slot>`,
        `data-repeat="${attr(binding("(Array.isArray(cell) ? cell : [cell]).filter(value => value != null)"))}" data-repeat-item="tagValue"`,
      );
    }
    case "avatar":
      return component(
        "avatar",
        { src: binding(value), alt: binding(label), size },
        "",
        visible,
      );
    case "image":
      return component(
        "image",
        { src: binding(value), alt: binding(label), width: size, height: size },
        "",
        visible,
      );
    case "button":
      return component(
        "button",
        { size: "small" },
        `<slot name="children">${text(label)}</slot>`,
      );
    case "link":
      return `<a href="${attr(binding(value))}" ${visible}${props.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text(label)}</a>`;
    default:
      return text();
  }
}
