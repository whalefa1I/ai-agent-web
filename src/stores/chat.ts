import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { httpApi } from '@/services/http'
import type {
  ChatMessageDTO,
  ToolCallMessage,
  PermissionRequestMessage,
  SessionStats
} from '@/types/protocol'

export const useChatStore = defineStore('chat', () => {
  // 状态
  const messages = ref<ChatMessageDTO[]>([])
  const pendingToolCalls = ref<ToolCallMessage[]>([])
  const pendingPermission = ref<PermissionRequestMessage | null>(null)
  const stats = ref<SessionStats | null>(null)
  const isThinking = ref(false)
  const currentResponse = ref('')
  const serverUrl = ref('')

  // 计算属性
  const hasPendingPermission = computed(() => pendingPermission.value !== null)
  const hasPendingToolCalls = computed(() => pendingToolCalls.value.length > 0)

  // 初始化服务器地址
  function initServerUrl() {
    const saved = localStorage.getItem('ai-agent-settings')
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        serverUrl.value = settings.serverUrl || 'https://ai-agent-server-production-d28a.up.railway.app'
      } catch (e) {
        serverUrl.value = 'https://ai-agent-server-production-d28a.up.railway.app'
      }
    } else {
      serverUrl.value = 'https://ai-agent-server-production-d28a.up.railway.app'
    }
  }

  // 添加用户消息
  function addUserMessage(content: string) {
    messages.value.push({
      id: `msg_${Date.now()}`,
      type: 'USER',
      content,
      timestamp: new Date().toISOString()
    })
  }

  // 添加助手消息
  function addAssistantMessage(content: string) {
    messages.value.push({
      id: `msg_${Date.now()}`,
      type: 'ASSISTANT',
      content,
      timestamp: new Date().toISOString()
    })
  }

  // 更新助手消息（流式）
  function updateAssistantMessage(content: string) {
    const lastMessage = messages.value[messages.value.length - 1]
    if (lastMessage && lastMessage.type === 'ASSISTANT') {
      lastMessage.content += content
    } else {
      addAssistantMessage(content)
    }
  }

  // 添加工具调用
  function addToolCall(toolCall: ToolCallMessage) {
    const index = pendingToolCalls.value.findIndex(tc => tc.toolCallId === toolCall.toolCallId)
    if (index >= 0) {
      pendingToolCalls.value[index] = toolCall
    } else {
      pendingToolCalls.value.push(toolCall)
    }
  }

  // 更新工具调用状态
  function updateToolCall(toolCallId: string, updates: Partial<ToolCallMessage>) {
    const index = pendingToolCalls.value.findIndex(tc => tc.toolCallId === toolCallId)
    if (index >= 0) {
      pendingToolCalls.value[index] = { ...pendingToolCalls.value[index], ...updates }
    }
  }

  // 清除工具调用
  function clearToolCalls() {
    pendingToolCalls.value = []
  }

  // 设置权限请求
  function setPermissionRequest(request: PermissionRequestMessage) {
    pendingPermission.value = request
  }

  // 清除权限请求
  function clearPermissionRequest() {
    pendingPermission.value = null
  }

  // 更新统计
  function updateStats(newStats: SessionStats) {
    stats.value = newStats
  }

  // 发送消息（HTTP API）
  async function sendMessage(content: string) {
    console.log('[chatStore] sendMessage called with:', content)
    console.log('[chatStore] serverUrl:', serverUrl.value)

    if (!content.trim()) {
      console.warn('[chatStore] 空消息，忽略')
      return
    }

    addUserMessage(content)
    isThinking.value = true
    currentResponse.value = ''

    try {
      // 使用流式 SSE 方式
      const controller = new AbortController()
      const url = `${serverUrl.value}/api/v2/chat/stream?message=${encodeURIComponent(content)}`
      console.log('[chatStore] 请求 URL:', url)

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' }
      })

      console.log('[chatStore] 响应状态:', response.status, response.ok)

      if (!response.body) {
        throw new Error('响应体为空')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let hasAssistantMessage = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            console.log('SSE 事件:', data.type, data)

            if (data.type === 'TEXT_DELTA') {
              // 文本增量
              if (!hasAssistantMessage) {
                addAssistantMessage(data.delta)
                hasAssistantMessage = true
              } else {
                updateAssistantMessage(data.delta)
              }
              currentResponse.value += data.delta
            } else if (data.type === 'RESPONSE_START') {
              // 响应开始 - 创建空消息
              if (!hasAssistantMessage) {
                addAssistantMessage('')
                hasAssistantMessage = true
              }
            } else if (data.type === 'RESPONSE_COMPLETE') {
              // 响应完成 - 如果有完整内容，确保显示
              isThinking.value = false
              clearToolCalls()
              // 如果后端返回了完整 content 但前面没有 TEXT_DELTA，确保消息被添加
              if (data.content && !hasAssistantMessage) {
                addAssistantMessage(data.content)
              }
            } else if (data.type === 'TOOL_CALL') {
              addToolCall({
                toolCallId: data.toolCallId || `tool_${Date.now()}`,
                toolName: data.toolName,
                toolDisplayName: data.toolName,
                icon: 'tool',
                input: data.input,
                status: 'started',
                type: 'TOOL_CALL'
              })
            } else if (data.type === 'ERROR') {
              addAssistantMessage(`错误：${data.message || '未知错误'}`)
              isThinking.value = false
            }
          }
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      isThinking.value = false
      addAssistantMessage(`错误：${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 响应权限请求（HTTP API）
  async function respondPermission(
    requestId: string,
    choice: 'ALLOW_ONCE' | 'ALLOW_SESSION' | 'ALLOW_ALWAYS' | 'DENY'
  ) {
    await fetch(`${serverUrl.value}/api/v2/permissions/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, choice })
    })
    clearPermissionRequest()
  }

  // 获取历史消息
  async function loadHistory(limit: number = 50) {
    try {
      const res = await fetch(`${serverUrl.value}/api/v2/messages?limit=${limit}`)
      const data = await res.json()
      messages.value = data
    } catch (error) {
      console.error('加载历史失败:', error)
    }
  }

  // 获取统计
  async function loadStats() {
    try {
      const res = await fetch(`${serverUrl.value}/api/v2/stats`)
      const data = await res.json()
      stats.value = data
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  }

  // 更新服务器地址
  function updateServerUrl(newUrl: string) {
    serverUrl.value = newUrl
  }

  return {
    // 状态
    messages,
    pendingToolCalls,
    pendingPermission,
    stats,
    isThinking,
    currentResponse,
    serverUrl,
    // 计算属性
    hasPendingPermission,
    hasPendingToolCalls,
    // 方法
    addUserMessage,
    addAssistantMessage,
    updateAssistantMessage,
    addToolCall,
    updateToolCall,
    clearToolCalls,
    setPermissionRequest,
    clearPermissionRequest,
    updateStats,
    sendMessage,
    respondPermission,
    initServerUrl,
    loadHistory,
    loadStats,
    updateServerUrl
  }
})
