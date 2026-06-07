#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, callTool } from "./tools.js";

/**
 * The RQML MCP server. Exposes @rqml/core capabilities as agent tools over stdio.
 * Uses the SDK's stable low-level request-handler API so it is robust across SDK
 * minor versions; the tool logic lives in ./tools.ts and is shared in spirit
 * with the `rqml` CLI for CLI/MCP parity (REQ-MCP-PARITY).
 */
const server = new Server(
  { name: "rqml", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await callTool(name, args ?? {});
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
