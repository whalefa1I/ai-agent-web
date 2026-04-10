/**
 * Agent WebSocket Client
 *
 * 连接到后端 /ws/agent/{token} 端点，实现实时双向通信
 * 替代原有的 HTTP 轮询机制
 */

import type {
  ServerMessage,
  UserMessage,
  PermissionResponseMessage,
  ToolCallMessage,
  TextDeltaMessage,
  ResponseCompleteMessage,
  ResponseStartMessage,
  ErrorMessage,
  ConnectedMessage,
  HistoryMessage,
  GetHistoryMessage,
  ChatMessageDTO
} from '@/types/protocol'

export interface AgentWebSocketOptions {
  /** WebSocket URL，默认从当前页面 host 构建 */
  url?: string
  /** 自动重连间隔 (ms) */
  reconnectInterval?: number
  /** 最大重连次数 */
  maxReconnects?: number
  /** 心跳间隔 (ms) */
  heartbeatInterval?: number
}

export type AgentWebSocketState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface AgentWebSocketStateInfo {
  state: AgentWebSocketState
  sessionId: string | null
  error: string | null
  reconnectCount: number
}

/**
 * Agent WebSocket 客户端
 *
 * 功能：
 * - 发送用户消息
 * - 接收文本增量（流式输出）
 * - 接收工具调用开始/完成通知
 * - 接收权限请求
 * - 接收响应完成通知
 * - 获取历史消息
 */
export class AgentWebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnectInterval: number
  private maxReconnects: number
  private heartbeatInterval: number
  private reconnectCount: number = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private pingInterval: number = 30000 // 30 秒 ping 一次

  // 状态
  private state: AgentWebSocketState = 'disconnected'
  private sessionId: string | null = null
  private error: string | null = null

  // 回调
  private stateListeners: Set<(state: AgentWebSocketStateInfo) => void> = new Set()
  private messageListeners: {
    textDelta?: (delta: string) => void
    toolCallStart?: (toolCallId: string, toolName: string, input?: Record<string, any>) => void
    toolCallComplete?: (toolCallId: string, toolName: string, output: string, durationMs?: number) => void
    toolCallFailed?: (toolCallId: string, toolName: string, error: string, durationMs?: number) => void
    responseComplete?: (content: string, inputTokens: number, outputTokens: number, durationMs: number) => void
    responseStart?: (turnId: string) => void
    error?: (code: string, message: string) => void
    connected?: (sessionId: string) => void
    history?: (messages: ChatMessageDTO[]) => void
  } = {}

  constructor(options: AgentWebSocketOptions = {}) {
    this.url = options.url || this.getDefaultUrl()
    this.reconnectInterval = options.reconnectInterval || 3000
    this.maxReconnects = options.maxReconnects || 5
    this.heartbeatInterval = options.heartbeatInterval || 30000
  }

  /**
   * 获取默认 WebSocket URL
   * 优先使用环境变量 VITE_API_BASE_URL，其次使用当前页面 host（同域部署）
   */
  private getDefaultUrl(): string {
    // 检查是否配置了 API 基础 URL（用于前后端分离部署）
    const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_SERVER_URL
    if (apiBaseUrl && typeof apiBaseUrl === 'string') {
      // 从 HTTP API 地址推导 WebSocket 地址
      const wsProtocol = apiBaseUrl.startsWith('https:') ? 'wss:' : 'ws:'
      const wsHost = apiBaseUrl.replace(/^https?:\/\//, '')
      return `${wsProtocol}://${wsHost}/ws/agent/default-token`
    }
    // 同域部署：使用当前页面 host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws/agent/default-token`
  }

  /**
   * 更新 WebSocket URL（用于动态设置 token）
   */
  updateUrl(token: string): void {
    // 检查是否配置了 API 基础 URL
    const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_SERVER_URL
    let wsHost: string

    if (apiBaseUrl && typeof apiBaseUrl === 'string') {
      wsHost = apiBaseUrl.replace(/^https?:\/\//, '')
    } else {
      wsHost = window.location.host
    }

    const protocol = apiBaseUrl?.startsWith('https:') || window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    this.url = `${protocol}//${wsHost}/ws/agent/${token}`

    // 如果当前已连接，需要重连
    if (this.state === 'connected' || this.state === 'connecting') {
      this.disconnect()
      setTimeout(() => this.connect(), 100)
    }
  }

  /**
   * 更新状态并通知监听器
   */
  private setState(updates: Partial<AgentWebSocketStateInfo>): void {
    this.state = updates.state ?? this.state
    this.sessionId = updates.sessionId ?? this.sessionId
    this.error = updates.error ?? this.error
    this.reconnectCount = updates.reconnectCount ?? this.reconnectCount

    this.stateListeners.forEach(listener => listener(this.getState()))
  }

  /**
   * 订阅状态变化
   */
  subscribeState(listener: (state: AgentWebSocketStateInfo) => void): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  /**
   * 订阅消息
   */
  subscribeMessage(listeners: typeof this.messageListeners): () => void {
    Object.assign(this.messageListeners, listeners)
    return () => {
      Object.keys(listeners).forEach(key => {
        delete (this.messageListeners as any)[key]
      })
    }
  }

  /**
   * 连接 WebSocket
   */
  connect(token?: string): void {
    if (this.ws && (this.state === 'connected' || this.state === 'connecting')) {
      console.log('[AgentWS] 已存在连接或正在连接')
      return
    }

    if (token) {
      this.updateUrl(token)
    }

    this.setState({ state: 'connecting', error: null })

    try {
      this.ws = new WebSocket(this.url)
    } catch (e) {
      console.error('[AgentWS] 创建 WebSocket 失败:', e)
      this.setState({ state: 'error', error: 'Failed to create WebSocket' })
      return
    }

    this.ws.onopen = () => {
      console.log('[AgentWS] 连接成功')
      this.reconnectCount = 0
      this.startHeartbeat()
      // sessionId 会在 ConnectedMessage 中设置
    }

    this.ws.onclose = (event) => {
      console.log('[AgentWS] 连接关闭:', event.code, event.reason || '')
      this.ws = null
      this.stopHeartbeat()

      if (this.state === 'connected') {
        // 正常连接后断开，尝试重连
        this.scheduleReconnect(token)
      }

      this.setState({
        state: this.state === 'connecting' ? 'error' : 'disconnected',
        sessionId: null
      })
    }

    this.ws.onerror = (error) => {
      console.error('[AgentWS] 连接错误:', error)
      this.setState({ state: 'error', error: 'WebSocket connection error' })
    }

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data)
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const msg: ServerMessage = JSON.parse(data)
      console.log('[AgentWS] 收到消息:', msg.type)

      switch (msg.type) {
        case 'CONNECTED': {
          const connected = msg as ConnectedMessage
          this.sessionId = connected.sessionId
          this.setState({ state: 'connected', sessionId: connected.sessionId })
          this.messageListeners.connected?.(connected.sessionId)
          break
        }

        case 'RESPONSE_START': {
          const start = msg as ResponseStartMessage
          this.messageListeners.responseStart?.(start.turnId)
          break
        }

        case 'TEXT_DELTA': {
          const delta = msg as TextDeltaMessage
          this.messageListeners.textDelta?.(delta.delta)
          break
        }

        case 'TOOL_CALL': {
          const toolCall = msg as ToolCallMessage
          if (toolCall.status === 'started') {
            this.messageListeners.toolCallStart?.(
              toolCall.toolCallId,
              toolCall.toolName,
              toolCall.input
            )
          } else if (toolCall.status === 'completed') {
            this.messageListeners.toolCallComplete?.(
              toolCall.toolCallId,
              toolCall.toolName,
              toolCall.output || '',
              toolCall.durationMs
            )
          } else if (toolCall.status === 'failed') {
            this.messageListeners.toolCallFailed?.(
              toolCall.toolCallId,
              toolCall.toolName,
              toolCall.error || 'Unknown error',
              toolCall.durationMs
            )
          }
          break
        }

        case 'RESPONSE_COMPLETE': {
          const complete = msg as ResponseCompleteMessage
          this.messageListeners.responseComplete?.(
            complete.content,
            complete.inputTokens,
            complete.outputTokens,
            complete.durationMs
          )
          break
        }

        case 'ERROR': {
          const error = msg as ErrorMessage
          console.error('[AgentWS] 服务端错误:', error.code, error.message)
          this.messageListeners.error?.(error.code, error.message)
          break
        }

        case 'HISTORY': {
          const history = msg as HistoryMessage
          this.messageListeners.history?.(history.messages)
          break
        }

        default:
          console.log('[AgentWS] 未知消息类型:', msg.type)
      }
    } catch (error) {
      console.error('[AgentWS] 解析消息失败:', error)
    }
  }

  /**
   * 发送用户消息
   */
  sendMessage(content: string): boolean {
    if (this.state !== 'connected' || !this.ws) {
      console.warn('[AgentWS] 无法发送消息，连接未打开')
      return false
    }

    const msg: UserMessage = {
      type: 'USER_MESSAGE',
      content,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    try {
      this.ws.send(JSON.stringify(msg))
      return true
    } catch (error) {
      console.error('[AgentWS] 发送消息失败:', error)
      return false
    }
  }

  /**
   * 响应权限请求
   */
  respondPermission(
    requestId: string,
    choice: 'ALLOW_ONCE' | 'ALLOW_SESSION' | 'ALLOW_ALWAYS' | 'DENY',
    sessionDurationMinutes?: number
  ): boolean {
    if (this.state !== 'connected' || !this.ws) {
      console.warn('[AgentWS] 无法发送消息，连接未打开')
      return false
    }

    const msg: PermissionResponseMessage = {
      type: 'PERMISSION_RESPONSE',
      requestId,
      choice,
      sessionDurationMinutes
    }

    try {
      this.ws.send(JSON.stringify(msg))
      return true
    } catch (error) {
      console.error('[AgentWS] 发送消息失败:', error)
      return false
    }
  }

  /**
   * 获取历史消息
   */
  getHistory(limit: number = 20): boolean {
    if (this.state !== 'connected' || !this.ws) {
      console.warn('[AgentWS] 无法发送消息，连接未打开')
      return false
    }

    const msg: GetHistoryMessage = {
      type: 'GET_HISTORY',
      requestId: `history_${Date.now()}`,
      limit
    }

    try {
      this.ws.send(JSON.stringify(msg))
      return true
    } catch (error) {
      console.error('[AgentWS] 发送消息失败:', error)
      return false
    }
  }

  /**
   * 调度重连
   */
  private scheduleReconnect(token?: string): void {
    if (this.reconnectCount >= this.maxReconnects) {
      console.log('[AgentWS] 达到最大重连次数，停止重连')
      this.setState({ state: 'error', error: 'Max reconnects reached' })
      return
    }

    this.reconnectCount++
    this.setState({ reconnectCount: this.reconnectCount })

    // 指数退避
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectCount - 1)
    console.log(`[AgentWS] 将在 ${delay}ms 后重连 (${this.reconnectCount}/${this.maxReconnects})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect(token)
    }, delay)
  }

  /**
   * 停止重连
   */
  stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // 发送 ping
        this.ws.send(JSON.stringify({ type: 'PING' }))
      }
    }, this.pingInterval)
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopReconnect()
    this.stopHeartbeat()

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.setState({ state: 'disconnected', sessionId: null })
  }

  /**
   * 获取当前状态
   */
  getState(): AgentWebSocketStateInfo {
    return {
      state: this.state,
      sessionId: this.sessionId,
      error: this.error,
      reconnectCount: this.reconnectCount
    }
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.state === 'connected'
  }
}

// 创建全局单例
export const agentWebSocketClient = new AgentWebSocketClient()
