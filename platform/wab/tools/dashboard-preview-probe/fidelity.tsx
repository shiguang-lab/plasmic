import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
const data = [
  { name: "周一", value: 45 },
  { name: "周二", value: 80 },
  { name: "周三", value: 60 },
  { name: "周四", value: 110 },
];
function CanvasFixture() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) {
      return;
    }
    const g = ctx.createLinearGradient(0, 0, 400, 160);
    g.addColorStop(0, "#6858ed");
    g.addColorStop(1, "#10bbc1");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 400, 160);
    ctx.fillStyle = "white";
    ctx.font = "bold 24px system-ui";
    ctx.fillText("原生 Canvas 2D", 24, 40);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(24, 130);
    ctx.bezierCurveTo(110, 5, 200, 190, 370, 70);
    ctx.stroke();
  }, []);
  return (
    <canvas
      ref={ref}
      width={400}
      height={160}
      style={{ width: 400, height: 160 }}
    />
  );
}
function Fixture() {
  return (
    <main
      id="fidelity"
      style={{
        width: 1000,
        height: 800,
        padding: 24,
        boxSizing: "border-box",
        background: "#eef0f7",
        fontFamily: "system-ui",
        color: "#242631",
      }}
    >
      <style>{`.stress:before{content:'伪元素';position:absolute;right:12px;top:12px;color:#fff;background:#7858de;border-radius:8px;padding:4px}.stress{position:relative;box-shadow:0 8px 20px #24263144;border:2px solid #fff;border-radius:18px;filter:saturate(1.1)} .gradient-text{background:linear-gradient(90deg,#7846e7,#15a4b0);background-clip:text;-webkit-background-clip:text;color:transparent}`}</style>
      <h1 className="gradient-text">图表、Canvas 与复杂 CSS 保真验证</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "white", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#795ce4" />
                  <stop offset="1" stopColor="#795ce4" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Area
                dataKey="value"
                stroke="#795ce4"
                fill="url(#area)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "white", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="name" />
              <YAxis />
              <Bar dataKey="value" fill="#1ab2bd" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "white", height: 190 }}>
          <PieChart width={400} height={190}>
            <Pie
              data={data}
              dataKey="value"
              cx={200}
              cy={90}
              innerRadius={40}
              outerRadius={75}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell
                  key={d.name}
                  fill={["#795ce4", "#23b5bd", "#f5b545", "#ed6b7d"][i]}
                />
              ))}
            </Pie>
          </PieChart>
        </div>
        <CanvasFixture />
        <div
          className="stress"
          style={{
            height: 130,
            background: "linear-gradient(120deg,#eadbff,#d0f5fa)",
            padding: 16,
          }}
        >
          <h3>Grid / Flex / Shadow / Gradient</h3>
          <div style={{ display: "flex", gap: 12, transform: "rotate(-2deg)" }}>
            <button
              style={{
                padding: 12,
                borderRadius: 8,
                border: 0,
                background: "#795ce4",
                color: "white",
              }}
            >
              按钮
            </button>
            <input defaultValue="表单已填写内容" />
            <input type="checkbox" defaultChecked />
          </div>
        </div>
        <div
          style={{
            padding: 16,
            background: "#252734",
            color: "white",
            borderRadius: 16,
            clipPath: "polygon(0 0,100% 0,90% 100%,0 100%)",
          }}
        >
          <h3>裁剪、图标与样式</h3>
          <svg width="100" height="70">
            <defs>
              <linearGradient id="icon">
                <stop stopColor="#fd8" />
                <stop offset="1" stopColor="#f58" />
              </linearGradient>
            </defs>
            <path d="M10 60 L50 5 L90 60 Z" fill="url(#icon)" />
          </svg>
        </div>
      </div>
    </main>
  );
}
const root = document.createElement("div");
document.body.append(root);
(window as any).renderFidelity = () =>
  new Promise<void>((resolve) =>
    ReactDOM.render(<Fixture />, root, () =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ),
  );
(window as any).clearFidelity = () => {
  ReactDOM.unmountComponentAtNode(root);
  root.remove();
};
