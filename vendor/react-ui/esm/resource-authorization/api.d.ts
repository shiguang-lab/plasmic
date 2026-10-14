import type { DataActionVO, DataPolicyCreateDTO, DataPolicyVO, DataResourceTypeVO, DeptTreeVO, ResourceAuthorizationApiSources, ResourcePermissionVO, UserOptionVO } from './types';
export declare const createResourceAuthorizationApi: (apiSources?: ResourceAuthorizationApiSources) => {
    listResourceTypes: () => Promise<DataResourceTypeVO[]>;
    getResourceActions: (resourceTypeCode: string) => Promise<DataActionVO[]>;
    listUsers: () => Promise<UserOptionVO[]>;
    listDeptTree: () => Promise<DeptTreeVO[]>;
    createPolicy: (data: DataPolicyCreateDTO) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    getPolicyByCode: (policyCode: string) => Promise<DataPolicyVO>;
    deletePolicy: (policyCode: string) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    getResourcePermissions: (resourceId: string, resourceTypeCode: string) => Promise<ResourcePermissionVO>;
};
