import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { happyApi, HappyApiService } from '@/services/happy-api'
import { subagentSseService } from '@/services/subagent-sse-service'
import { agentWebSocketClient } from '@/services/agent-websocket'
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
  const activeUserTurnId = ref<string | null>(null)
  const waitPhase = ref<'idle' | 'waiting' | 'tool_done'>('idle')
  const apiService = ref<HappyApiService>(new HappyApiService())
  const stopPolling = ref<(() => void) | null>(null)
  const pollingFailureCount = ref(0)
  const localWaitMessageId = ref<string | null>(null)
  const wsConnected = ref(false)

  // 当前响应构建中的内容
  const currentResponseContent = ref('')
  const pendingToolCallsMap = ref<Map<string, { toolName: string; input?: Record<string, any> }>>(new Map())

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

    // 连接 Agent WebSocket（用于实时交互）
    initAgentWebSocket()

    // 启动轮询（保留用于兜底，后续可完全移除）
    startPolling()
  }

  /**
   * 初始化 Agent WebSocket 连接
   */
  function initAgentWebSocket() {
    // 订阅 WebSocket 状态变化
    agentWebSocketClient.subscribeState((state) => {
      wsConnected.value = state.state === 'connected'
      console.log('[ChatStore] WebSocket 状态:', state.state)
      onWebSocketStateChange(state)
    })

    // 订阅 WebSocket 消息
    agentWebSocketClient.subscribeMessage({
      // 文本增量（流式输出）
      textDelta: (delta: string) => {
        handleTextDelta(delta)
      },

      // 工具调用开始
      toolCallStart: (toolCallId: string, toolName: string, input?: Record<string, any>) => {
        handleToolCallStart(toolCallId, toolName, input)
      },

      // 工具调用完成
      toolCallComplete: (toolCallId: string, toolName: string, output: string, durationMs?: number) => {
        handleToolCallComplete(toolCallId, toolName, output, durationMs)
      },

      // 工具调用失败
      toolCallFailed: (toolCallId: string, toolName: string, error: string, durationMs?: number) => {
        handleToolCallFailed(toolCallId, toolName, error, durationMs)
      },

      // 响应完成
      responseComplete: (content: string, inputTokens: number, outputTokens: number, durationMs: number) => {
        handleResponseComplete(content, inputTokens, outputTokens, durationMs)
      },

      // 响应开始
      responseStart: (turnId: string) => {
        console.log('[ChatStore] 响应开始:', turnId)
        activeUserTurnId.value = turnId
      },

      // 错误
      error: (code: string, message: string) => {
        console.error('[ChatStore] WebSocket 错误:', code, message)
        addAssistantMessage(`错误：${message}`)
        isThinking.value = false
        waitPhase.value = 'idle'
      },

      // 连接成功
      connected: (sessionId: string) => {
        console.log('[ChatStore] WebSocket 已连接，sessionId:', sessionId)
      }
    })

    // 连接 WebSocket
    const token = localStorage.getItem('ai-agent-api-key') || 'default-token'
    agentWebSocketClient.connect(token)
  }

  /**
   * 通过 HTTP 加载历史消息（用于初始化）
   */
  async function loadHistory() {
    try {
      const artifacts = await apiService.value.getArtifacts()
      processArtifacts(artifacts)
      fetchPendingPermissions()
      console.log('[ChatStore] 历史消息加载成功，共', artifacts.length, '条')
    } catch (error) {
      console.error('[ChatStore] 加载历史消息失败:', error)
    }
  }

  /**
   * 启动 artifacts 轮询（仅作为 WebSocket 断开的降级方案）
   */
  function startPolling() {
    // 先停止之前的轮询
    if (stopPolling.value) {
      stopPolling.value()
    }

    // 仅在 WebSocket 未连接时启动轮询
    if (wsConnected.value) {
      console.log('[ChatStore] WebSocket 已连接，跳过轮询')
      return
    }

    stopPolling.value = apiService.value.startPolling(
      // onArtifactsChange
      (artifacts: HappyArtifact[]) => {
        processArtifacts(artifacts)
        // 同时检查是否有权限请求
        fetchPendingPermissions()
      },
      // onArtifactUpdate
      (artifact: HappyArtifact) => {
        processNewArtifact(artifact)
      },
      // onPollingError
      (error: unknown) => {
        pollingFailureCount.value += 1
        if (pollingFailureCount.value >= 3 && isThinking.value) {
          isThinking.value = false
          waitPhase.value = 'idle'
          activeUserTurnId.value = null
          localWaitMessageId.value = null
          apiService.value.setPollingInterval(1000)
          messages.value = messages.value.filter(m => m.type !== 'THINKING')
          addAssistantMessage(
            `连接中断，已停止等待。请检查服务地址与网络后重试。` +
              `${error instanceof Error ? `（${error.message}）` : ''}`
          )
        }
      }
    )
  }

  /**
   * WebSocket 状态变化时触发（用于控制轮询启停）
   */
  let hasLoadedHistory = false

  function onWebSocketStateChange(state: { state: string }) {
    if (state.state === 'connected') {
      // WebSocket 连接成功，停止轮询
      if (stopPolling.value) {
        stopPolling.value()
        stopPolling.value = null
        console.log('[ChatStore] WebSocket 已连接，停止轮询')
      }

      // 首次连接时加载历史消息
      if (!hasLoadedHistory) {
        hasLoadedHistory = true
        loadHistory()
      }
    } else if (state.state === 'disconnected' || state.state === 'error') {
      // WebSocket 断开，启动轮询作为降级
      console.log('[ChatStore] WebSocket 断开，启动轮询降级')
      startPolling()
    }
  }

  /**
   * 处理所有 artifacts - 将工具调用和待办事项嵌入到聊天流中
   */
  /**
   * 用于时间线排序：助手 artifact 在回合一开始就创建（createdAt 很早），
   * 但流式内容与最终定稿会不断刷新 updatedAt。若只用 createdAt，
   * 最终回复会排在工具调用之前（用户看到“答案在最上面”）。
   */
  function timelineMs(a: HappyArtifact): number {
    const c = typeof a.createdAt === 'number' ? a.createdAt : Number(a.createdAt)
    const u = typeof a.updatedAt === 'number' ? a.updatedAt : Number(a.updatedAt)
    return Math.max(Number.isFinite(c) ? c : 0, Number.isFinite(u) ? u : 0)
  }

  function isTaskToolName(name: string): boolean {
    return /^Task(Create|List|Get|Update|Stop|Output)$/.test(name)
  }

  function summarizeToolProgress(toolCall: ToolCallArtifact): string | null {
    const body = (toolCall.body ?? {}) as Record<string, unknown>
    const header = (toolCall.header ?? {}) as Record<string, unknown>
    const toolName = String(header.toolName || header.title || '工具')
    if (isTaskToolName(toolName)) return null

    const status = String(body.status || header.status || '').toLowerCase()
    const duration = typeof body.durationMs === 'number' ? `（${body.durationMs}ms）` : ''
    const inputSummaryRaw =
      (typeof header.inputSummary === 'string' ? header.inputSummary : '') ||
      (typeof body.inputDisplay === 'string' ? body.inputDisplay : '')
    const inputObj = body.input
    const inputFallback =
      inputObj && typeof inputObj === 'object'
        ? JSON.stringify(inputObj).slice(0, 180)
        : ''
    const inputPreview = (inputSummaryRaw || inputFallback || '').trim()
    const outputRaw = body.output
    const outputText =
      typeof outputRaw === 'string'
        ? outputRaw.trim()
        : outputRaw != null
          ? JSON.stringify(outputRaw)
          : ''
    const outputPreview = outputText ? outputText.slice(0, 120) : ''

    if (status === 'failed' || status === 'error') {
      return `执行 ${toolName} 失败${duration}${outputPreview ? `：${outputPreview}` : ''}`
    }
    if (status === 'completed') {
      return `已完成 ${toolName}${duration}${outputPreview ? `：${outputPreview}` : (inputPreview ? `（输入：${inputPreview}）` : '')}`
    }
    if (status === 'running' || status === 'in_progress' || status === 'started') {
      return inputPreview
        ? `正在执行 ${toolName}（输入：${inputPreview}）...`
        : `正在执行 ${toolName}...`
    }
    return null
  }

  function processArtifacts(artifacts: HappyArtifact[]) {
    pollingFailureCount.value = 0
    // 提取所有类型的 artifacts
    const userMessages = apiService.value.extractUserMessages(artifacts)
    const assistantMessages = apiService.value.extractAssistantMessages(artifacts)
    const thinkingMessages = apiService.value.extractThinkingMessages(artifacts)
    const toolCalls = apiService.value.extractToolCalls(artifacts)
    const todoItems = apiService.value.extractTodos(artifacts)
    const permissions = apiService.value.extractPendingPermissions(artifacts)
    const latestUserMessageAt = userMessages.length > 0 ? Math.max(...userMessages.map(m => timelineMs(m))) : 0

    // 构建聊天流消息（按时间排序，工具和待办嵌入到流中）
    const allMessages: ChatMessageDTO[] = []

    // 添加用户消息
    userMessages.forEach(m => {
      allMessages.push({
        id: m.id,
        type: 'USER' as const,
        content: m.body.content,
        timestamp: new Date(timelineMs(m)).toISOString()
      })
    })

    // 添加工具调用作为独立消息
    toolCalls.forEach(tc => {
      allMessages.push({
        id: tc.id,
        type: 'TOOL' as const,
        content: '',  // 工具调用的内容在 toolCall 字段中
        timestamp: new Date(timelineMs(tc)).toISOString(),
        toolCall: tc
      })

      const processText = summarizeToolProgress(tc)
      if (processText) {
        allMessages.push({
          id: `tool-progress-${tc.id}-${tc.bodyVersion}`,
          type: 'SYSTEM' as const,
          content: processText,
          timestamp: new Date(timelineMs(tc)).toISOString()
        })
      }
    })

    // 添加待办事项作为独立消息
    todoItems.forEach(todo => {
      allMessages.push({
        id: todo.id,
        type: 'TODO' as const,
        content: '',  // 待办事项的内容在 todo 字段中
        timestamp: new Date(timelineMs(todo)).toISOString(),
        todo: todo
      })
    })

    // 添加助手消息
    assistantMessages.forEach(m => {
      allMessages.push({
        id: m.id,
        type: 'ASSISTANT' as const,
        subtype: String((m.header as any)?.subtype || 'assistant-message'),
        content: m.body.content,
        metadata:
          m.body && typeof m.body === 'object' && (m.body as any).metadata
            ? ((m.body as any).metadata as Record<string, unknown>)
            : undefined,
        timestamp: new Date(timelineMs(m)).toISOString(),
        inputTokens: typeof (m.body as any).inputTokens === 'number' ? (m.body as any).inputTokens : undefined,
        outputTokens: typeof (m.body as any).outputTokens === 'number' ? (m.body as any).outputTokens : undefined
      })
    })

    // 添加 thinking 消息（仅保留有内容的推理文本，避免空 thinking 卡住“思考中...”）
    thinkingMessages.forEach(m => {
      const content = String(m.body.content || '').trim()
      if (!content) return
      allMessages.push({
        id: m.id,
        type: 'THINKING' as const,
        content,
        timestamp: new Date(timelineMs(m)).toISOString()
      })
    })

    // 按时间线排序：以 max(createdAt, updatedAt) 为主（流式助手占位需用 updatedAt）。
    // 仅在时间戳完全相同（同毫秒）时用类型作 tie-break：USER → TOOL → TODO → THINKING → ASSISTANT
    const typePriority: Record<string, number> = {
      USER: 0,
      TOOL: 1,
      TODO: 2,
      THINKING: 3,
      ASSISTANT: 4
    }
    allMessages.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime()
      const timeB = new Date(b.timestamp).getTime()
      if (timeA !== timeB) return timeA - timeB
      return (typePriority[a.type] ?? 9) - (typePriority[b.type] ?? 9)
    })

    const hasWaitOrProgress = allMessages.some(
      m =>
        (m.type === 'ASSISTANT' &&
          (m.subtype === 'assistant-wait-message' ||
            m.subtype === 'assistant-progress-message' ||
            m.subtype === 'assistant-loop-state-message')) ||
        m.type === 'TOOL' ||
        m.type === 'THINKING'
    )
    if (isThinking.value && !hasWaitOrProgress) {
      const id = localWaitMessageId.value || `local-wait-${Date.now()}`
      localWaitMessageId.value = id
      allMessages.push({
        id,
        type: 'ASSISTANT' as const,
        subtype: 'assistant-wait-message',
        content: '',
        timestamp: new Date().toISOString(),
        metadata: { source: 'local-optimistic' }
      })
    } else if (hasWaitOrProgress) {
      localWaitMessageId.value = null
    }

    messages.value = allMessages

    // 当前回合门控：仅显示当前 userTurn 的等待状态，避免历史轮次误亮
    const latestTurnCarrier = [...assistantMessages]
      .filter(m => {
        const metadata = (m.body as any)?.metadata
        return metadata && metadata.userTurnId
      })
      .sort((a, b) => timelineMs(a) - timelineMs(b))
      .at(-1)
    const latestSeenUserTurnId = latestTurnCarrier
      ? String(((latestTurnCarrier.body as any)?.metadata?.userTurnId) || '')
      : ''

    if (isThinking.value && !activeUserTurnId.value && latestSeenUserTurnId) {
      activeUserTurnId.value = latestSeenUserTurnId
    }
    if (!isThinking.value) {
      waitPhase.value = 'idle'
    } else if (waitPhase.value === 'idle') {
      waitPhase.value = 'waiting'
    }

    const hasActiveFinalAssistant = assistantMessages.some(m => {
      const subtype = String((m.header as any)?.subtype || '')
      const content = String((m.body as any)?.content || '').trim()
      const turnId = String(((m.body as any)?.metadata?.userTurnId) || '')
      if (subtype !== 'assistant-message' || !content) return false
      if (!activeUserTurnId.value) return true
      return turnId === activeUserTurnId.value
    })

    if (hasActiveFinalAssistant && isThinking.value) {
      console.log('检测到当前回合最终助手回复，清除 isThinking')
      isThinking.value = false
      waitPhase.value = 'idle'
      activeUserTurnId.value = null
      localWaitMessageId.value = null
      apiService.value.setPollingInterval(1000)
    } else if (isThinking.value) {
      const hasToolCompletedInCurrentRound = toolCalls.some(tc => {
        const body = (tc.body ?? {}) as Record<string, unknown>
        const status = String(body.status || '').toLowerCase()
        if (status !== 'completed' && status !== 'failed' && status !== 'error') return false
        return timelineMs(tc) >= latestUserMessageAt
      })
      waitPhase.value = hasToolCompletedInCurrentRound ? 'tool_done' : 'waiting'
    }

    // 更新独立的工具列表（保持向后兼容）
    toolCalls.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    pendingToolCalls.value = toolCalls

    // 更新独立的待办列表（保持向后兼容）
    todoItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    todos.value = todoItems

    // 提取权限请求（优先从 artifacts 提取）
    if (permissions.length > 0) {
      pendingPermission.value = permissions[0]
    }
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
            const bodyTurnId = String((body as any)?.metadata?.userTurnId || '')
            // 只有在收到最终回复内容后才清除 isThinking
            if (
              body.content &&
              body.content.trim() &&
              (!activeUserTurnId.value || !bodyTurnId || bodyTurnId === activeUserTurnId.value)
            ) {
              console.log('收到助手回复内容，清除 isThinking')
              isThinking.value = false
              waitPhase.value = 'idle'
              activeUserTurnId.value = null
              localWaitMessageId.value = null
              apiService.value.setPollingInterval(1000)
              // 仅移除本地占位的空 thinking，不移除后端返回的 thinking 内容
              messages.value = messages.value.filter(m => !(m.type === 'THINKING' && !m.content))
            }
          }
        })
      } else if (header.type === 'tool-call') {
        // 新工具调用或工具状态更新，重新加载所有消息以更新聊天流
        apiService.value.getArtifacts().then(artifacts => {
          processArtifacts(artifacts)
          // 同时检查是否有权限请求（工具调用可能触发权限请求）
          fetchPendingPermissions()
          
          // 检测 spawn_subagent 工具调用，自动启动 SSE 进度监听
          const toolName = header.toolName || header.title || ''
          if (toolName === 'spawn_subagent' || toolName === 'Spawn Subagent') {
            const body = apiService.value.parseBody(artifact)
            handleSpawnSubagentCall(body)
          }
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
   * 从 HTTP API 获取待确认的权限请求
   */
  async function fetchPendingPermissions() {
    try {
      const permissions = (await apiService.value.getPendingPermissions()) ?? []
      const first = permissions[0]
      if (permissions.length > 0 && first?.body && !first.body.response) {
        pendingPermission.value = first
      } else if (permissions.length === 0) {
        // 没有待确认的权限请求，清除对话框
        pendingPermission.value = null
      }
    } catch (error) {
      console.error('获取权限请求失败:', error)
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
   * 处理文本增量（流式输出）
   */
  function handleTextDelta(delta: string) {
    // 清除本地占位的 thinking 消息
    messages.value = messages.value.filter(m =>
      !(m.metadata?.source === 'local-optimistic' && m.subtype === 'assistant-wait-message')
    )

    // 查找或创建助手消息
    let assistantMsg = messages.value.find(m =>
      m.type === 'ASSISTANT' && m.subtype !== 'assistant-wait-message'
    )

    if (!assistantMsg) {
      assistantMsg = {
        id: `assistant-${Date.now()}`,
        type: 'ASSISTANT',
        content: '',
        timestamp: new Date().toISOString()
      }
      messages.value.push(assistantMsg)
    }

    // 累加内容
    currentResponseContent.value += delta
    assistantMsg.content = currentResponseContent.value
  }

  /**
   * 处理工具调用开始
   */
  function handleToolCallStart(toolCallId: string, toolName: string, input?: Record<string, any>) {
    console.log('[ChatStore] 工具开始:', toolName, toolCallId, 'input:', input)

    // 记录 pending 工具
    pendingToolCallsMap.value.set(toolCallId, { toolName, input })

    // 添加工具消息
    messages.value.push({
      id: `tool-${toolCallId}`,
      type: 'TOOL',
      content: '',
      timestamp: new Date().toISOString(),
      toolCall: {
        id: toolCallId,
        header: {
          toolName,
          subtype: toolName,  // 添加 subtype 字段，匹配 ToolCalls.vue 的查找逻辑
          status: 'started'
        },
        body: {
          status: 'started',
          input
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      } as any
    })
    console.log('[ChatStore] 工具消息已添加，当前消息数:', messages.value.length)
  }

  /**
   * 处理工具调用完成
   */
  function handleToolCallComplete(toolCallId: string, toolName: string, output: string, durationMs?: number) {
    console.log('[ChatStore] 工具完成:', toolName, toolCallId, 'output:', output?.substring(0, 100))

    // 更新工具消息 - 使用响应式方式
    const toolMsgIndex = messages.value.findIndex(m => m.id === `tool-${toolCallId}`)
    if (toolMsgIndex !== -1 && messages.value[toolMsgIndex].toolCall) {
      const toolMsg = messages.value[toolMsgIndex]
      // 使用 Vue 的响应式更新方式：替换整个对象
      messages.value[toolMsgIndex] = {
        ...toolMsg,
        toolCall: {
          ...toolMsg.toolCall,
          header: {
            ...toolMsg.toolCall.header,
            status: 'completed'
          },
          body: {
            ...toolMsg.toolCall.body,
            status: 'completed',
            output,
            durationMs
          }
        }
      }
      console.log('[ChatStore] 工具消息已更新:', toolCallId)
    } else {
      console.warn('[ChatStore] 未找到工具消息:', toolCallId)
    }

    // 移除 pending 记录
    pendingToolCallsMap.value.delete(toolCallId)
  }

  /**
   * 处理工具调用失败
   */
  function handleToolCallFailed(toolCallId: string, toolName: string, error: string, durationMs?: number) {
    console.log('[ChatStore] 工具失败:', toolName, toolCallId, 'error:', error)

    // 更新工具消息 - 使用响应式方式
    const toolMsgIndex = messages.value.findIndex(m => m.id === `tool-${toolCallId}`)
    if (toolMsgIndex !== -1 && messages.value[toolMsgIndex].toolCall) {
      const toolMsg = messages.value[toolMsgIndex]
      // 使用 Vue 的响应式更新方式：替换整个对象
      messages.value[toolMsgIndex] = {
        ...toolMsg,
        toolCall: {
          ...toolMsg.toolCall,
          header: {
            ...toolMsg.toolCall.header,
            status: 'failed'
          },
          body: {
            ...toolMsg.toolCall.body,
            status: 'failed',
            error,
            durationMs
          }
        }
      }
      console.log('[ChatStore] 工具消息已更新:', toolCallId)
    } else {
      console.warn('[ChatStore] 未找到工具消息:', toolCallId)
    }

    // 移除 pending 记录
    pendingToolCallsMap.value.delete(toolCallId)
  }

  /**
   * 处理响应完成
   */
  function handleResponseComplete(content: string, inputTokens: number, outputTokens: number, durationMs: number) {
    console.log('[ChatStore] 响应完成，内容长度:', content.length)

    // 更新或创建助手消息
    let assistantMsg = messages.value.find(m =>
      m.type === 'ASSISTANT' && m.subtype !== 'assistant-wait-message' && m.content === currentResponseContent.value
    )

    if (!assistantMsg) {
      assistantMsg = {
        id: `assistant-${Date.now()}`,
        type: 'ASSISTANT',
        content: content,
        timestamp: new Date().toISOString(),
        inputTokens,
        outputTokens
      }
      messages.value.push(assistantMsg)
    } else {
      // 确保内容完整
      assistantMsg.content = content || currentResponseContent.value
      assistantMsg.inputTokens = inputTokens
      assistantMsg.outputTokens = outputTokens
    }

    // 清除思考状态
    isThinking.value = false
    waitPhase.value = 'idle'
    currentResponseContent.value = ''
    apiService.value.setPollingInterval(1000)

    // 移除本地占位的 thinking 消息
    messages.value = messages.value.filter(m =>
      !(m.metadata?.source === 'local-optimistic' && m.type === 'THINKING')
    )
  }

  /**
   * 发送消息（使用 WebSocket）
   */
  async function sendMessage(content: string) {
    if (!content.trim()) return

    // 0. 重置之前的 spawn SSE 状态（避免旧进度影响新消息）
    subagentSseService.reset()

    // 1. 立即添加用户消息（optimistic update）
    addUserMessage(content)

    // 2. 立即设置思考状态和等待消息，让用户看到即时反馈
    isThinking.value = true
    waitPhase.value = 'waiting'
    activeUserTurnId.value = null
    apiService.value.setPollingInterval(300)
    localWaitMessageId.value = `local-wait-${Date.now()}`
    currentResponseContent.value = ''

    // 添加本地等待消息占位（立即显示，不等后端响应）
    const waitMsg: ChatMessageDTO = {
      id: localWaitMessageId.value,
      type: 'ASSISTANT',
      subtype: 'assistant-wait-message',
      content: '',
      timestamp: new Date().toISOString(),
      metadata: { source: 'local-optimistic' }
    }

    // 添加本地 thinking 占位消息（带动态加载动画）
    const thinkingMsg: ChatMessageDTO = {
      id: `local-thinking-${Date.now()}`,
      type: 'THINKING',
      content: '', // 空内容会显示加载动画
      timestamp: new Date().toISOString()
    }

    messages.value.push(waitMsg, thinkingMsg)

    // 通过 WebSocket 发送消息
    const sent = agentWebSocketClient.sendMessage(content)

    if (!sent) {
      // WebSocket 未连接，降级使用 HTTP
      console.warn('[ChatStore] WebSocket 未连接，降级使用 HTTP 发送')
      apiService.value.sendMessage(content)
        .then(() => {
          console.log('消息通过 HTTP 发送成功')
        })
        .catch(err => {
          console.error('HTTP 发送失败:', err)
          addAssistantMessage(`发送失败：${err instanceof Error ? err.message : '无法连接到服务器'}`)
          isThinking.value = false
          waitPhase.value = 'idle'
          activeUserTurnId.value = null
          localWaitMessageId.value = null
          apiService.value.setPollingInterval(1000)
        })
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

    // 断开并重新连接 WebSocket
    agentWebSocketClient.disconnect()
    setTimeout(() => {
      const token = localStorage.getItem('ai-agent-api-key') || 'default-token'
      agentWebSocketClient.connect(token)
    }, 100)
  }

  /**
   * 处理 spawn_subagent 工具调用 - 自动启动 SSE 进度监听
   * 支持批量任务(batch)和单任务(single)两种模式
   */
  function handleSpawnSubagentCall(body: Record<string, any>) {
    const metadata = body?.metadata || {}
    const batch = metadata?.batch
    const subagent = metadata?.subagent
    
    // 获取 opsSecret
    const opsSecret = localStorage.getItem('ai-agent-ops-secret') || ''
    if (!opsSecret) {
      console.warn('[ChatStore] Cannot start SSE: missing opsSecret in localStorage')
      return
    }
    
    // ===== 批量任务路径 (batch) =====
    if (batch && batch.batchId) {
      console.log('[ChatStore] Detected spawn_subagent batch:', batch.batchId)
      
      const tasks: { runId: string; goal: string }[] = []
      
      // 从 batch.runIds 提取
      if (batch.runIds && Array.isArray(batch.runIds)) {
        batch.runIds.forEach((runId: string, index: number) => {
          const taskInfo = batch.tasks?.[index] || {}
          tasks.push({
            runId,
            goal: taskInfo.goal || taskInfo.taskName || `任务 ${index + 1}`
          })
        })
      }
      
      if (tasks.length > 0) {
        subagentSseService.initBatch(batch.batchId, sessionId.value, tasks)
        subagentSseService.connect(sessionId.value, opsSecret)
        console.log('[ChatStore] SSE started for batch:', batch.batchId)
      }
    } 
    // ===== 单任务路径 (single) =====
    else if (subagent && subagent.runId) {
      console.log('[ChatStore] Detected single spawn_subagent:', subagent.runId)
      
      // 为单任务创建一个虚拟批次
      const batchId = `single-${subagent.runId}`
      const tasks = [{
        runId: subagent.runId,
        goal: subagent.goal || body.input?.goal || '子任务'
      }]
      
      subagentSseService.initBatch(batchId, sessionId.value, tasks)
      subagentSseService.connect(sessionId.value, opsSecret, subagent.runId)
      console.log('[ChatStore] SSE started for single task:', subagent.runId)
    }
  }

  /**
   * 清理
   */
  function cleanup() {
    if (stopPolling.value) {
      stopPolling.value()
      stopPolling.value = null
    }
    // 同时清理 SSE 连接
    subagentSseService.disconnect()
  }

  return {
    // 状态
    messages,
    pendingToolCalls,
    pendingPermission,
    todos,
    stats,
    isThinking,
    waitPhase,
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
    cleanup,
    // SSE 子任务进度状态（供组件使用）
    spawnSseBatch: subagentSseService.currentBatch,
    spawnSseIsConnected: subagentSseService.isConnected,
    spawnSseConnectionError: subagentSseService.connectionError,
    spawnSseProgress: subagentSseService.progressPercentage,
    spawnSseRemainingTime: subagentSseService.estimatedRemainingSeconds,
    spawnSseAllCompleted: subagentSseService.allTasksCompleted,
    spawnSseHasFailed: subagentSseService.hasFailedTasks,
    resetSpawnSse: () => subagentSseService.reset()
  }
})
