const http = require("http");
let calls = 0;
http
  .createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += c;
    if (req.url === "/stats") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ calls }));
    }
    if (!req.url.endsWith("/chat/completions")) {
      res.statusCode = 404;
      return res.end("{}");
    }
    calls++;
    const request = JSON.parse(body);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const chunk = (text, reason = null) =>
      res.write(
        "data: " +
          JSON.stringify({
            id: "fault-local-" + calls,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: request.model,
            choices: [
              { index: 0, delta: { content: text }, finish_reason: reason },
            ],
          }) +
          "\n\n",
      );
    let index = 0;
    const timer = setInterval(() => {
      index++;
      chunk(
        index === 1
          ? "# Local fault fixture\n\n- Partial output retained\n\n| Check | Value |\n| --- | --- |\n| Persisted | yes |\n\n```js\nconst count = 1;\n```\n\n"
          : "chunk " + index + "\n",
      );
      if (index === 5) {
        clearInterval(timer);
        if (
          request.messages.some(
            (m) =>
              m.role === "user" &&
              (typeof m.content === "string"
                ? m.content
                : m.content?.find((p) => p.type === "text")?.text || ""
              ).startsWith("UPSTREAM_FAILURE"),
          )
        ) {
          setTimeout(() => res.destroy(), 300);
        } else {
          const hold = setTimeout(() => {
            chunk("", "stop");
            res.write("data: [DONE]\n\n");
            res.end();
          }, 30000);
          res.on("close", () => clearTimeout(hold));
        }
      }
    }, 250);
    res.on("close", () => clearInterval(timer));
  })
  .listen(8032, "127.0.0.1", () =>
    console.log("Local fault-model fixture on 8032"),
  );
