#!/usr/bin/env node
/**
 * Google Service MCP Server
 *
 * An MCP server that provides access to Google Meet API:
 * - List conference records (past meetings)
 * - Get meeting participants
 * - Access recordings and transcripts
 * - Create meeting spaces
 * - Calendar integration for upcoming/past meetings
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { logger } from "./logger.js";
import { tools, handleToolCall } from "./tools/index.js";
import { createErrorResponse } from "./utils.js";

// Server metadata
const SERVER_NAME = "google-service";
const SERVER_VERSION = "1.0.0";

/**
 * Create and configure the MCP server
 */
function createServer(): Server {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug("Listing available tools");
    return { tools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      return await handleToolCall(name, args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Tool call failed: ${name}`, error);
      return createErrorResponse(`Error: ${message}`);
    }
  });

  return server;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  logger.info(`Starting ${SERVER_NAME} v${SERVER_VERSION}`);

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info("Server connected and ready");
  console.error(`Google Service MCP Server v${SERVER_VERSION} running on stdio`);
}

// Start the server
main().catch((error) => {
  logger.error("Fatal error during startup", error);
  console.error("Fatal error:", error);
  process.exit(1);
});
