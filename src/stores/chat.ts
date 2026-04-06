import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { happyApi, HappyApiService } from '@/services/happy-api'
import type {
  HappyArtifact,
  MessageArtifact,
  ToolCallArtifact,
  PermissionArtifact,
  TodoArtifact,
  TodoArtifactHeader,
  ChatMessageDTO,
  SessionStats
} from '@/types/happy-protocol'

export const useChatStore = defineStore('chat', () => {
  // 状态
  const messages = ref<ChatMessageDTO[]>([])
  const pendingToolCalls = ref<ToolCallArtifact[]>([])
  const pendingPermission = ref<PermissionArtifact | null>(null)
  const todos = ref<TodoArtifact[]>([])
  const stats = ref<SessionStats | null>(null)
  const isThinking = ref(false)
  const apiService = ref<HappyApiService>(new HappyApiService())
  const stopPolling = ref<(() => void) | null>(null)

  // 计算属性
  const hasPendingPermission = computed(() => pendingPermission.value !== null)
  const hasPendingToolCalls = computed(() => pendingToolCalls.value.length > 0)
  const serverUrl = computed(() => apiService.value.getServerUrl())
  const sessionId = computed(() => apiService.value.getSessionId())
  const userId = computed(() => apiService.value.getAccountId())

  /**
   * 初始化服务器地址和轮询
   */
  function initServerUrl() {
    const saved = localStorage.getItem('ai-agent-settings')
    let url = 'http://localhost:8080'

    if (saved) {
      try {
        const settings = JSON.parse(saved)
        url = settings.serverUrl || 'http://localhost:8080'
      } catch (e) {
        console.warn('解析设置失败，使用默认地址')
      }
    }

    apiService.value.setServerUrl(url)

    // 启动轮询
    startPolling()
  }

  /**
   * 启动 artifacts 轮询
   */
  function startPolling() {
    // 先停止之前的轮询
    if (stopPolling.value) {
      stopPolling.value()
    }

    stopPolling.value = apiService.value.startPolling(
      // onArtifactsChange
      (artifacts: HappyArtifact[]) => {
        processArtifacts(artifacts)
      },
      // onArtifactUpdate
      (artifact: HappyArtifact) => {
        processNewArtifact(artifact)
      }
    )
  }

  /**
   * 处理所有 artifacts - 将工具调用和待办事项嵌入到聊天流中
   */
  function processArtifacts(artifacts: HappyArtifact[]) {
    // 提取所有类型的 artifacts
    const userMessages = apiService.value.extractUserMessages(artifacts)
    const assistantMessages = apiService.value.extractAssistantMessages(artifacts)
    const toolCalls = apiService.value.extractToolCalls(artifacts)
    const todoItems = apiService.value.extractTodos(artifacts)
    const permissions = apiService.value.extractPendingPermissions(artifacts)

    // 构建聊天流消息（按时间排序，工具和待办嵌入到流中）
    const allMessages: ChatMessageDTO[] = []

    // 添加用户消息
    userMessages.forEach(m => {
      allMessages.push({
        id: m.id,
        type: 'USER' as const,
        content: m.body.content,
        timestamp: new Date(m.createdAt).toISOString()
      })
    })

    // 添加工具调用作为独立消息
    toolCalls.forEach(tc => {
      allMessages.push({
        id: tc.id,
        type: 'TOOL' as const,
        content: '',  // 工具调用的内容在 toolCall 字段中
        timestamp: new Date(tc.createdAt).toISOString(),
        toolCall: tc
      })
    })

    // 添加待办事项作为独立消息
    todoItems.forEach(todo => {
      allMessages.push({
        id: todo.id,
        type: 'TODO' as const,
        content: '',  // 待办事项的内容在 todo 字段中
        timestamp: new Date(todo.createdAt).toISOString(),
        todo: todo
      })
    })

    // 添加助手消息
    assistantMessages.forEach(m => {
      allMessages.push({
        id: m.id,
        type: 'ASSISTANT' as const,
        content: m.body.content,
        timestamp: new Date(m.createdAt).toISOString(),
        inputTokens: m.body.inputTokens,
        outputTokens: m.body.outputTokens
      })
    })

    // 按时间排序，但同一秒内的消息按类型排序：用户 > 工具 > 待办 > 助手
    allMessages.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime()
      const timeB = new Date(b.timestamp).getTime()

      // 如果时间差在 10 秒内，按对话逻辑排序
      if (Math.abs(timeA - timeB) < 10000) {
        const typePriority: Record<string, number> = {
          'USER': 0,
          'TOOL': 1,
          'TODO': 2,
          'THINKING': 3,
          'ASSISTANT': 4
        }
        return typePriority[a.type] - typePriority[b.type]
      }

      // 时间差超过 10 秒，按时间排序
      return timeA - timeB
    })

    messages.value = allMessages

    // 有助手消息时，清除思考状态
    if (assistantMessages.length > 0 && isThinking.value) {
      const hasContent = assistantMessages.some(m => m.body.content && m.body.content.trim())
      if (hasContent) {
        console.log('检测到助手回复内容，清除 isThinking')
        isThinking.value = false
      }
    }

    // 更新独立的工具列表（保持向后兼容）
    toolCalls.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    pendingToolCalls.value = toolCalls

    // 更新独立的待办列表（保持向后兼容）
    todoItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    todos.value = todoItems

    // 提取权限请求
    pendingPermission.value = permissions.length > 0 ? permissions[0] : null
  }

  /**
   * 处理新 artifact
   */
  function processNewArtifact(artifact: HappyArtifact) {
    try {
      const header = apiService.value.parseHeader(artifact)
      console.log('收到新 artifact:', header.type, header.subtype)

      if (header.type === 'message') {
        // 新消息或消息更新，重新加载所有消息
        apiService.value.getArtifacts().then(artifacts => {
          processArtifacts(artifacts)
          // 收到助手回复后，清除思考状态并移除 thinking 消息
          if (header.subtype === 'assistant-message') {
            const body = apiService.value.parseBody(artifact)
            // 只有在收到最终回复内容后才清除 isThinking
            if (body.content && body.content.trim()) {
              console.log('收到助手回复内容，清除 isThinking')
              isThinking.value = false
              // 移除所有 thinking 消息
              messages.value = messages.value.filter(m => m.type !== 'THINKING')
            }
          }
        })
      } else if (header.type === 'tool-call') {
        // 新工具调用或工具状态更新，重新加载所有消息以更新聊天流
        apiService.value.getArtifacts().then(artifacts => {
          processArtifacts(artifacts)
        })
      } else if (header.type === 'todo') {
        // 新待办事项或待办状态更新，重新加载所有消息以更新聊天流
        apiService.value.getArtifacts().then(artifacts => {
          processArtifacts(artifacts)
        })
      } else if (header.type === 'permission') {
        // 新权限请求
        const permission = { ...artifact, header, body: apiService.value.parseBody(artifact) } as PermissionArtifact
        if (!permission.body.response) {
          pendingPermission.value = permission
        }
      }
    } catch (error) {
      console.error('处理新 artifact 失败:', error)
    }
  }

  /**
   * 添加用户消息 (本地 optimistic update)
   */
  function addUserMessage(content: string) {
    messages.value.push({
      id: `local-${Date.now()}`,
      type: 'USER',
      content,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * 添加助手消息 (本地)
   */
  function addAssistantMessage(content: string) {
    messages.value.push({
      id: `local-${Date.now()}`,
      type: 'ASSISTANT',
      content,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * 发送消息
   */
  async function sendMessage(content: string) {
    if (!content.trim()) return

    addUserMessage(content)

    // 添加 thinking 消息到消息流（显示在工具块之后）
    const thinkingId = `thinking-${Date.now()}`
    messages.value.push({
      id: thinkingId,
      type: 'THINKING' as const,
      content: '',
      timestamp: new Date().toISOString()
    })

    isThinking.value = true

    try {
      // 创建 user message artifact
      await apiService.value.sendMessage(content)

      // 轮询会自动获取新消息，收到助手回复后会移除 thinking
      // 不需要手动处理响应，Happy 模式下由 AI 服务创建 assistant message artifact
    } catch (error) {
      console.error('发送消息失败:', error)
      isThinking.value = false
      // 移除 thinking 消息
      messages.value = messages.value.filter(m => m.id !== thinkingId)
      addAssistantMessage(`错误：${error instanceof Error ? error.message : '发送失败'}`)
    }
  }

  /**
   * 响应权限请求
   */
  async function respondPermission(
    requestId: string,
    choice: 'ALLOW_ONCE' | 'ALLOW_SESSION' | 'ALLOW_ALWAYS' | 'DENY'
  ) {
    if (!pendingPermission.value) return

    try {
      await apiService.value.respondPermission(requestId, choice, pendingPermission.value.bodyVersion)
      pendingPermission.value = null
    } catch (error) {
      console.error('响应权限失败:', error)
    }
  }

  /**
   * 获取历史消息
   */
  async function loadHistory(limit: number = 50) {
    try {
      const artifacts = await apiService.value.getArtifacts()
      processArtifacts(artifacts)
    } catch (error) {
      console.error('加载历史失败:', error)
    }
  }

  /**
   * 获取统计
   */
  async function loadStats() {
    try {
      // TODO: 实现统计 API
      // const res = await fetch(`${apiService.value.getServerUrl()}/api/v2/stats`)
      // stats.value = await res.json()
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  }

  /**
   * 更新服务器地址
   */
  function updateServerUrl(newUrl: string) {
    apiService.value.setServerUrl(newUrl)
    localStorage.setItem('ai-agent-settings', JSON.stringify({ serverUrl: newUrl }))
    startPolling() // 重启轮询
  }

  /**
   * 清理
   */
  function cleanup() {
    if (stopPolling.value) {
      stopPolling.value()
      stopPolling.value = null
    }
  }

  return {
    // 状态
    messages,
    pendingToolCalls,
    pendingPermission,
    todos,
    stats,
    isThinking,
    serverUrl,
    sessionId,
    userId,
    // 计算属性
    hasPendingPermission,
    hasPendingToolCalls,
    // 方法
    initServerUrl,
    sendMessage,
    respondPermission,
    loadHistory,
    loadStats,
    updateServerUrl,
    cleanup
  }
})
