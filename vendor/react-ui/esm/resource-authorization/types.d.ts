import type { DrawerProps } from 'antd';
export type SubjectBindType = 'USER' | 'DEPT' | 'ROLE' | string;
export interface ResourceAuthorizationApiSources {
    dataPolicy?: string;
    dataResourceTypeList?: string;
    userOptions?: string;
    deptTree?: string;
}
export interface ResourceAuthorizationBaseProps {
    /** 是否打开抽屉 */
    open: boolean;
    /** 资源类型编码 */
    resourceTypeCode: string;
    /** 资源 ID */
    resourceId: string;
    /** 关闭回调 */
    onClose: () => void;
    /** 新增或删除授权成功后的回调 */
    onSuccess?: () => void;
    /** 接口地址覆盖 */
    apiSources?: ResourceAuthorizationApiSources;
}
export interface ResourceAuthorizationProps extends ResourceAuthorizationBaseProps {
    /** 资源名称 */
    resourceName: string;
    /** 抽屉标题 */
    title?: DrawerProps['title'];
    /** 抽屉宽度 */
    width?: DrawerProps['width'];
}
export interface ResourceAuthorizationRecordProps extends ResourceAuthorizationBaseProps {
    /** 抽屉标题 */
    title?: DrawerProps['title'];
    /** 抽屉宽度 */
    width?: DrawerProps['width'];
}
export interface R<T> {
    code?: number;
    msg?: string;
    message?: string;
    developerMessage?: string;
    data: T;
}
export interface DataResourceTypeVO {
    typeCode: string;
    typeName: string;
    [key: string]: any;
}
export interface DataActionVO {
    code: string;
    name: string;
    [key: string]: any;
}
export interface DataPolicyCreateDTO {
    policyName: string;
    policyCode: string;
    resourceTypeCode: string;
    policyCategory: string;
    bindType: string;
    bindId: string;
    policyContent: string;
}
export interface DataPolicyVO {
    policyCode: string;
    policyName: string;
    policyCategory: string;
    [key: string]: any;
}
export interface UserOptionVO {
    userId: string;
    nickname?: string;
    username?: string;
    name?: string;
    [key: string]: any;
}
export interface DeptTreeVO {
    code: string;
    name: string;
    children?: DeptTreeVO[];
    [key: string]: any;
}
export interface SelectOption {
    value: string;
    label: string;
}
export interface ResourcePermissionVO {
    resourceId: string;
    resourceTypeCode: string;
    permissions: ActionPermissionVO[];
}
export interface ActionPermissionVO {
    actionCode: string;
    actionName: string;
    allowBindings: SubjectPermissionVO[];
    denyBindings: SubjectPermissionVO[];
}
export interface SubjectPermissionVO {
    id: string | number;
    bindType: SubjectBindType;
    bindId: string;
    bindName: string;
    policyCode: string;
    policyName: string;
    [key: string]: any;
}
