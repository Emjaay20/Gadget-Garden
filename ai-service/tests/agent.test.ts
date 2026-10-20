import test from "node:test";
import assert from "node:assert";
import { AgentEngine } from "../src/agent/agent-engine.js";
import { calculateBargainProbabilityTool } from "../src/tools/catalog-tools.js";
import { ChatRequestSchema } from "../src/types.js";

test("calculateBargainProbabilityTool: auto-declines below 70%", () => {
  const result = calculateBargainProbabilityTool(1_000_000, 500_000);
  assert.strictEqual(result.status, "auto_decline");
  assert.strictEqual(result.probability, 0);
  assert.strictEqual(result.discountPercent, 50);
});

test("calculateBargainProbabilityTool: auto-accepts at 95% or higher", () => {
  const result = calculateBargainProbabilityTool(1_000_000, 960_000);
  assert.strictEqual(result.status, "auto_accept");
  assert.strictEqual(result.probability, 100);
  assert.strictEqual(result.discountPercent, 4);
});

test("calculateBargainProbabilityTool: queues for review between 70% and 94%", () => {
  const result = calculateBargainProbabilityTool(1_000_000, 850_000);
  assert.strictEqual(result.status, "review_queue");
  assert.ok(result.probability > 0 && result.probability < 100);
  assert.strictEqual(result.discountPercent, 15);
});

test("AgentEngine: extracts budget and software development intent", async () => {
  const engine = new AgentEngine();
  const response = await engine.processInquiry({
    query: "Need a clean laptop for programming and docker under 650k with 16gb ram",
  });

  assert.strictEqual(response.intent.purpose, "software_development");
  assert.strictEqual(response.intent.budgetMax, 650_000);
  assert.strictEqual(response.intent.minRam, 16);
  assert.ok(response.toolsExecuted.includes("searchInventoryTool"));
  assert.ok(typeof response.message === "string");
});

test("AgentEngine: detects order tracking intent", async () => {
  const engine = new AgentEngine();
  const response = await engine.processInquiry({
    query: "Where is my order GG-TEST1234?",
  });

  assert.ok(response.toolsExecuted.includes("trackOrderTool"));
});

test("ChatRequestSchema: validates incoming payload", () => {
  const valid = ChatRequestSchema.safeParse({
    query: "Show me gaming laptops",
    budgetMax: 900_000,
  });
  assert.strictEqual(valid.success, true);

  const invalid = ChatRequestSchema.safeParse({
    query: "",
  });
  assert.strictEqual(invalid.success, false);
});
