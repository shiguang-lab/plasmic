'use strict';

var Ant = require('antd');
var React = require('react');
var utils = require('./utils-CRCm44nj.cjs.js');
require('@plasmicapp/host/registerComponent');
require('@plasmicapp/host/registerGlobalContext');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

function AntdPagination(props) {
  const { paginatedUrl, pageSizeOptions, ...rest } = props;
  return /* @__PURE__ */ React__default.default.createElement(
    Ant.Pagination,
    {
      pageSizeOptions: pageSizeOptions?.filter((i) => i?.pageSize).map((i) => i.pageSize),
      itemRender: paginatedUrl ? (pageNo, _, originalElement) => {
        if (!React__default.default.isValidElement(originalElement) || !props.pageSize) {
          return originalElement;
        }
        let rel = void 0;
        if (props.current) {
          rel = pageNo === props.current ? "self" : pageNo === props.current - 1 ? "prev" : pageNo === props.current + 1 ? "next" : void 0;
        }
        const href = paginatedUrl(pageNo, props.pageSize);
        return React__default.default.cloneElement(originalElement, {
          ...originalElement.props,
          rel,
          href,
          style: {
            ...originalElement.props?.style ?? {},
            pointerEvents: "none"
          }
        });
      } : void 0,
      ...rest
    }
  );
}
const paginationComponentName = "plasmic-antd6-pagination";
const paginationHelpers = {
  states: {
    pageSize: {
      onChangeArgsToValue: (_, pageSize) => pageSize
    },
    startIndex: {
      initFunc: (props) => ((props.current ?? props.defaultCurrent ?? 1) - 1) * (props.pageSize ?? props.defaultPageSize ?? 10),
      onChangeArgsToValue: (currentPage, pageSize) => (currentPage - 1) * pageSize
    },
    endIndex: {
      initFunc: (props) => (props.current ?? props.defaultCurrent ?? 1) * (props.pageSize ?? props.defaultPageSize ?? 10) - 1,
      onChangeArgsToValue: (currentPage, pageSize) => pageSize * currentPage - 1
    }
  }
};
function registerPagination(loader) {
  utils.registerComponentHelper(loader, AntdPagination, {
    name: paginationComponentName,
    displayName: "Pagination",
    props: {
      current: {
        editOnly: true,
        uncontrolledProp: "defaultCurrent",
        type: "number",
        displayName: "Current Page",
        description: `Default current page`,
        defaultValue: 1
      },
      total: {
        type: "number",
        defaultValueHint: 0,
        description: `Total number of data items`
      },
      pageSize: {
        editOnly: true,
        uncontrolledProp: "defaultPageSize",
        type: "number",
        displayName: "Page size",
        description: `Default number of items per page`,
        defaultValue: 10
      },
      disabled: {
        type: "boolean",
        defaultValueHint: false,
        description: `Disable pagination controls`
      },
      hideOnSinglePage: {
        type: "boolean",
        defaultValueHint: false,
        advanced: true,
        description: `Hide pager on single page`
      },
      showLessItems: {
        type: "boolean",
        defaultValueHint: false,
        advanced: true,
        description: `Show less page items`,
        hidden: (ps) => !!ps.simple
      },
      showQuickJumper: {
        type: "boolean",
        defaultValueHint: false,
        advanced: true,
        description: `Show "Go to page" control to enable jumping to pages directly`,
        hidden: (ps) => !!ps.simple
      },
      showSizeChanger: {
        type: "boolean",
        defaultValueHint: (ps) => ps.total ? ps.total > 50 : false,
        advanced: true,
        description: `Show page size selector`,
        hidden: (ps) => !!ps.simple
      },
      //   showTitle prop seems to be doing nothing, so this is skipped
      //   showTitle: {
      //     type: "boolean",
      //     defaultValueHint: true,
      //     description: `Show page item's title`,
      //   },
      showTotal: {
        type: "function",
        displayName: "Show total",
        description: "Display the total number and range",
        advanced: true,
        argNames: ["total", "range"],
        argValues: (_ps, ctx) => [ctx.data[0], ctx.data[1]]
      },
      simple: {
        type: "boolean",
        defaultValueHint: false,
        description: `Uuse simple mode (i.e. minimal controls)`
      },
      size: {
        type: "choice",
        defaultValueHint: "default",
        description: `Size of the pager`,
        options: ["default", "small"]
      },
      pageSizeOptions: {
        type: "array",
        defaultValue: [
          {
            pageSize: 10
          },
          {
            pageSize: 20
          },
          {
            pageSize: 50
          },
          {
            pageSize: 100
          }
        ],
        description: "The list of available page sizes",
        advanced: true,
        itemType: {
          type: "object",
          nameFunc: (item) => item.pageSize,
          fields: {
            pageSize: {
              type: "number",
              min: 1
            }
          }
        }
      },
      paginatedUrl: {
        type: "function",
        advanced: true,
        description: "Helps generate SEO-friendly pagination links. These links will include appropriate href attributes, ensuring that search engines can effectively crawl and index your paginated content",
        control: {
          type: "href"
        },
        argNames: ["pageNo", "pageSize"],
        argValues: (_props, ctx) => [
          ctx?.data?.[0],
          _props.pageSize
        ]
      },
      onChange: {
        type: "eventHandler",
        advanced: true,
        argTypes: [
          {
            name: "page",
            type: "number"
          },
          {
            name: "pageSize",
            type: "number"
          }
        ]
      },
      onShowSizeChange: {
        type: "eventHandler",
        advanced: true,
        argTypes: [
          {
            name: "current",
            type: "number"
          },
          {
            name: "size",
            type: "number"
          }
        ]
      }
    },
    states: {
      currentPage: {
        type: "writable",
        valueProp: "current",
        onChangeProp: "onChange",
        variableType: "number"
      },
      pageSize: {
        type: "writable",
        valueProp: "pageSize",
        onChangeProp: "onShowSizeChange",
        variableType: "number",
        ...paginationHelpers.states.pageSize
      },
      startIndex: {
        type: "readonly",
        variableType: "number",
        onChangeProp: "onChange",
        ...paginationHelpers.states.startIndex
      },
      endIndex: {
        type: "readonly",
        variableType: "number",
        onChangeProp: "onChange",
        ...paginationHelpers.states.endIndex
      }
    },
    componentHelpers: {
      helpers: paginationHelpers,
      importName: "paginationHelpers",
      importPath: "@shiguang-lab/plasmic-antd6/skinny/registerPagination"
    },
    importPath: "@shiguang-lab/plasmic-antd6/skinny/registerPagination",
    importName: "AntdPagination"
  });
}

exports.AntdPagination = AntdPagination;
exports.paginationComponentName = paginationComponentName;
exports.paginationHelpers = paginationHelpers;
exports.registerPagination = registerPagination;
//# sourceMappingURL=registerPagination.cjs.js.map
