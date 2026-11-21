// Assert the settled theme, including hover and focus colors, independently of animation time.
const style = document.createElement("style");
style.textContent =
  "*, *::before, *::after { transition-duration: 0s !important; transition-delay: 0s !important; }";
document.head.appendChild(style);
