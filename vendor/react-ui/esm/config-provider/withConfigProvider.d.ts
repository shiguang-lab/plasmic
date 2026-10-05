import React from 'react';
import type { ComponentType } from 'react';
/**
 * HOC：自动包裹 ConfigProvider
 * 用于导出的组件，确保样式隔离和静态方法可用
 * 支持 ref 转发
 */
export declare function withConfigProvider<P extends object>(Component: ComponentType<P>): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<unknown>>;
//# sourceMappingURL=withConfigProvider.d.ts.map