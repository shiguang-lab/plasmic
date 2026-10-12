import { createStyles } from "antd-style";

export const useMembersStyles = createStyles(({ token }) => ({
  root: {
    color: token.colorText,
    background: token.colorBgContainer,
    padding: 24,
  },
  search: { width: 280, maxWidth: "100%" },
  filter: { minWidth: 180 },
}));

export const useMemberStyles = createStyles(({ token }) => ({
  root: {
    padding: 16,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    color: token.colorText,
  },
  identity: {
    flex: 1,
    minWidth: 180,
    maxWidth: "100%",
    wordBreak: "break-word",
  },
  role: { minWidth: 150 },
  detail: { minWidth: 130 },
}));
