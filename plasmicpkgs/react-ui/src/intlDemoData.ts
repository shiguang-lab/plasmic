import type {
  IntlDeptTreeNode,
  IntlDictItemTreeNode,
  IntlUserOption,
} from "@react/ui";

export const demoUsers: IntlUserOption[] = [
  { userId: "demo-user-1", username: "lin.xiao", nickname: "林晓" },
  { userId: "demo-user-2", username: "chen.yu", nickname: "陈宇" },
  { userId: "demo-user-3", username: "zhou.ning", nickname: "周宁" },
];

export const demoDepartments: IntlDeptTreeNode[] = [
  {
    label: "海外业务部",
    value: "demo-overseas",
    children: [
      { label: "运营组", value: "demo-operations" },
      { label: "风控组", value: "demo-risk" },
    ],
  },
];

export const demoDictCode = "DEMO_REGION";
export const demoDictItems: IntlDictItemTreeNode[] = [
  { dictItemCode: "APAC", dictItemName: "亚太地区" },
  { dictItemCode: "SG", dictItemName: "新加坡", parentItemCode: "APAC" },
  { dictItemCode: "ID", dictItemName: "印度尼西亚", parentItemCode: "APAC" },
];
const emptyDictItems: IntlDictItemTreeNode[] = [];

export function getDemoDictItems(dictCode?: string) {
  return !dictCode || dictCode === demoDictCode
    ? demoDictItems
    : emptyDictItems;
}
