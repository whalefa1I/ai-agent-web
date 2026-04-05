import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { happyApi, HappyApiService } from '@/services/happy-api'
import type {
  HappyArtifact,
  MessageArtifact,
  ToolCallArtifact,
  PermissionArtifact,
  ChatMessageDTO,
  SessionStats
} from '@/types/happy-protocol'

export const useChatStore = defineStore('chat', () => {
  // 状态
  const messages = ref<ChatMessageDTO[]>([])
  const pendingToolCalls = ref<ToolCallArtifact[]>([])
  const pendingPermission = ref<PermissionArtifact | null>(null)
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
   * 处理所有 artifacts
   */
  function processArtifacts(artifacts: HappyArtifact[]) {
    // 提取消息
    const userMessages = apiService.value.extractUserMessages(artifacts)
    const assistantMessages = apiService.value.extractAssistantMessages(artifacts)

    // 转换为 ChatMessageDTO
    const newMessages: ChatMessageDTO[] = [
      ...userMessages.map(m => ({
        id: m.id,
        type: 'USER' as const,
        content: m.body.content,
        timestamp: new Date(m.createdAt).toISOString()
      })),
      ...assistantMessages.map(m => ({
        id: m.id,
        type: 'ASSISTANT' as const,
        content: m.body.content,
        timestamp: new Date(m.createdAt).toISOString(),
        inputTokens: m.body.inputTokens,
        outputTokens: m.body.outputTokens
      }))
    ]

    // 按时间排序
    newMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    messages.value = newMessages

    // 提取工具调用
    const toolCalls = apiService.value.extractToolCalls(artifacts)
    pendingToolCalls.value = toolCalls.filter(tc => tc.body.status !== 'completed' && tc.body.status !== 'failed')

    // 提取权限请求
    const permissions = apiService.value.extractPendingPermissions(artifacts)
    pendingPermission.value = permissions.length > 0 ? permissions[0] : null
  }

  /**
   * 处理新 artifact
   */
  function processNewArtifact(artifact: HappyArtifact) {
    try {
      const header = apiService.value.parseHeader(artifact)

      if (header.type === 'message') {
        // 新消息，重新加载所有消息
        apiService.value.getArtifacts().then(artifacts => processArtifacts(artifacts))
      } else if (header.type === 'tool-call') {
        // 新工具调用
        const toolCall = { ...artifact, header, body: apiService.value.parseBody(artifact) } as ToolCallArtifact
        const index = pendingToolCalls.value.findIndex(tc => tc.id === artifact.id)
        if (index >= 0) {
          pendingToolCalls.value[index] = toolCall
        } else {
          pendingToolCalls.value.push(toolCall)
        }
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
    isThinking.value = true

    try {
      // 创建 user message artifact
      await apiService.value.sendMessage(content)

      // 轮询会自动获取新消息
      // 不需要手动处理响应，Happy 模式下由 AI 服务创建 assistant message artifact
    } catch (error) {
      console.error('发送消息失败:', error)
      isThinking.value = false
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
