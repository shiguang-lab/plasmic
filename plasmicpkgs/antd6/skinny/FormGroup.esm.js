import { jsx } from 'react/jsx-runtime';
import React from 'react';
import { P as PathContext } from './contexts-DtHxvgts.esm.js';
import 'antd';

function FormGroup(props) {
  const pathCtx = React.useContext(PathContext);
  return /* @__PURE__ */ jsx(
    PathContext.Provider,
    {
      value: {
        relativePath: [...pathCtx.relativePath, props.name],
        fullPath: [...pathCtx.fullPath, props.name]
      },
      children: props.children
    }
  );
}

export { FormGroup };
//# sourceMappingURL=FormGroup.esm.js.map
