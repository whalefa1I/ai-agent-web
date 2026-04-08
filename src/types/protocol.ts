// WebSocket 协议类型
export interface WSProtocol {
  PROTOCOL_VERSION: string
}

// 风险等级
export type RiskLevel = 'READ_ONLY' | 'MODIFY_STATE' | 'NETWORK' | 'DESTRUCTIVE' | 'AGENT_SPAWN'

export interface RiskLevelInfo {
  value: RiskLevel
  label: string
  icon: string
  color: string
}

// 客户端消息类型
export type ClientMessageType =
  | 'USER_MESSAGE'
  | 'PERMISSION_RESPONSE'
  | 'GET_HISTORY'
  | 'GET_STATS'
  | 'PING'
  | 'STOP_TASK'

// 服务端消息类型
export type ServerMessageType =
  | 'CONNECTED'
  | 'RESPONSE_START'
  | 'TEXT_DELTA'
  | 'TOOL_CALL'
  | 'PERMISSION_REQUEST'
  | 'RESPONSE_COMPLETE'
  | 'ERROR'
  | 'PONG'
  | 'HISTORY'
  | 'STATS'
  | 'TASK_UPDATE'

// 客户端消息基类
export interface ClientMessage {
  type: ClientMessageType
  requestId?: string
  timestamp?: string
}

// 用户消息
export interface UserMessage extends ClientMessage {
  type: 'USER_MESSAGE'
  content: string
}

// 权限响应
export interface PermissionResponseMessage extends ClientMessage {
  type: 'PERMISSION_RESPONSE'
  requestId: string
  choice: 'ALLOW_ONCE' | 'ALLOW_SESSION' | 'ALLOW_ALWAYS' | 'DENY'
  sessionDurationMinutes?: number
}

// 服务端消息基类
export interface ServerMessage {
  type: ServerMessageType
  requestId?: string
  timestamp?: string
}

// 连接确认
export interface ConnectedMessage extends ServerMessage {
  type: 'CONNECTED'
  sessionId: string
  serverVersion: string
}

// 响应开始
export interface ResponseStartMessage extends ServerMessage {
  type: 'RESPONSE_START'
  turnId: string
}

// 文本增量
export interface TextDeltaMessage extends ServerMessage {
  type: 'TEXT_DELTA'
  delta: string
}

// 工具调用状态
export type ToolCallStatus = 'started' | 'in_progress' | 'completed' | 'failed'

// 工具调用消息
export interface ToolCallMessage extends ServerMessage {
  type: 'TOOL_CALL'
  toolCallId: string
  toolName: string
  toolDisplayName: string
  icon: string
  input?: Record<string, any>
  inputDisplay?: string
  status: ToolCallStatus
  output?: string
  outputType?: 'text' | 'json' | 'file' | 'image'
  error?: string
  durationMs?: number
  progress?: number
}

// 权限选项
export interface PermissionOption {
  value: string
  label: string
  shortcut?: string
  style: 'default' | 'primary' | 'warning' | 'danger'
  description?: string
}

// 权限请求消息
export interface PermissionRequestMessage extends ServerMessage {
  type: 'PERMISSION_REQUEST'
  id: string
  toolName: string
  toolDisplayName: string
  toolDescription: string
  icon: string
  level: RiskLevel
  levelLabel: string
  levelIcon: string
  levelColor: string
  inputSummary: string
  riskExplanation: string
  permissionOptions: PermissionOption[]
}

// 响应完成
export interface ResponseCompleteMessage extends ServerMessage {
  type: 'RESPONSE_COMPLETE'
  content: string
  inputTokens: number
  outputTokens: number
  durationMs: number
  toolCalls: number
}

// 错误消息
export interface ErrorMessage extends ServerMessage {
  type: 'ERROR'
  code: string
  message: string
  details?: Record<string, any>
}

// 聊天消息
export interface ChatMessageDTO {
  id: string
  type: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL' | 'TODO' | 'THINKING'
  subtype?: string
  content: string
  timestamp: string
  inputTokens?: number
  outputTokens?: number
  toolCall?: any  // ToolCallArtifact
  todo?: any      // TodoArtifact
}

// 历史消息
export interface HistoryMessage extends ServerMessage {
  type: 'HISTORY'
  messages: ChatMessageDTO[]
}

// 会话统计
export interface SessionStats {
  sessionId: string
  sessionStartedAt: string
  durationSeconds: number
  totalModelCalls: number
  totalToolCalls: number
  totalInputTokens: number
  totalOutputTokens: number
  averageModelLatencyMs: number
  toolSuccessRate: number
}

// 统计消息
export interface StatsMessage extends ServerMessage {
  type: 'STATS'
  stats: SessionStats
}

// 导出类型映射
export type AnyClientMessage = UserMessage | PermissionResponseMessage
export type AnyServerMessage =
  | ConnectedMessage
  | ResponseStartMessage
  | TextDeltaMessage
  | ToolCallMessage
  | PermissionRequestMessage
  | ResponseCompleteMessage
  | ErrorMessage
  | HistoryMessage
  | StatsMessage
