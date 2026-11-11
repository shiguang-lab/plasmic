import { withConfigProvider } from "../config-provider/index.js";
import InternalIntlDictView from "./IntlDictView.js";
export var IntlDictView = withConfigProvider(InternalIntlDictView);
export default IntlDictView;
