export declare const isResponseObject: (value: unknown) => value is Record<string, unknown>;
/** 只解析一层业务包装；业务字段由调用方按接口契约识别。 */
export declare function unwrapBusinessResponse(payload: unknown, hasBusinessFields?: (value: unknown) => boolean, context?: string): unknown;
/** 保留列表/权限接口已有的一层传输包装，不递归猜测 data。 */
export declare function unwrapRequestResponse(payload: unknown, hasBusinessFields?: (value: unknown) => boolean, context?: string): unknown;
export declare function resolveArrayResponse<T>(payload: unknown, context?: string): T[];
