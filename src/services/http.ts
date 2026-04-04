import type { ChatMessageDTO, SessionStats } from '@/types/protocol'

const API_BASE = '/api/v2'

export class HttpApiService {
  // 健康检查
  async health(): Promise<{ status: string; version: string; timestamp: string }> {
    const res = await fetch(`${API_BASE}/health`)
    return res.json()
  }

  // 获取统计信息
  async getStats(): Promise<SessionStats> {
    const res = await fetch(`${API_BASE}/stats`)
    return res.json()
  }

  // 发送消息（HTTP 方式，非 WebSocket）
  async chat(message: string): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    })
    return res.json()
  }

  // 流式输出（SSE）
  async chatStream(
    message: string,
    onDelta: (delta: string) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ): Promise<() => void> {
    const controller = new AbortController()
    const url = `${API_BASE}/chat/stream?message=${encodeURIComponent(message)}`

    const eventSource = new EventSource(url)

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'delta') {
        onDelta(data.content)
      } else if (data.type === 'complete') {
        onComplete()
        eventSource.close()
      }
    }

    eventSource.onerror = () => {
      onError('连接错误')
      eventSource.close()
    }

    return () => {
      controller.abort()
      eventSource.close()
    }
  }

  // 获取待确认的权限请求
  async getPendingPermissions(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/permissions`)
    return res.json()
  }

  // 提交权限响应（HTTP 方式）
  async respondPermission(
    requestId: string,
    choice: 'ALLOW_ONCE' | 'ALLOW_SESSION' | 'ALLOW_ALWAYS' | 'DENY'
  ): Promise<void> {
    await fetch(`${API_BASE}/permissions/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, choice })
    })
  }

  // 获取历史消息
  async getHistory(limit: number = 20): Promise<ChatMessageDTO[]> {
    const res = await fetch(`${API_BASE}/messages?limit=${limit}`)
    return res.json()
  }
}

export const httpApi = new HttpApiService()
