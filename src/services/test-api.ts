/**
 * Test API Service
 *
 * 用于测试后端 WebSocket 流式输出功能
 * 支持 reasoning_content 流式推送测试
 */

import type { AgentWebSocketStateInfo } from './agent-websocket'
import { agentWebSocketClient } from './agent-websocket'

export interface TestMessage {
  type: 'reasoning' | 'text' | 'tool_call_start' | 'tool_call_end' | 'complete'
  content: string
  timestamp: number
  turnId?: string
  toolName?: string
  toolCallId?: string
  input?: Record<string, any>
  output?: string
  inputTokens?: number
  outputTokens?: number
  durationMs?: number
}

export interface TestState {
  status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'error'
  messages: TestMessage[]
  stateInfo: AgentWebSocketStateInfo | null
  error: string | null
  stats: {
    reasoningCount: number
    textCount: number
    toolCallCount: number
    totalDurationMs: number
    inputTokens: number
    outputTokens: number
  }
}

export interface TestCallbacks {
  onStateChange?: (state: TestState) => void
  onMessage?: (message: TestMessage) => void
}

/**
 * 测试 API 服务类
 */
export class TestApiService {
  private state: TestState = {
    status: 'idle',
    messages: [],
    stateInfo: null,
    error: null,
    stats: {
      reasoningCount: 0,
      textCount: 0,
      toolCallCount: 0,
      totalDurationMs: 0,
      inputTokens: 0,
      outputTokens: 0
    }
  }

  private callbacks: TestCallbacks = {}
  private unsubscribeWs?: () => void
  private startTime?: number

  constructor() {
    // 订阅 WebSocket 状态
    this.unsubscribeWs = agentWebSocketClient.subscribeState((wsState) => {
      this.state.stateInfo = wsState
      this.notifyStateChange()
    })
  }

  /**
   * 设置回调
   */
  setCallbacks(callbacks: TestCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * 通知状态变化
   */
  private notifyStateChange(): void {
    this.callbacks.onStateChange?.({ ...this.state })
  }

  /**
   * 添加消息
   */
  private addMessage(message: TestMessage): void {
    this.state.messages.push(message)

    // 更新统计
    switch (message.type) {
      case 'reasoning':
        this.state.stats.reasoningCount++
        break
      case 'text':
        this.state.stats.textCount++
        break
      case 'tool_call_start':
        this.state.stats.toolCallCount++
        break
      case 'complete':
        this.state.stats.totalDurationMs = message.durationMs || 0
        this.state.stats.inputTokens = message.inputTokens || 0
        this.state.stats.outputTokens = message.outputTokens || 0
        break
    }

    this.notifyStateChange()
    this.callbacks.onMessage?.(message)
  }

  /**
   * 获取当前状态
   */
  getState(): TestState {
    return { ...this.state }
  }

  /**
   * 获取所有消息
   */
  getMessages(): TestMessage[] {
    return [...this.state.messages]
  }

  /**
   * 获取统计信息
   */
  getStats(): TestState['stats'] {
    return { ...this.state.stats }
  }

  /**
   * 清空状态
   */
  clear(): void {
    this.state = {
      status: 'idle',
      messages: [],
      stateInfo: this.state.stateInfo,
      error: null,
      stats: {
        reasoningCount: 0,
        textCount: 0,
        toolCallCount: 0,
        totalDurationMs: 0,
        inputTokens: 0,
        outputTokens: 0
      }
    }
    this.startTime = undefined
    this.notifyStateChange()
  }

  /**
   * 连接 WebSocket
   */
  connect(token?: string): void {
    this.state.status = 'connecting'
    this.state.error = null
    this.notifyStateChange()

    agentWebSocketClient.connect(token)
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    agentWebSocketClient.disconnect()
    this.state.status = 'idle'
    this.notifyStateChange()
  }

  /**
   * 开始流式测试
   */
  startStreaming(content: string, callbacks?: {
    onReasoning?: (delta: string) => void
    onText?: (delta: string) => void
    onToolCallStart?: (toolCallId: string, toolName: string, input?: Record<string, any>) => void
    onToolCallEnd?: (toolCallId: string, toolName: string, output?: string) => void
    onComplete?: (content: string, inputTokens: number, outputTokens: number, durationMs: number) => void
  }): void {
    this.startTime = Date.now()
    this.state.status = 'streaming'
    this.state.error = null
    this.state.messages = []
    this.state.stats = {
      reasoningCount: 0,
      textCount: 0,
      toolCallCount: 0,
      totalDurationMs: 0,
      inputTokens: 0,
      outputTokens: 0
    }
    this.notifyStateChange()

    // 订阅 WebSocket 消息
    this.unsubscribeWs = agentWebSocketClient.subscribeMessage({
      responseStart: (turnId: string) => {
        console.log('[TestAPI] Response started:', turnId)
      },
      textDelta: (delta: string) => {
        this.addMessage({
          type: 'text',
          content: delta,
          timestamp: Date.now()
        })
        callbacks?.onText?.(delta)
      },
      toolCallStart: (toolCallId: string, toolName: string, input?: Record<string, any>) => {
        this.addMessage({
          type: 'tool_call_start',
          content: `Tool ${toolName} started`,
          timestamp: Date.now(),
          toolCallId,
          toolName,
          input
        })
        callbacks?.onToolCallStart?.(toolCallId, toolName, input)
      },
      toolCallComplete: (toolCallId: string, toolName: string, output: string, durationMs?: number) => {
        this.addMessage({
          type: 'tool_call_end',
          content: `Tool ${toolName} completed`,
          timestamp: Date.now(),
          toolCallId,
          toolName,
          output,
          durationMs
        })
        callbacks?.onToolCallEnd?.(toolCallId, toolName, output)
      },
      responseComplete: (content: string, inputTokens: number, outputTokens: number, durationMs: number) => {
        this.addMessage({
          type: 'complete',
          content,
          timestamp: Date.now(),
          inputTokens,
          outputTokens,
          durationMs
        })
        this.state.status = 'completed'
        this.notifyStateChange()
        callbacks?.onComplete?.(content, inputTokens, outputTokens, durationMs)
      },
      error: (code: string, message: string) => {
        this.state.error = `${code}: ${message}`
        this.state.status = 'error'
        this.notifyStateChange()
      },
      connected: (sessionId: string) => {
        console.log('[TestAPI] Connected:', sessionId)
      }
    })

    // 发送测试消息
    const sent = agentWebSocketClient.sendMessage(content)
    if (!sent) {
      this.state.error = 'Failed to send message - WebSocket not connected'
      this.state.status = 'error'
      this.notifyStateChange()
    }
  }

  /**
   * 停止流式测试
   */
  stopStreaming(): void {
    this.unsubscribeWs?.()
    this.state.status = 'idle'
    this.notifyStateChange()
  }

  /**
   * 发送测试消息（简单模式）
   */
  async sendTestMessage(content: string): Promise<{
    success: boolean
    messages: TestMessage[]
    error?: string
  }> {
    return new Promise((resolve) => {
      this.clear()
      this.connect()

      // 等待连接
      setTimeout(() => {
        if (!agentWebSocketClient.isConnected()) {
          resolve({
            success: false,
            messages: [],
            error: 'WebSocket connection failed'
          })
          return
        }

        // 开始流式测试
        this.startStreaming(content, {
          onComplete: () => {
            setTimeout(() => {
              resolve({
                success: true,
                messages: this.getMessages()
              })
            }, 500)
          }
        })
      }, 1000)
    })
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.unsubscribeWs?.()
    this.callbacks = {}
  }
}

// 导出单例
export const testApi = new TestApiService()
