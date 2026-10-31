import { componentChildren } from "./componentSections";

// Build-time illustrations; published registrations use the thumbnail manifest.
const blue = "#1677ff";
const pale = "#e6f4ff";
const muted = "#b8c4d4";
const rect = (x: number, y: number, w: number, h: number, fill = "white", stroke = "#d9dfe8", radius = 5) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
const line = (x: number, y: number, x2: number, y2: number, color = muted, width = 2) =>
  `<path d="M${x} ${y}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
const text = (x: number, y: number, value: string, color = "#526175", size = 11) =>
  `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-family="Arial,sans-serif">${value}</text>`;
const circle = (x: number, y: number, r: number, fill = blue, stroke = fill) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}"/>`;
const check = (x: number, y: number, color = "white") =>
  `<path d="M${x} ${y}l4 4 8-9" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
const chevron = (x: number, y: number) =>
  `<path d="M${x} ${y}l4 4 4-4" fill="none" stroke="#8594a8" stroke-width="1.5"/>`;
const bars = (x = 42, y = 43, widths = [146, 118, 134]) =>
  widths.map((w, i) => rect(x, y + i * 18, w, 6, "#e7ecf3", "none", 3)).join("");
const button = (x: number, y: number, label = "Button", primary = true, width = 70) =>
  rect(x, y, width, 27, primary ? blue : "white", primary ? blue : "#d9dfe8") +
  text(x + 12, y + 18, label, primary ? "white" : "#526175");
const field = (y: number, label = "Input", value = "Enter value", x = 38, width = 164) =>
  text(x, y - 6, label, "#526175", 9) + rect(x, y, width, 25) + text(x + 9, y + 16, value, "#98a5b5", 9);
const listRows = (selected = false) =>
  [0, 1, 2].map((i) =>
    rect(34, 27 + i * 31, 172, 27, selected && i === 1 ? pale : "white", "#e7ecf3") +
    circle(49, 40 + i * 31, 6, i === 1 ? blue : "#dce5f0") +
    rect(65, 36 + i * 31, 94, 5, i === 1 ? "#a8cfff" : "#dce5f0", "none") +
    rect(65, 45 + i * 31, 60, 4, "#e7ecf3", "none")
  ).join("");
const calendar = () =>
  rect(45, 15, 150, 115) + text(62, 34, "October 2026", "#526175", 10) +
  line(54, 42, 186, 42, "#e7ecf3", 1) +
  Array.from({ length: 28 }, (_, i) => {
    const x = 61 + (i % 7) * 19, y = 59 + Math.floor(i / 7) * 20;
    return (i === 13 ? rect(x - 6, y - 11, 17, 17, blue, blue, 3) : "") +
      text(x - 2, y, String(i + 1), i === 13 ? "white" : "#8594a8", 8);
  }).join("");
const table = () =>
  rect(24, 23, 192, 98) + rect(25, 24, 190, 22, "#f0f5fb", "none") +
  [0, 1, 2, 3].map((i) => line(25, 46 + i * 24, 215, 46 + i * 24, "#e7ecf3", 1)).join("") +
  [0, 1, 2].map((col) => [0, 1, 2, 3].map((row) =>
    rect(36 + col * 61, 32 + row * 24, col === 2 ? 35 : 44, 5, row === 0 ? "#a7b8ce" : col === 2 ? "#91caff" : "#dce5f0", "none", 2)
  ).join("")).join("");
const tree = () =>
  line(45, 39, 45, 100, "#d9dfe8", 1) + line(45, 61, 62, 61, "#d9dfe8", 1) + line(45, 87, 62, 87, "#d9dfe8", 1) +
  rect(35, 22, 19, 14, "#91caff", "none", 2) + text(64, 33, "Parent") +
  rect(64, 49, 129, 23, pale, "none", 3) + text(73, 64, "Selected node", blue, 10) +
  text(73, 92, "Child node", "#8594a8", 10) + text(64, 116, "Another parent", "#8594a8", 10);
const checkbox = (group = false) =>
  (group ? [0, 1, 2] : [1]).map((i) =>
    rect(50, 30 + i * 30, 16, 16, i === 1 ? blue : "white", i === 1 ? blue : "#c5cfdd", 3) +
    (i === 1 ? check(53, 38 + i * 30) : "") + text(77, 42 + i * 30, group ? `Option ${i + 1}` : "Checkbox")
  ).join("");
const radio = (group = false) =>
  (group ? [0, 1, 2] : [1]).map((i) =>
    circle(58, 39 + i * 29, 8, "white", i === 1 ? blue : "#c5cfdd") +
    (i === 1 ? circle(58, 39 + i * 29, 4) : "") + text(77, 43 + i * 29, group ? `Option ${i + 1}` : "Radio")
  ).join("");
const popup = (title: string, confirm = false) =>
  rect(49, 22, 142, 72) + text(63, 43, title, "#526175", 11) + bars(63, 52, [112, 81]) +
  (confirm ? button(128, 71, "OK", true, 48) : "") +
  `<path d="M113 94l7 8 7-8" fill="white" stroke="#d9dfe8"/>` + button(86, 108, "Open", false);
const image = () =>
  rect(42, 24, 156, 96, "#eef5ff") + circle(162, 48, 10, "#ffd666") +
  `<path d="M43 110l44-47 35 36 27-28 48 49H43z" fill="#91caff"/>` +
  `<path d="M43 119l56-29 42 29z" fill="#4096ff"/>`;
const layout = (highlight = "content") =>
  rect(28, 19, 184, 106) + rect(29, 20, 182, 20, highlight === "header" ? blue : "#dce5f0", "none", 0) +
  rect(29, 40, 40, 84, highlight === "sider" ? blue : "#edf2f8", "none", 0) +
  rect(76, 47, 128, 49, highlight === "content" ? pale : "#f5f7fb", "none") +
  text(98, 75, "Content", highlight === "content" ? blue : "#98a5b5", 11) +
  rect(76, 104, 128, 13, highlight === "footer" ? blue : "#edf2f8", "none", 3);
const slider = (range = false) =>
  line(38, 72, 202, 72, "#dce5f0", 5) + line(range ? 75 : 38, 72, 158, 72, "#91caff", 5) +
  circle(158, 72, 7, "white", blue) + (range ? circle(75, 72, 7, "white", blue) : "");
const form = () => field(35, "Name", "Your name") + field(82, "Email", "name@example.com") + button(133, 112, "Submit", true);
const diagrams: Record<string, string> = {
  button: button(30, 38, "Primary") + button(112, 38, "Default", false, 96) + button(30, 82, "Action", false) + text(129, 100, "Link", blue),
  affix: rect(34, 18, 172, 110) + rect(43, 25, 154, 24, pale, "#91caff") + text(77, 41, "Pinned header", blue, 10) + bars(49, 61, [142, 116, 129]),
  alert: rect(27, 48, 186, 46, "#f6ffed", "#b7eb8f") + circle(48, 71, 9, "#52c41a") + check(42, 71) + text(66, 67, "Success message", "#526175", 11) + text(66, 82, "Additional information", "#98a5b5", 8),
  anchor: line(54, 25, 54, 119, "#e7ecf3", 2) + line(54, 56, 54, 79, blue, 3) + text(70, 40, "Overview", "#8594a8") + text(70, 71, "Features", blue) + text(70, 104, "Details", "#8594a8"),
  "auto-complete": field(26, "Search", "Search products") + rect(38, 53, 164, 68) + rect(39, 76, 162, 22, pale, "none", 0) + text(50, 70, "Product A", "#8594a8", 10) + text(50, 91, "Product B", blue, 10) + text(50, 113, "Product C", "#8594a8", 10),
  avatar: circle(120, 72, 29, pale) + circle(120, 62, 10, "#69b1ff") + `<path d="M102 91a18 16 0 0 1 36 0" fill="#69b1ff"/>`,
  "avatar-group": [0, 1, 2].map((i) => circle(81 + i * 38, 72, 24, ["#bae0ff", "#91caff", "#69b1ff"][i], "white") + text(73 + i * 38, 77, ["A", "B", "+3"][i], "white", 14)).join(""),
  badge: rect(86, 45, 62, 57, "#edf2f8", "none", 9) + circle(145, 47, 13, "#ff4d4f") + text(138, 51, "5", "white", 11),
  "badge-ribbon": rect(50, 35, 140, 77) + rect(131, 44, 72, 23, blue, blue, 0) + text(143, 60, "Featured", "white", 9) + bars(63, 69, [94, 70]),
  "border-beam": rect(50, 34, 140, 77) + `<path d="M50 74V39q0-5 5-5h64" stroke="${blue}" stroke-width="3" fill="none"/>` + bars(65, 59, [108, 81]),
  breadcrumb: text(31, 77, "Home", "#8594a8") + text(74, 77, "/", "#b8c4d4") + text(90, 77, "Library", "#8594a8") + text(139, 77, "/", "#b8c4d4") + text(157, 77, "Page", blue),
  calendar: calendar(),
  card: rect(43, 21, 154, 102) + text(56, 41, "Card title", "#526175", 11) + line(44, 51, 196, 51, "#e7ecf3", 1) + bars(56, 64, [123, 99, 111]),
  "card-meta": rect(43, 34, 154, 76) + circle(68, 60, 13, pale) + text(91, 58, "Card title", "#526175", 12) + bars(91, 68, [87, 68]),
  "card-grid": [0, 1, 2, 3].map((i) => rect(44 + (i % 2) * 76, 25 + Math.floor(i / 2) * 48, 76, 48, i === 1 ? pale : "white", "#d9dfe8", 0)).join(""),
  carousel: rect(29, 29, 182, 80, pale, "none") + text(102, 75, "Slide", blue, 16) + [0, 1, 2].map((i) => rect(99 + i * 16, 119, i === 0 ? 14 : 7, 3, i === 0 ? blue : "#dce5f0", "none", 1)).join(""),
  cascader: field(22, "Cascader", "Choose a region") + chevron(183, 32) + [0, 1, 2].map((i) => rect(38 + i * 55, 50, 55, 70) + rect(39 + i * 55, 52, 53, 20, i < 2 ? pale : "white", "none", 0) + text(44 + i * 55, 66, ["Region", "City", "Area"][i], i < 2 ? blue : "#8594a8", 8) + bars(45 + i * 55, 82, [35, 28])).join(""),
  checkbox: checkbox(),
  "checkbox-group": checkbox(true),
  "color-picker": rect(38, 26, 133, 90) + `<defs><linearGradient id="color"><stop stop-color="white"/><stop offset="1" stop-color="${blue}"/></linearGradient></defs>` + rect(45, 33, 119, 66, "url(#color)", "none", 2) + line(45, 107, 164, 107, blue, 5) + circle(123, 67, 5, "none", "white") + rect(183, 57, 23, 30, blue, "none"),
  collapse: rect(38, 25, 164, 94) + rect(39, 26, 162, 29, "#f5f7fb", "none", 0) + text(58, 45, "Expanded panel", "#526175", 10) + chevron(46, 36) + bars(51, 68, [134, 102]) + line(39, 98, 201, 98, "#e7ecf3", 1) + text(58, 112, "Another panel", "#8594a8", 9),
  descriptions: rect(29, 30, 182, 84) + [0, 1, 2].map((i) => rect(30, 31 + i * 28, 63, 27, "#f5f7fb", "none", 0) + text(39, 48 + i * 28, ["Name", "Status", "Owner"][i], "#8594a8", 9) + rect(107, 43 + i * 28, [69, 47, 79][i], 5, i === 1 ? "#91caff" : "#dce5f0", "none") + line(30, 58 + i * 28, 210, 58 + i * 28, "#e7ecf3", 1)).join(""),
  divider: bars(39, 27, [162, 121]) + line(32, 72, 98, 72, "#d9dfe8", 1) + text(104, 76, "Text", "#8594a8", 10) + line(140, 72, 208, 72, "#d9dfe8", 1) + bars(39, 95, [146, 162]),
  drawer: rect(27, 18, 186, 108, "#edf2f8") + rect(113, 19, 99, 106) + text(127, 38, "Drawer", "#526175", 11) + text(194, 37, "×", "#98a5b5", 14) + bars(127, 55, [70, 58, 66]) + button(143, 95, "Save", true, 54),
  dropdown: button(73, 20, "Actions", false, 94) + chevron(151, 31) + rect(73, 51, 94, 77) + ["Edit", "Copy", "Delete"].map((v, i) => text(86, 70 + i * 23, v, i === 2 ? "#ff4d4f" : "#526175", 10)).join(""),
  empty: `<path d="M95 56l9-17h34l9 17v31H95z" fill="#edf2f8" stroke="#d9dfe8"/><path d="M95 56h16l4 8h13l4-8h15" fill="none" stroke="#c5cfdd"/>` + text(91, 109, "No data", "#98a5b5", 11),
  flex: rect(28, 37, 184, 69, "white", "#91caff") + [0, 1, 2].map((i) => rect(40 + i * 57, 49, 46, i === 1 ? 45 : 30, i === 1 ? blue : pale, "none") + text(57 + i * 57, 69, String(i + 1), i === 1 ? "white" : blue)).join(""),
  "float-button": circle(120, 73, 23, "white", "#d9dfe8") + text(111, 80, "+", blue, 26),
  "float-button-group": [0, 1, 2].map((i) => circle(120, 31 + i * 40, 17, "white", "#d9dfe8") + text(114, 36 + i * 40, ["?", "+", "↑"][i], blue, 16)).join(""),
  "back-top": circle(120, 72, 23, "white", "#d9dfe8") + text(112, 80, "↑", blue, 24),
  form: form(),
  "form-group": form(),
  "form-list": field(29, "Items", "First item") + field(72, "", "Second item") + button(38, 111, "+ Add item", false, 164),
  image: image(),
  input: field(61, "Input", "Enter text"),
  "input-password": field(61, "Password", "● ● ● ● ● ●") + text(181, 78, "◉", "#98a5b5", 11),
  "input-search": field(61, "Search", "Search here", 28, 155) + button(182, 61, "⌕", true, 31),
  "input-otp": text(48, 43, "Verification code", "#8594a8", 10) + Array.from({ length: 6 }, (_, i) => rect(36 + i * 29, 57, 24, 32, "white", i === 3 ? blue : "#d9dfe8") + text(44 + i * 29, 78, i < 3 ? String(i + 2) : "", "#526175", 14)).join(""),
  "input-number": field(61, "Number", "42", 54, 133) + line(167, 62, 167, 85, "#d9dfe8", 1) + text(174, 70, "+", "#8594a8", 10) + text(175, 81, "−", "#8594a8", 10),
  layout: layout(),
  "layout-header": layout("header"),
  "layout-footer": layout("footer"),
  "layout-sider": layout("sider"),
  list: listRows(),
  listy: listRows(true),
  masonry: [0, 1, 2].map((i) => rect(32 + i * 61, 25, 54, [47, 66, 38][i], pale, "none") + rect(32 + i * 61, [80, 99, 71][i], 54, [40, 21, 49][i], "#91caff", "none")).join(""),
  mentions: field(39, "Message", "Hello @") + rect(38, 66, 164, 63) + text(51, 84, "@Alice", blue, 10) + text(51, 102, "@Bob", "#8594a8", 10) + text(51, 120, "@Carol", "#8594a8", 10),
  menu: rect(47, 18, 146, 108) + ["Overview", "Components", "Settings"].map((v, i) => rect(54, 26 + i * 31, 132, 27, i === 1 ? pale : "white", "none") + text(69, 43 + i * 31, v, i === 1 ? blue : "#8594a8", 10)).join(""),
  modal: rect(24, 18, 192, 108, "#edf2f8") + rect(48, 33, 144, 81) + text(61, 52, "Modal title", "#526175", 11) + text(175, 52, "×", "#98a5b5", 13) + bars(61, 65, [111, 87]) + button(130, 87, "OK", true, 49),
  pagination: ["‹", "1", "2", "3", "…", "›"].map((v, i) => rect(24 + i * 33, 58, 27, 28, "white", i === 1 ? blue : "#d9dfe8") + text(34 + i * 33, 77, v, i === 1 ? blue : "#8594a8", 11)).join(""),
  popconfirm: popup("Delete this item?", true),
  popover: popup("Popover title"),
  progress: line(34, 51, 202, 51, "#e7ecf3", 8) + line(34, 51, 145, 51, blue, 8) + text(174, 73, "65%", "#8594a8", 10) + circle(84, 102, 20, "none", "#e7ecf3") + `<path d="M84 82a20 20 0 1 1-19 26" fill="none" stroke="${blue}" stroke-width="4"/>` + text(75, 106, "65", blue, 10),
  "qr-code": rect(74, 26, 92, 92) + [0, 1, 2].map((i) => rect(83 + (i === 1 ? 47 : 0), 35 + (i === 2 ? 47 : 0), 20, 20, "white", "#526175", 0) + rect(89 + (i === 1 ? 47 : 0), 41 + (i === 2 ? 47 : 0), 8, 8, "#526175", "none", 0)).join("") + Array.from({ length: 52 }, (_, i) => ((i * 7 + i % 3) % 5 < 3 ? rect(83 + (i % 13) * 5, 60 + Math.floor(i / 13) * 5, 4, 4, "#526175", "none", 0) : "")).join(""),
  radio: radio(),
  "radio-group": radio(true),
  "radio-button": ["A", "B", "C"].map((v, i) => rect(59 + i * 41, 58, 41, 28, i === 1 ? pale : "white", i === 1 ? blue : "#d9dfe8", 0) + text(75 + i * 41, 76, v, i === 1 ? blue : "#8594a8", 11)).join(""),
  rate: [0, 1, 2, 3, 4].map((i) => `<path d="M${48 + i * 36} 53l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="${i < 4 ? "#fadb14" : "#e7ecf3"}"/>`).join(""),
  result: circle(120, 48, 21, "#52c41a") + `<path d="M109 48l7 7 15-17" fill="none" stroke="white" stroke-width="3"/>` + text(92, 85, "Success", "#526175", 14) + button(87, 101, "Continue", true, 78),
  row: [0, 1, 2].map((i) => rect(29 + i * 63, 48, 55, 48, i === 1 ? blue : pale, "none") + text(41 + i * 63, 77, "Col", i === 1 ? "white" : blue)).join(""),
  col: rect(32, 28, 177, 88, "white", "#d9dfe8") + rect(33, 29, 58, 86, pale, "none", 0) + text(47, 77, "Col", blue) + bars(104, 51, [85, 59, 78]),
  segmented: rect(33, 53, 174, 38, "#f0f3f7", "none") + rect(36, 56, 55, 32, "white", "none", 4) + ["Daily", "Weekly", "Monthly"].map((v, i) => text(46 + i * 55, 76, v, i === 0 ? blue : "#8594a8", 9)).join(""),
  select: field(26, "Select", "Option B") + chevron(184, 36) + rect(38, 55, 164, 65) + ["Option A", "Option B", "Option C"].map((v, i) => rect(42, 59 + i * 19, 156, 18, i === 1 ? pale : "white", "none", 2) + text(50, 71 + i * 19, v, i === 1 ? blue : "#8594a8", 9)).join(""),
  skeleton: circle(52, 45, 17, "#e7ecf3") + bars(79, 34, [116, 76]) + bars(36, 76, [170, 160, 127]),
  "skeleton-avatar": circle(120, 72, 29, "#e7ecf3"),
  "skeleton-button": rect(79, 55, 82, 34, "#e7ecf3", "none"),
  "skeleton-input": rect(43, 56, 154, 32, "#e7ecf3", "none"),
  "skeleton-image": rect(63, 30, 114, 84, "#e7ecf3", "none") + `<path d="M83 96l26-30 16 18 13-14 21 26z" fill="#cbd5e3"/>`,
  "skeleton-node": rect(86, 38, 68, 68, "#e7ecf3", "none"),
  slider: slider(),
  space: [0, 1, 2].map((i) => button(22 + i * 68, 58, ["One", "Two", "Three"][i], i === 0, 58)).join(""),
  "space-compact": [0, 1, 2].map((i) => rect(30 + i * 60, 57, 60, 31, i === 2 ? blue : "white", i === 2 ? blue : "#d9dfe8", 0) + text(41 + i * 60, 77, ["Select", "Input", "Go"][i], i === 2 ? "white" : "#8594a8", 10)).join(""),
  spin: Array.from({ length: 8 }, (_, i) => {
    const angle = i * Math.PI / 4;
    return `<circle cx="${120 + Math.sin(angle) * 22}" cy="${72 + Math.cos(angle) * 22}" r="4" fill="${blue}" opacity="${(i + 1) / 8}"/>`;
  }).join(""),
  splitter: rect(28, 28, 184, 88) + rect(29, 29, 67, 86, pale, "none", 0) + rect(102, 29, 109, 86, "#f5f7fb", "none", 0) + line(99, 30, 99, 114, "#91caff", 2) + rect(97, 60, 4, 24, blue, "none", 2) + text(44, 75, "Panel 1", blue, 10) + text(133, 75, "Panel 2", "#8594a8", 10),
  statistic: text(61, 49, "Active users", "#8594a8", 11) + text(61, 85, "12,340", "#526175", 30) + text(61, 107, "↑ 12.5%", "#52c41a", 10),
  "statistic-timer": text(57, 49, "Countdown", "#8594a8", 11) + text(57, 87, "02:34:56", "#526175", 27),
  steps: line(44, 58, 195, 58, "#dce5f0", 2) + line(44, 58, 118, 58, blue, 2) + [0, 1, 2].map((i) => circle(44 + i * 75, 58, 13, i === 0 ? pale : i === 1 ? blue : "#edf2f8") + (i === 0 ? check(38, 58, blue) : text(41 + i * 75, 62, String(i + 1), i === 1 ? "white" : "#98a5b5", 10)) + text(28 + i * 75, 94, ["Done", "Current", "Next"][i], i === 1 ? blue : "#8594a8", 9)).join(""),
  switch: rect(47, 55, 64, 33, blue, "none", 17) + circle(94, 71.5, 13, "white") + rect(135, 55, 64, 33, "#c5cfdd", "none", 17) + circle(152, 71.5, 13, "white"),
  table: table(),
  tabs: text(40, 36, "Tab 1", blue, 11) + text(101, 36, "Tab 2", "#8594a8", 11) + text(163, 36, "Tab 3", "#8594a8", 11) + line(29, 47, 211, 47, "#e7ecf3", 1) + line(37, 47, 79, 47, blue, 2) + bars(41, 65, [150, 115, 137]),
  tag: rect(33, 57, 50, 27, pale, "#91caff", 4) + text(42, 74, "Blue", blue, 10) + rect(94, 57, 53, 27, "#f6ffed", "#b7eb8f", 4) + text(104, 74, "Green", "#52c41a", 10) + rect(158, 57, 49, 27, "#fff1f0", "#ffa39e", 4) + text(169, 74, "Red", "#ff4d4f", 10),
  textarea: field(36, "Text area", "Write a message...") + rect(38, 57, 164, 56) + bars(49, 72, [140, 108]),
  timeline: line(49, 31, 49, 110, "#dce5f0", 2) + [0, 1, 2].map((i) => circle(49, 35 + i * 37, 5, "white", i === 2 ? "#c5cfdd" : blue) + text(66, 39 + i * 37, ["Created", "In progress", "Completed"][i], "#526175", 10) + rect(66, 47 + i * 37, 111 - i * 19, 4, "#e7ecf3", "none", 2)).join(""),
  tooltip: rect(68, 29, 104, 30, "#263449", "none", 5) + text(84, 49, "Tooltip text", "white", 10) + `<path d="M114 59l6 7 6-7" fill="#263449"/>` + button(81, 84, "Hover", false, 78),
  tour: rect(31, 19, 178, 106, "#edf2f8") + rect(53, 36, 133, 77) + text(64, 55, "Welcome", "#526175", 12) + bars(64, 66, [109, 82]) + text(65, 100, "1 / 3", "#98a5b5", 8) + button(135, 87, "Next", true, 42),
  transfer: [0, 1].map((col) => rect(25 + col * 118, 25, 92, 94) + text(37 + col * 118, 42, col ? "Target" : "Source", "#526175", 10) + [0, 1, 2].map((i) => rect(36 + col * 118, 55 + i * 19, 10, 10, i === 1 ? blue : "white", i === 1 ? blue : "#d9dfe8", 2) + rect(53 + col * 118, 57 + i * 19, 49, 4, "#dce5f0", "none")).join("")).join("") + text(123, 66, "›", blue, 19) + text(123, 88, "‹", "#8594a8", 19),
  tree: tree(),
  "tree-select": field(24, "Tree select", "Selected node") + chevron(183, 34) + `<g transform="translate(0,24) scale(1,0.75)">${tree()}</g>`,
  typography: text(37, 40, "Typography", "#263449", 20) + text(37, 67, "Readable text and headings", "#526175", 10) + bars(37, 81, [166, 142]) + text(37, 122, "Link text", blue, 11),
  "typography-title": text(39, 80, "Heading", "#263449", 30),
  "typography-text": text(49, 77, "A line of text", "#526175", 19),
  "typography-paragraph": bars(35, 39, [171, 164, 177, 154]) + text(35, 120, "Paragraph", "#8594a8", 10),
  "typography-link": text(73, 79, "Link text", blue, 20) + line(74, 84, 149, 84, blue, 1),
  upload: button(63, 26, "↑ Upload", false, 114) + text(46, 81, "✓  document.pdf", blue, 10) + line(46, 94, 194, 94, "#e7ecf3", 3) + line(46, 94, 162, 94, blue, 3),
  "upload-dragger": `<rect x="39" y="25" width="162" height="94" rx="6" fill="#fafcff" stroke="#91caff" stroke-dasharray="4 3"/>` + text(111, 62, "↑", blue, 24) + text(70, 86, "Click or drag a file", "#526175", 10) + text(82, 105, "Drop files here", "#98a5b5", 8),
  watermark: rect(28, 23, 184, 98) + bars(40, 40, [160, 127, 146, 138]) + [0, 1, 2].map((i) => `<text x="${34 + i * 65}" y="93" transform="rotate(-25 ${34 + i * 65} 93)" fill="#c5cfdd" font-size="12" font-family="Arial,sans-serif">Watermark</text>`).join(""),
  "date-picker": field(30, "Date", "2026-10-14") + `<g transform="translate(55,45) scale(0.55)">${calendar()}</g>`,
  "date-range-picker": field(35, "Date range", "Oct 01    →    Oct 14") + line(54, 100, 184, 100, "#91caff", 7) + circle(74, 100, 6, blue) + circle(165, 100, 6, blue),
  "time-picker": field(31, "Time", "09:30:00") + [0, 1, 2].map((i) => rect(40 + i * 54, 62, 52, 59) + rect(41 + i * 54, 81, 50, 20, pale, "none", 0) + text(59 + i * 54, 76, ["08", "29", "59"][i], "#98a5b5", 9) + text(59 + i * 54, 94, ["09", "30", "00"][i], blue, 9) + text(59 + i * 54, 113, ["10", "31", "01"][i], "#98a5b5", 9)).join(""),
  "time-range-picker": field(57, "Time range", "09:30    →    18:00"),
};

const customThumbnails: Record<string, string> = {
  "table-expand-column": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect x="8" y="10" width="104" height="60" rx="4" fill="#fff" stroke="#d9d9d9"/><path d="M8 30h104M8 50h104M32 10v40" stroke="#d9d9d9"/><path d="m16 18 4 4 4-4M16 40h8m-4-4v8" fill="none" stroke="#1677ff" stroke-width="2"/><rect x="36" y="55" width="68" height="10" rx="2" fill="#e6f4ff"/></svg>',
};

export function getComponentThumbnail(name: string): string | undefined {
  if (!name.startsWith("plasmic-antd6-")) {
    return undefined;
  }
  let suffix = name.slice("plasmic-antd6-".length);
  if (customThumbnails[suffix]) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(customThumbnails[suffix])}`;
  }
  while (!diagrams[suffix] && componentChildren[suffix]) {
    suffix = componentChildren[suffix].parent;
  }
  const content = diagrams[suffix];
  if (!content) {
    return undefined;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="144" viewBox="0 0 240 144"><title>${name}</title>${rect(0, 0, 240, 144, "#fafcff", "none", 8)}${content}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const componentThumbnailNames = Array.from(new Set([...Object.keys(diagrams), ...Object.keys(componentChildren), ...Object.keys(customThumbnails)])).map(suffix => `plasmic-antd6-${suffix}`);
