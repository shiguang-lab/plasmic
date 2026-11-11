/// <reference types="react" />
export declare const IntlDepartmentSelect: import("react").ForwardRefExoticComponent<Omit<import("./types").IntlDepartmentSelectProps & import("react").RefAttributes<any>, "ref"> & import("react").RefAttributes<unknown>>;
export default IntlDepartmentSelect;
export { fetchIntlDepartments, clearIntlDeptCache } from './service';
export { defaultFilterTreeNode, formatDeptTreeData } from './utils';
export type { IntlDepartmentSelectProps, IntlDeptTreeNode, FormattedIntlDeptNode, } from './types';
