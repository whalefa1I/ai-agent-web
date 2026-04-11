/**
 * 测试 API HTTP 端点
 *
 * 用于通过 HTTP 请求测试 WebSocket 流式输出功能
 * 可以直接使用 curl 或 Postman 进行测试
 */

import { AgentWebSocketClient } from './agent-websocket'

// 测试会话存储
interface TestSession {
  id: string
  client: AgentWebSocketClient
  messages: Array<{
    type: string
    content: string
    timestamp: number
  }>
  state: 'idle' | 'streaming' | 'completed' | 'error'
  error?: string
  stats: {
    reasoningCount: number
    textCount: number
    toolCallCount: number
    inputTokens: number
    outputTokens: number
    durationMs: number
  }
}

const testSessions = new Map<string, TestSession>()

/**
 * 生成测试会话 ID
 */
function generateSessionId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 创建测试会话
 */
export function createTestSession(): TestSession {
  const id = generateSessionId()
  const client = new AgentWebSocketClient()

  const session: TestSession = {
    id,
    client,
    messages: [],
    state: 'idle',
    stats: {
      reasoningCount: 0,
      textCount: 0,
      toolCallCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0
    }
  }

  testSessions.set(id, session)
  return session
}

/**
 * 获取测试会话
 */
export function getTestSession(id: string): TestSession | undefined {
  return testSessions.get(id)
}

/**
 * 删除测试会话
 */
export function deleteTestSession(id: string): boolean {
  const session = testSessions.get(id)
  if (session) {
    session.client.disconnect()
    session.client.dispose?.()
    testSessions.delete(id)
    return true
  }
  return false
}

/**
 * 开始流式测试
 */
export function startStreamingTest(
  session: TestSession,
  content: string,
  callbacks?: {
    onMessage?: (type: string, content: string) => void
    onComplete?: (stats: TestSession['stats']) => void
    onError?: (error: string) => void
  }
): void {
  session.state = 'streaming'
  session.messages = []
  session.stats = {
    reasoningCount: 0,
    textCount: 0,
    toolCallCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    durationMs: 0
  }

  const startTime = Date.now()

  // 连接 WebSocket
  session.client.connect('test-token')

  // 订阅消息
  session.client.subscribeMessage({
    responseStart: (turnId: string) => {
      session.messages.push({
        type: 'RESPONSE_START',
        content: `Turn ID: ${turnId}`,
        timestamp: Date.now()
      })
      callbacks?.onMessage?.('RESPONSE_START', turnId)
    },
    textDelta: (delta: string) => {
      session.messages.push({
        type: 'TEXT_DELTA',
        content: delta,
        timestamp: Date.now()
      })
      session.stats.textCount++
      callbacks?.onMessage?.('TEXT_DELTA', delta)
    },
    toolCallStart: (toolCallId: string, toolName: string) => {
      session.messages.push({
        type: 'TOOL_CALL_START',
        content: `Tool: ${toolName}`,
        timestamp: Date.now()
      })
      session.stats.toolCallCount++
      callbacks?.onMessage?.('TOOL_CALL_START', toolName)
    },
    toolCallComplete: (toolCallId: string, toolName: string, output: string) => {
      session.messages.push({
        type: 'TOOL_CALL_COMPLETE',
        content: `Tool: ${toolName}, Output: ${output}`,
        timestamp: Date.now()
      })
      callbacks?.onMessage?.('TOOL_CALL_COMPLETE', output)
    },
    responseComplete: (content: string, inputTokens: number, outputTokens: number, durationMs: number) => {
      session.messages.push({
        type: 'RESPONSE_COMPLETE',
        content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        timestamp: Date.now()
      })
      session.stats.inputTokens = inputTokens
      session.stats.outputTokens = outputTokens
      session.stats.durationMs = durationMs
      session.state = 'completed'
      callbacks?.onComplete?.(session.stats)
    },
    error: (code: string, message: string) => {
      session.error = `${code}: ${message}`
      session.state = 'error'
      callbacks?.onError?.(session.error!)
    },
    connected: () => {
      console.log('[TestHTTP] Connected')
    }
  })

  // 发送消息
  setTimeout(() => {
    if (session.client.isConnected()) {
      const sent = session.client.sendMessage(content)
      if (!sent) {
        session.error = 'Failed to send message'
        session.state = 'error'
        callbacks?.onError?.(session.error)
      }
    } else {
      session.error = 'WebSocket not connected'
      session.state = 'error'
      callbacks?.onError?.(session.error)
    }
  }, 500)
}

/**
 * 获取会话状态
 */
export function getSessionStatus(session: TestSession): {
  state: string
  messageCount: number
  messages: Array<{ type: string; content: string; timestamp: number }>
  stats: TestSession['stats']
  error?: string
} {
  return {
    state: session.state,
    messageCount: session.messages.length,
    messages: session.messages,
    stats: session.stats,
    error: session.error
  }
}

/**
 * 清理所有测试会话
 */
export function cleanupAllSessions(): void {
  for (const [id, session] of testSessions.entries()) {
    session.client.disconnect()
    testSessions.delete(id)
  }
}
