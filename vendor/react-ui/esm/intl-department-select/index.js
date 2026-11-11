import { withConfigProvider } from "../config-provider/index.js";
import InternalIntlDepartmentSelect from "./IntlDepartmentSelect.js";
export var IntlDepartmentSelect = withConfigProvider(InternalIntlDepartmentSelect);
export default IntlDepartmentSelect;
export { fetchIntlDepartments, clearIntlDeptCache } from "./service.js";
export { defaultFilterTreeNode, formatDeptTreeData } from "./utils.js";
