import React from "react";
import { DataProvider, useSelector } from "@plasmicapp/host";
import { AntdButton } from "../../../../plasmicpkgs/antd6/src/registerButton";

export function PublishedContext({ children }: { children: React.ReactNode }) {
  return <DataProvider name="Tenant" data="shiguang">{children}</DataProvider>;
}
export function PublishedTokens({ children }: { children: React.ReactNode }) {
  return <div style={{ "--brand": "#635bff" } as React.CSSProperties}>{children}</div>;
}
export function PublishedPage({ title, initialCount, theme }: { title: string; initialCount: number; theme: string }) {
  const tenant = useSelector("Tenant");
  const [count, setCount] = React.useState(initialCount);
  const [target, setTarget] = React.useState("");
  const [error, setError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  return <main data-testid="published-page" data-theme={theme} style={{ color: "#171724", fontFamily: "Arial, sans-serif", background: "#fff", padding: 24, width: 640 }}>
    <h1>{title}</h1><p data-testid="context">{tenant}/{theme}</p>
    <img src="/published-mark.svg" width={32} height={32} alt="发布资源" />
    <p data-testid="counter" style={{ color: "var(--brand)" }}>{count}</p>
    <AntdButton onClick={() => setCount(count + 1)}>增加</AntdButton>
    <form onSubmit={(event) => { event.preventDefault(); if (!target) { setError(true); return; } setError(false); setBusy(true); setTimeout(() => { setBusy(false); setDone(true); }, 800); }}>
      <label>目标<input aria-label="目标" disabled={busy} value={target} onChange={(event) => setTarget(event.target.value)} /></label>
      {error && <p role="alert">请填写目标</p>}
      <AntdButton data-testid="submit-action" submitsForm disabled={busy} loading={busy}>提交</AntdButton>
    </form>
    {done && <p role="status">已提交：{target}</p>}
    <AntdButton onClick={() => setOpen(true)}>详情</AntdButton>
    <AntdButton href="#result" target={false}>查看结果</AntdButton>
    {open && <section role="dialog" aria-label="发布详情"><p>当前目标：{target || "未填写"}</p><AntdButton onClick={() => setOpen(false)}>关闭</AntdButton></section>}
    <div id="result">发布内容保留</div>
  </main>;
}
