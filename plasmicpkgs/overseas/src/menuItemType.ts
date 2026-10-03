export const menuItemType: any = { type: "object", nameFunc: (item: any) => item.label || item.key, fields: { key: "string", label: "string", href: { type: "href", description: "Page route; uses Plasmic navigation." }, disabled: "boolean", type: { type: "choice", options: ["item", "group", "divider"] }, children: { type: "array" } } };
menuItemType.fields.children.itemType = menuItemType;
