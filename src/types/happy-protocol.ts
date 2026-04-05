/**
 * Happy App 兼容的协议类型定义
 *
 * 基于 Happy Server 的 Artifact 协议格式:
 * - header: base64 加密的元数据
 * - body: base64 加密的实际内容
 * - headerVersion/bodyVersion: 乐观并发控制
 */

/**
 * 基础 Artifact 结构 (与服务器 API 一致)
 */
export interface HappyArtifact {
  id: string
  header: string  // base64(加密的 header JSON)
  body?: string   // base64(加密的 body JSON)
  dataEncryptionKey: string  // base64(加密的数据密钥)
  accountId: string
  sessionId: string
  headerVersion: number
  bodyVersion: number
  seq: number
  createdAt: number
  updatedAt: number
}

/**
 * Header 基础结构
 */
export interface HappyArtifactHeader {
  type: 'message' | 'tool-call' | 'permission' | 'system'
  subtype: string
  title?: string
  icon?: string
  timestamp?: number
  [key: string]: any
}

/**
 * Body 基础结构
 */
export interface HappyArtifactBody {
  version: number
  timestamp?: number
  [key: string]: any
}

/**
 * 消息类型 Artifact
 */
export interface MessageArtifactHeader extends HappyArtifactHeader {
  type: 'message'
  subtype: 'user-message' | 'assistant-message' | 'system-message'
  title: string
}

export interface UserMessageBody extends HappyArtifactBody {
  type: 'user-message'
  content: string
  timestamp: number
}

export interface AssistantMessageBody extends HappyArtifactBody {
  type: 'assistant-message'
  content: string
  inputTokens?: number
  outputTokens?: number
  toolCalls?: number
  timestamp: number
}

export interface SystemMessageBody extends HappyArtifactBody {
  type: 'system-message'
  content: string
  level?: 'info' | 'warning' | 'error'
}

export interface MessageArtifact extends Omit<HappyArtifact, 'header' | 'body'> {
  header: MessageArtifactHeader
  body: UserMessageBody | AssistantMessageBody | SystemMessageBody
}

/**
 * 工具调用类型 Artifact
 */
export interface ToolCallArtifactHeader extends HappyArtifactHeader {
  type: 'tool-call'
  subtype: string
  toolName: string
  toolDisplayName: string
  icon: string
  status: 'started' | 'in_progress' | 'completed' | 'failed'
  inputSummary?: string
}

export interface ToolCallArtifactBody extends HappyArtifactBody {
  input?: Record<string, any>
  output?: string
  outputType?: 'text' | 'json' | 'file' | 'image'
  error?: string
  durationMs?: number
  progress?: number
  status: 'started' | 'in_progress' | 'completed' | 'failed'
}

export interface ToolCallArtifact extends Omit<HappyArtifact, 'header' | 'body'> {
  header: ToolCallArtifactHeader
  body: ToolCallArtifactBody
}

/**
 * 权限请求类型 Artifact
 */
export interface PermissionArtifactHeader extends HappyArtifactHeader {
  type: 'permission'
  toolName: string
  toolDisplayName: string
  toolDescription: string
  icon: string
  level: RiskLevel
  levelLabel: string
  levelIcon: string
  levelColor: string
}

export interface PermissionArtifactBody extends HappyArtifactBody {
  inputSummary: string
  riskExplanation: string
  permissionOptions: PermissionOption[]
  response?: {
    choice: string
    timestamp: number
  }
}

export interface PermissionArtifact extends Omit<HappyArtifact, 'header' | 'body'> {
  header: PermissionArtifactHeader
  body: PermissionArtifactBody
}

/**
 * 风险等级
 */
export type RiskLevel = 'READ_ONLY' | 'MODIFY_STATE' | 'NETWORK' | 'DESTRUCTIVE' | 'AGENT_SPAWN'

export interface RiskLevelInfo {
  value: RiskLevel
  label: string
  icon: string
  color: string
}

/**
 * 权限选项
 */
export interface PermissionOption {
  value: string
  label: string
  shortcut?: string
  style: 'default' | 'primary' | 'warning' | 'danger'
  description?: string
}

/**
 * 会话统计
 */
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

/**
 * 工具定义
 */
export interface ToolDefinition {
  name: string
  displayName: string
  description: string
  icon: string
  inputSchema: Record<string, any>
  category: 'file' | 'shell' | 'network' | 'system' | 'ai'
}

/**
 * 工具状态 (用于 ToolStateDisplay)
 */
export interface ToolState {
  sessionId: string
  artifacts: ToolArtifact[]
}

export interface ToolArtifact {
  id: string
  sessionId: string
  accountId: string
  header?: {
    name: string
    type: string
    status: 'todo' | 'plan' | 'pending_confirmation' | 'executing' | 'completed' | 'failed'
    [key: string]: any
  }
  body?: {
    todo?: string
    plan?: string[]
    input?: Record<string, any>
    output?: Record<string, any>
    error?: string
    progress?: string
    confirmation?: {
      requested: boolean
      granted: boolean
    }
    [key: string]: any
  }
  headerVersion: number
  bodyVersion: number
  seq: number
  createdAt: number
  updatedAt: number
}

/**
 * 聊天消息 (用于兼容旧代码)
 */
export interface ChatMessageDTO {
  id: string
  type: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL'
  content: string
  timestamp: string
  inputTokens?: number
  outputTokens?: number
}
