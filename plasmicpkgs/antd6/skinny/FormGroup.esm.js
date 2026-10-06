import React from 'react';
import { P as PathContext } from './contexts-DtHxvgts.esm.js';
import 'antd';

function FormGroup(props) {
  const pathCtx = React.useContext(PathContext);
  return /* @__PURE__ */ React.createElement(
    PathContext.Provider,
    {
      value: {
        relativePath: [...pathCtx.relativePath, props.name],
        fullPath: [...pathCtx.fullPath, props.name]
      }
    },
    props.children
  );
}

export { FormGroup };
//# sourceMappingURL=FormGroup.esm.js.map
