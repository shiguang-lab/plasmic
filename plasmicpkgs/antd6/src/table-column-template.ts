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
  const value = "column.text";
  const label = "column.label";
  const text = (code = value) =>
    `<span data-plasmic-name="显示文字">${attr(binding(code))}</span>`;
  const component = (
    name: string,
    values: Record<string, unknown>,
    children = "",
    attributes = "",
  ) =>
    `<plasmic-component data-plasmic-component="plasmic-antd6-${name}" data-plasmic-name="${attr(`${String(props.dataIndex ?? "单元格")} · ${name}模板`)}" data-props="${attr(JSON.stringify(values))}" ${attributes}>${children}</plasmic-component>`;
  const visible = `data-visible-if="${attr(binding('cell != null && String(cell) !== ""'))}"`;
  const size = binding("column.size");
  switch (props.displayType) {
    case "tag":
      return component(
        "tag",
        {
          value: binding("tagValue"),
          options: binding("column.tagOptions"),
          defaultColor: binding("column.tagColor"),
          automaticColor: true,
        },
        '<slot name="children"></slot>',
        `data-repeat="${attr(binding("column.values"))}" data-repeat-item="tagValue"`,
      );
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
        {
          src: binding(value),
          alt: binding(label),
          width: size,
          height: size,
          objectFit: "cover",
        },
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
      return `<a data-plasmic-name="链接模板" href="${attr(binding(value))}" ${visible} ${`target="${attr(binding('column.openInNewTab ? "_blank" : "_self"'))}" rel="noopener noreferrer"`}>${text(label)}</a>`;
    default:
      return text();
  }
}
