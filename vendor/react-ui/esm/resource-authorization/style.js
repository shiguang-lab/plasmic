var _templateObject, _templateObject2, _templateObject3, _templateObject4, _templateObject5, _templateObject6, _templateObject7, _templateObject8, _templateObject9, _templateObject10, _templateObject11, _templateObject12, _templateObject13, _templateObject14, _templateObject15, _templateObject16;
function _taggedTemplateLiteral(strings, raw) { if (!raw) { raw = strings.slice(0); } return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }
import { createStyles } from 'antd-style';
export var useStyles = createStyles(function (_ref) {
  var css = _ref.css,
    token = _ref.token;
  return {
    drawerFooter: css(_templateObject || (_templateObject = _taggedTemplateLiteral(["\n    text-align: right;\n  "]))),
    actionCheckboxGroup: css(_templateObject2 || (_templateObject2 = _taggedTemplateLiteral(["\n    display: flex;\n    flex-direction: column;\n    gap: ", "px;\n  "])), token.marginXS),
    resourceDescriptions: css(_templateObject3 || (_templateObject3 = _taggedTemplateLiteral(["\n    margin-bottom: ", "px;\n  "])), token.margin),
    subjectList: css(_templateObject4 || (_templateObject4 = _taggedTemplateLiteral(["\n    display: flex;\n    flex-direction: column;\n    gap: ", "px;\n  "])), token.marginXS),
    subjectItem: css(_templateObject5 || (_templateObject5 = _taggedTemplateLiteral(["\n    display: flex;\n    align-items: center;\n    gap: ", "px;\n    padding: ", "px ", "px;\n    border-radius: ", "px;\n  "])), token.marginXS, token.paddingXS, token.paddingSM, token.borderRadius),
    allowSubjectItem: css(_templateObject6 || (_templateObject6 = _taggedTemplateLiteral(["\n    background: ", ";\n    border: 1px solid ", ";\n  "])), token.colorSuccessBg, token.colorSuccessBorder),
    denySubjectItem: css(_templateObject7 || (_templateObject7 = _taggedTemplateLiteral(["\n    background: ", ";\n    border: 1px solid ", ";\n  "])), token.colorErrorBg, token.colorErrorBorder),
    subjectName: css(_templateObject8 || (_templateObject8 = _taggedTemplateLiteral(["\n    font-weight: 500;\n  "]))),
    subjectId: css(_templateObject9 || (_templateObject9 = _taggedTemplateLiteral(["\n    color: ", ";\n    font-size: ", "px;\n  "])), token.colorTextTertiary, token.fontSizeSM),
    subjectPolicy: css(_templateObject10 || (_templateObject10 = _taggedTemplateLiteral(["\n    color: ", ";\n    font-size: ", "px;\n    margin-left: auto;\n  "])), token.colorTextSecondary, token.fontSizeSM),
    subjectMeta: css(_templateObject11 || (_templateObject11 = _taggedTemplateLiteral(["\n    color: ", ";\n    font-size: ", "px;\n  "])), token.colorTextTertiary, token.fontSizeSM),
    actionContent: css(_templateObject12 || (_templateObject12 = _taggedTemplateLiteral(["\n    display: flex;\n    flex-direction: column;\n    gap: ", "px;\n  "])), token.margin),
    actionSectionTitle: css(_templateObject13 || (_templateObject13 = _taggedTemplateLiteral(["\n    margin-bottom: ", "px;\n    font-weight: 500;\n  "])), token.marginXS),
    allowTitle: css(_templateObject14 || (_templateObject14 = _taggedTemplateLiteral(["\n    color: ", ";\n  "])), token.colorSuccessText),
    denyTitle: css(_templateObject15 || (_templateObject15 = _taggedTemplateLiteral(["\n    color: ", ";\n  "])), token.colorErrorText),
    actionName: css(_templateObject16 || (_templateObject16 = _taggedTemplateLiteral(["\n    margin-left: ", "px;\n    color: ", ";\n  "])), token.marginXS, token.colorTextSecondary)
  };
});
