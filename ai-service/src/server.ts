import http from "node:http";
import { AgentEngine } from "./agent/agent-engine.js";
import { ChatRequestSchema } from "./types.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const engine = new AgentEngine();

function setCorsHeaders(res: http.ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  // 1. Health check
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "gadgetsgarden-ai-agent",
        runtime: `Node.js ${process.version}`,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // 2. Chat (JSON)
  if (req.method === "POST" && url.pathname === "/chat") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const parsedJson = JSON.parse(body || "{}");
        const validated = ChatRequestSchema.parse(parsedJson);

        const response = await engine.processInquiry(validated);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } catch (err: unknown) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Invalid request payload",
            details: err instanceof Error ? err.message : String(err),
          })
        );
      }
    });
    return;
  }

  // 3. Chat (SSE Streaming)
  if (req.method === "POST" && url.pathname === "/chat/stream") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const parsedJson = JSON.parse(body || "{}");
        const validated = ChatRequestSchema.parse(parsedJson);

        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        // Send initial metadata
        res.write(`data: ${JSON.stringify({ type: "start", timestamp: new Date().toISOString() })}\n\n`);

        const response = await engine.processInquiry(validated);

        // Stream the message in chunks
        const words = response.message.split(" ");
        for (const word of words) {
          res.write(`data: ${JSON.stringify({ type: "token", text: word + " " })}\n\n`);
          await new Promise((r) => setTimeout(r, 20)); // natural streaming pacing
        }

        // Stream the final recommendations and tool metadata
        res.write(
          `data: ${JSON.stringify({
            type: "recommendations",
            items: response.recommendations,
            intent: response.intent,
            toolsExecuted: response.toolsExecuted,
          })}\n\n`
        );

        res.write(`data: [DONE]\n\n`);
        res.end();
      } catch (err: unknown) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Streaming error",
            details: err instanceof Error ? err.message : String(err),
          })
        );
      }
    });
    return;
  }

  // 4. Bargain probability calculation tool endpoint
  if (req.method === "POST" && url.pathname === "/tools/bargain") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        const { originalPrice, offeredPrice } = JSON.parse(body || "{}");
        if (!originalPrice || !offeredPrice) {
          res.writeHead(422, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "originalPrice and offeredPrice are required integers." }));
          return;
        }

        const result = engine.evaluateOffer(Number(originalPrice), Number(offeredPrice));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Malformed JSON payload" }));
      }
    });
    return;
  }

  // 404 Fallback
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Endpoint not found" }));
});

server.listen(PORT, () => {
  console.log(`🚀 Gadgets Garden AI Agent Service listening on port ${PORT}`);
});

export { server };
