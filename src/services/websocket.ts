import type {
  ClientMessage,
  UserMessage,
  PermissionResponseMessage,
  AnyServerMessage,
  PermissionRequestMessage,
  ToolCallMessage,
  ChatMessageDTO
} from '@/types/protocol'

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export type MessageHandler = (message: AnyServerMessage) => void

export class WebSocketService {
  private ws: WebSocket | null = null
  private url: string
  private reconnectTimer: number | null = null
  private heartbeatTimer: number | null = null
  private status: WebSocketStatus = 'disconnected'
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private sessionId: string | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  constructor(baseUrl: string = '') {
    // 自动检测 WebSocket 地址
    if (!baseUrl) {
      // 优先使用环境变量配置的服务器地址
      const envServer = (import.meta as any).env?.VITE_SERVER_URL
      if (envServer) {
        this.url = envServer.replace('http:', 'ws:').replace('https:', 'wss:')
        if (!this.url.endsWith('/ws/agent')) {
          this.url = `${this.url.replace(/\/$/, '')}/ws/agent/web-token`
        }
      } else {
        // 否则使用当前域名的 WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        this.url = `${protocol}//${window.location.host}/ws/agent/web-token`
      }
    } else {
      this.url = baseUrl.replace('http:', 'ws:').replace('https:', 'wss:')
      if (!this.url.endsWith('/ws/agent')) {
        this.url = `${this.url.replace(/\/$/, '')}/ws/agent/web-token`
      }
    }
  }

  // 订阅特定类型的消息
  on<T extends AnyServerMessage>(type: T['type'], handler: (msg: T) => void): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    const typedHandler = handler as MessageHandler
    this.handlers.get(type)!.add(typedHandler)

    return () => {
      this.handlers.get(type)?.delete(typedHandler)
    }
  }

  // 连接 WebSocket
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)
        this.status = 'connecting'

        this.ws.onopen = () => {
          this.status = 'connected'
          this.reconnectAttempts = 0
          this.startHeartbeat()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as AnyServerMessage
            this.handleMessage(message)
          } catch (error) {
            console.error('解析消息失败:', error)
          }
        }

        this.ws.onclose = () => {
          this.status = 'disconnected'
          this.stopHeartbeat()
          this.attemptReconnect()
        }

        this.ws.onerror = (error) => {
          this.status = 'error'
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  // 断开连接
  disconnect(): void {
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.status = 'disconnected'
  }

  // 发送用户消息
  sendMessage(content: string): void {
    const message: UserMessage = {
      type: 'USER_MESSAGE',
      content,
      requestId: `req_${Date.now()}`
    }
    this.send(message)
  }

  // 发送权限响应
  sendPermissionResponse(
    requestId: string,
    choice: 'ALLOW_ONCE' | 'ALLOW_SESSION' | 'ALLOW_ALWAYS' | 'DENY',
    sessionDurationMinutes?: number
  ): void {
    const message: PermissionResponseMessage = {
      type: 'PERMISSION_RESPONSE',
      requestId,
      choice,
      ...(sessionDurationMinutes && { sessionDurationMinutes })
    }
    this.send(message)
  }

  // 获取历史消息
  getHistory(limit: number = 20): void {
    this.send({
      type: 'GET_HISTORY',
      requestId: `req_${Date.now()}`,
      timestamp: new Date().toISOString(),
      limit
    } as ClientMessage & { limit: number })
  }

  // 获取统计信息
  getStats(): void {
    this.send({ type: 'GET_STATS' })
  }

  // 发送心跳
  ping(): void {
    this.send({ type: 'PING' })
  }

  // 获取当前状态
  getStatus(): WebSocketStatus {
    return this.status
  }

  // 获取会话 ID
  getSessionId(): string | null {
    return this.sessionId
  }

  // 私有方法

  private send(message: ClientMessage): void {
    if (this.ws && this.status === 'connected') {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket 未连接，无法发送消息:', message)
    }
  }

  private handleMessage(message: AnyServerMessage): void {
    // 处理会话 ID
    if (message.type === 'CONNECTED') {
      this.sessionId = (message as any).sessionId
    }

    // 通知订阅者
    const handlers = this.handlers.get(message.type)
    if (handlers) {
      handlers.forEach(handler => handler(message))
    }

    // 全局日志
    if ((import.meta as any).env?.DEV) {
      console.log('[WS] 收到消息:', message.type, message)
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = window.setInterval(() => {
      this.ping()
    }, 30000) // 每 30 秒发送一次心跳
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('WebSocket 重连失败，已达最大尝试次数')
      return
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++

    console.log(`WebSocket 将在 ${delay}ms 后重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    this.reconnectTimer = window.setTimeout(() => {
      this.connect().catch(console.error)
    }, delay)
  }
}

// 导出单例
export const wsService = new WebSocketService()

// 重新连接（带新地址）
export function reconnectWebSocket(baseUrl?: string): WebSocketService {
  const newService = new WebSocketService(baseUrl)
  // 复制旧服务的事件处理器
  wsService.handlers.forEach((handlers, type) => {
    handlers.forEach(handler => {
      newService.on(type as any, handler as any)
    })
  })
  // 断开旧连接
  wsService.disconnect()
  // 返回新服务
  return newService
}
