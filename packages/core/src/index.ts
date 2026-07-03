export * from "./providers/types.js";
export * from "./providers/registry.js";
export { OpenAICompatibleProvider } from "./providers/openai-compatible.js";
export { AnthropicProvider } from "./providers/anthropic.js";

export { Agent, type AgentOptions } from "./agent/agent.js";
export {
  runTask,
  type RunOptions,
  type RunResult,
  type RunHooks,
} from "./agent/loop.js";

export {
  type Tool,
  type ToolContext,
  toToolSchema,
  truncate,
} from "./tools/types.js";
export {
  BUILTIN_TOOLS,
  shellTool,
  readFileTool,
  writeFileTool,
  listDirTool,
  httpFetchTool,
} from "./tools/builtins.js";
export {
  PermissionManager,
  DEFAULT_POLICY,
  resolvePolicy,
  type Decision,
  type PermissionPolicy,
  type PermissionRequest,
  type Confirmer,
} from "./tools/permissions.js";
export { ScopeGuard } from "./tools/scope.js";

export {
  Recorder,
  type RecordedSession,
  type RecordedEvent,
  type ToolStatus,
} from "./recorder/session.js";
export {
  saveSession,
  loadSession,
  listSessions,
  latestSession,
  saveReport,
  SESSIONS_DIR,
  REPORTS_DIR,
  type SessionSummary,
} from "./recorder/store.js";

export {
  loadConfig,
  saveConfig,
  resolveModel,
  keyFromConfig,
  CONFIG_PATH,
  CONFIG_DIR,
  type NyxConfig,
} from "./config/config.js";
