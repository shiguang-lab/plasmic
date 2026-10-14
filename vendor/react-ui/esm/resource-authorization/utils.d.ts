import type { DeptTreeVO, SelectOption, UserOptionVO } from './types';
export declare const flattenDepts: (depts: DeptTreeVO[], prefix?: string) => SelectOption[];
export declare const formatUsers: (users: UserOptionVO[]) => SelectOption[];
export declare const getErrorMessage: (error: unknown, fallback: string) => any;
