/**
 * Server capabilities (REQ-MCP-INTERACTION-BOUNDARY): the RQML MCP server is a
 * data plane — it advertises only the `tools` capability and depends on no
 * optional MCP client feature (resources, prompts, elicitation, sampling), so
 * every capability is reachable on tools-only hosts and stays at parity with the
 * CLI. Human interaction (review, accept) is the host integration's job, not the
 * server's.
 */
export const SERVER_CAPABILITIES = { tools: {} } as const;
