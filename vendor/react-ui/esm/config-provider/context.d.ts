import { message, Modal, notification } from 'antd';
import { type ReactNode } from 'react';
/** UI 组件库静态方法上下文 */
interface UIStaticMethodsContextValue {
    message: ReturnType<typeof message.useMessage>[0];
    modal: ReturnType<typeof Modal.useModal>[0];
    notification: ReturnType<typeof notification.useNotification>[0];
}
/** 内部组件：获取 hooks 实例并注入 Context */
declare function UIStaticMethodsProvider({ children }: {
    children: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
/** 获取 UI 组件库封装的静态方法 */
export declare function useUIStaticMethods(): UIStaticMethodsContextValue;
export { UIStaticMethodsProvider };
//# sourceMappingURL=context.d.ts.map