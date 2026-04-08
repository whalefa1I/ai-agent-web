/**
 * Happy App 兼容的 API 服务层
 *
 * 使用 ai-agent-server 的 Happy 兼容 REST API:
 * - POST /api/v1/artifacts - 创建 artifact (发送消息)
 * - GET /api/v1/artifacts - 获取 artifact 列表
 * - GET /api/v1/artifacts/:id - 获取单个 artifact
 * - POST /api/v1/artifacts/:id - 更新 artifact
 * - DELETE /api/v1/artifacts/:id - 删除 artifact
 *
 * Artifact 格式 (Happy 协议):
 * - header: base64(加密的 header JSON) - 包含工具调用状态等元数据
 * - body: base64(加密的 body JSON) - 包含实际内容
 * - headerVersion/bodyVersion: 乐观并发控制
 */

import type {
  HappyArtifact,
  HappyArtifactHeader,
  HappyArtifactBody,
  MessageArtifact,
  ToolCallArtifact,
  PermissionArtifact,
  TodoArtifact
} from '@/types/happy-protocol'

// 配置
// 开发环境使用 Vite 代理 (见 vite.config.ts)，生产环境使用环境变量
const DEFAULT_SERVER_URL = (import.meta as any).env?.VITE_API_BASE_URL || ''
const ACCOUNT_ID_KEY = 'happy-account-id'
const SESSION_ID_KEY = 'happy-session-id'
const API_KEY_KEY = 'happy-api-key'

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取或创建账户 ID (持久化到 localStorage)
 * 优先使用从后端 API 返回的 userId，如果没有则使用本地生成的 ID
 */
function getAccountId(): string {
  // 先检查是否已经有 accountId（从后端 API 保存的）
  let id = localStorage.getItem(ACCOUNT_ID_KEY)
  if (id) {
    return id
  }
  // 如果没有，生成一个新的
  id = `account-${Date.now()}`
  localStorage.setItem(ACCOUNT_ID_KEY, id)
  return id
}

/**
 * 获取或创建会话 ID
 */
function getSessionId(): string {
  let id = localStorage.getItem(SESSION_ID_KEY)
  if (!id) {
    id = `session-${Date.now()}`
    localStorage.setItem(SESSION_ID_KEY, id)
  }
  return id
}

/**
 * 获取或创建 API Key（匿名）
 * 同时会更新 accountId 为后端返回的 userId
 */
async function getApiKey(serverUrl: string): Promise<string> {
  let key: string = localStorage.getItem(API_KEY_KEY) || ''
  if (!key) {
    // 调用后端 API 生成匿名 Key
    try {
      const res = await fetch(`${serverUrl}/api/auth/apikey/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) {
        throw new Error(`Failed to generate API Key: ${res.status}`)
      }
      const data: { apiKey: string; keyPrefix: string; userId: string } = await res.json()
      key = data.apiKey
      localStorage.setItem(API_KEY_KEY, key)
      // 同时保存 userId 为 accountId，确保前后端使用相同的账户 ID
      if (data.userId) {
        localStorage.setItem(ACCOUNT_ID_KEY, data.userId)
        console.log('[HappyAPI] Saved userId as accountId:', data.userId)
      }
      console.log('[HappyAPI] Generated anonymous API Key:', data.keyPrefix)
    } catch (error) {
      console.error('[HappyAPI] Failed to generate API Key:', error)
      // 如果生成失败，使用一个临时的 key（可能会被后端拒绝）
      key = `temp-key-${Date.now()}`
    }
  }
  return key
}

/**
 * Base64 编码/解码工具
 */
function encodeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
}

function decodeBase64(base64: string): string {
  return decodeURIComponent(escape(atob(base64)))
}

/**
 * 加密/解密 (模拟 - 实际使用需要真实加密)
 * 注意：生产环境应使用 Web Crypto API 进行真实加密
 */
function encryptData(data: object, key: string): string {
  // TODO: 实现真实加密
  // 目前仅做 base64 编码作为占位符
  return encodeBase64(JSON.stringify(data))
}

function decryptData<T>(encryptedBase64: string, key: string): T {
  // TODO: 实现真实解密
  if (!encryptedBase64 || encryptedBase64.trim() === '') {
    return {} as T
  }
  return JSON.parse(decodeBase64(encryptedBase64))
}

/**
 * 构建 artifact header
 */
function buildHeader(
  type: 'message' | 'tool-call' | 'permission',
  subtype: string,
  data: Record<string, any>
): HappyArtifactHeader {
  return {
    type,
    subtype,
    ...data,
    version: 1
  }
}

/**
 * 构建 artifact body
 */
function buildBody(content: Record<string, any>): HappyArtifactBody {
  return {
    ...content,
    version: 1
  }
}

/**
 * Happy API 服务类
 */
export class HappyApiService {
  private serverUrl: string
  private accountId: string
  private sessionId: string
  private apiKey: string | null = null
  private pollingTimer: number | null = null
  private pollingInterval: number = 1000 // 1000ms 轮询一次（降低频率避免 429）

  constructor(serverUrl: string = DEFAULT_SERVER_URL) {
    // 如果 serverUrl 为空（生产环境），使用空字符串，请求会使用相对路径由浏览器发送到当前域名
    // 开发环境下 Vite 代理会转发 /api 请求到 Railway
    this.serverUrl = serverUrl ? serverUrl.replace(/\/$/, '') : ''
    // 先获取 sessionId（不依赖 API Key）
    this.sessionId = getSessionId()
    // 获取或创建 accountId（如果已经有 API Key 保存的 userId，会使用它）
    this.accountId = getAccountId()
    // 异步获取 API Key，并在获取后更新 accountId（如果后端返回了 userId）
    getApiKey(this.serverUrl).then(key => {
      this.apiKey = key
      // 获取 API Key 后，再次检查 accountId 是否需要更新
      // （因为 getApiKey 可能保存了后端返回的 userId）
      const updatedAccountId = getAccountId()
      if (updatedAccountId !== this.accountId) {
        console.log('[HappyAPI] Updated accountId from API Key response:', updatedAccountId)
        this.accountId = updatedAccountId
      }
    })
  }

  /**
   * 更新服务器地址
   */
  setServerUrl(url: string) {
    this.serverUrl = url.replace(/\/$/, '')
  }

  /**
   * 获取服务器地址
   */
  getServerUrl(): string {
    return this.serverUrl
  }

  /**
   * 获取 API Key（从 localStorage 或生成新的）
   */
  private async getApiKeyHeader(): Promise<Record<string, string>> {
    if (!this.apiKey) {
      this.apiKey = await getApiKey(this.serverUrl)
    }
    return { 'X-API-Key': this.apiKey }
  }

  /**
   * 获取账户 ID
   */
  getAccountId(): string {
    return this.accountId
  }

  /**
   * 获取会话 ID
   */
  getSessionId(): string {
    return this.sessionId
  }

  /**
   * 健康检查
   */
  async health(): Promise<{ status: string }> {
    const res = await fetch(`${this.serverUrl}/actuator/health`)
    return res.json()
  }

  /**
   * 获取所有 artifacts (用于轮询)
   */
  async getArtifacts(): Promise<HappyArtifact[]> {
    const url = `${this.serverUrl}/api/v1/artifacts?accountId=${encodeURIComponent(this.accountId)}`
    const res = await fetch(url, {
      headers: await this.getApiKeyHeader()
    })
    if (!res.ok) {
      throw new Error(`Failed to get artifacts: ${res.status}`)
    }
    const data = await res.json()
    return data as HappyArtifact[]
  }

  /**
   * 获取单个 artifact
   */
  async getArtifact(id: string): Promise<HappyArtifact | null> {
    const url = `${this.serverUrl}/api/v1/artifacts/${id}?accountId=${encodeURIComponent(this.accountId)}`
    const res = await fetch(url, {
      headers: await this.getApiKeyHeader()
    })
    if (res.status === 404) {
      return null
    }
    if (!res.ok) {
      throw new Error(`Failed to get artifact: ${res.status}`)
    }
    return res.json()
  }

  /**
   * 发送用户消息 (创建 message artifact)
   */
  async sendMessage(content: string): Promise<HappyArtifact> {
    const id = generateId()

    // 构建 user message artifact
    const header = buildHeader('message', 'user-message', {
      title: 'User Message',
      timestamp: Date.now()
    })

    const body = buildBody({
      type: 'user-message',
      content,
      timestamp: Date.now()
    })

    const artifact: HappyArtifact = {
      id,
      header: encryptData(header, 'key'),
      body: encryptData(body, 'key'),
      dataEncryptionKey: btoa('user-message-key'),
      accountId: this.accountId,
      sessionId: this.sessionId,
      headerVersion: 1,
      bodyVersion: 1,
      seq: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const res = await fetch(`${this.serverUrl}/api/v1/artifacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await this.getApiKeyHeader())
      },
      body: JSON.stringify(artifact)
    })

    if (!res.ok) {
      throw new Error(`Failed to send message: ${res.status}`)
    }

    return res.json()
  }

  /**
   * 响应权限请求
   */
  async respondPermission(
    artifactId: string,
    choice: 'ALLOW_ONCE' | 'ALLOW_SESSION' | 'ALLOW_ALWAYS' | 'DENY',
    currentVersion: number
  ): Promise<{ success: boolean; bodyVersion: number }> {
    const updateBody = {
      body: encryptData({
        type: 'permission-response',
        choice,
        timestamp: Date.now()
      }, 'key'),
      expectedBodyVersion: currentVersion
    }

    const res = await fetch(`${this.serverUrl}/api/v1/artifacts/${artifactId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await this.getApiKeyHeader())
      },
      body: JSON.stringify(updateBody)
    })

    if (!res.ok) {
      throw new Error(`Failed to respond permission: ${res.status}`)
    }

    return res.json()
  }

  /**
   * 更新工具调用状态
   */
  async updateToolCall(
    artifactId: string,
    status: 'started' | 'in_progress' | 'completed' | 'failed',
    output?: string,
    currentVersion?: number
  ): Promise<{ success: boolean; bodyVersion: number }> {
    const artifact = await this.getArtifact(artifactId)
    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`)
    }

    const currentBody = artifact.body ? decryptData<HappyArtifactBody>(artifact.body, 'key') : {}
    const updatedBody = {
      ...currentBody,
      status,
      ...(output && { output }),
      timestamp: Date.now()
    }

    const updateBody = {
      body: encryptData(updatedBody, 'key'),
      expectedBodyVersion: currentVersion ?? artifact.bodyVersion
    }

    const res = await fetch(`${this.serverUrl}/api/v1/artifacts/${artifactId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await this.getApiKeyHeader())
      },
      body: JSON.stringify(updateBody)
    })

    if (!res.ok) {
      throw new Error(`Failed to update tool call: ${res.status}`)
    }

    return res.json()
  }

  /**
   * 删除 artifact
   */
  async deleteArtifact(id: string): Promise<void> {
    const url = `${this.serverUrl}/api/v1/artifacts/${id}?accountId=${encodeURIComponent(this.accountId)}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: await this.getApiKeyHeader()
    })
    if (!res.ok) {
      throw new Error(`Failed to delete artifact: ${res.status}`)
    }
  }

  /**
   * 开始轮询 artifacts
   */
  startPolling(
    onArtifactsChange: (artifacts: HappyArtifact[]) => void,
    onArtifactUpdate: (artifact: HappyArtifact) => void
  ): () => void {
    let lastKnownArtifacts: Map<string, string> = new Map()

    const poll = async () => {
      try {
        const artifacts = await this.getArtifacts()

        // 检测变化
        const hasChanges = artifacts.some(a => {
          const lastVersion = lastKnownArtifacts.get(a.id)
          return lastVersion !== `${a.headerVersion}-${a.bodyVersion}`
        }) || lastKnownArtifacts.size !== artifacts.length

        if (hasChanges) {
          // 更新已知状态
          const newMap = new Map<string, string>()
          artifacts.forEach(a => {
            const newVersion = `${a.headerVersion}-${a.bodyVersion}`
            const oldVersion = lastKnownArtifacts.get(a.id)

            newMap.set(a.id, newVersion)

            // 检测是否是新增或更新
            if (!lastKnownArtifacts.has(a.id)) {
              // 新增
              onArtifactUpdate(a)
            } else if (oldVersion !== newVersion) {
              // 更新（流式输出场景）
              onArtifactUpdate(a)
            }
          })
          lastKnownArtifacts = newMap

          onArtifactsChange(artifacts)
        }
      } catch (error) {
        console.error('轮询失败:', error)
      }
    }

    // 立即执行一次
    poll()

    // 设置定时器
    this.pollingTimer = window.setInterval(poll, this.pollingInterval)

    // 返回停止函数
    return () => {
      if (this.pollingTimer) {
        clearInterval(this.pollingTimer)
        this.pollingTimer = null
      }
    }
  }

  /**
   * 解析 artifact header
   */
  parseHeader<T = HappyArtifactHeader>(artifact: HappyArtifact): T {
    return decryptData<T>(artifact.header, 'key')
  }

  /**
   * 解析 artifact body
   */
  parseBody<T = HappyArtifactBody>(artifact: HappyArtifact): T {
    if (!artifact.body || artifact.body.trim() === '') {
      return {} as T
    }
    return decryptData<T>(artifact.body, 'key')
  }

  /**
   * 从 artifacts 中提取用户消息
   */
  extractUserMessages(artifacts: HappyArtifact[]): MessageArtifact[] {
    return artifacts
      .filter(a => {
        try {
          const header = this.parseHeader(a)
          return header.type === 'message' && header.subtype === 'user-message'
        } catch {
          return false
        }
      })
      .map(a => ({ ...a, header: this.parseHeader(a), body: this.parseBody(a) }))
  }

  /**
   * 从 artifacts 中提取助手消息
   */
  extractAssistantMessages(artifacts: HappyArtifact[]): MessageArtifact[] {
    return artifacts
      .filter(a => {
        try {
          const header = this.parseHeader(a)
          return header.type === 'message' && header.subtype === 'assistant-message'
        } catch {
          return false
        }
      })
      .map(a => ({ ...a, header: this.parseHeader(a), body: this.parseBody(a) }))
  }

  /**
   * 从 artifacts 中提取工具调用
   */
  extractToolCalls(artifacts: HappyArtifact[]): ToolCallArtifact[] {
    return artifacts
      .filter(a => {
        try {
          const header = this.parseHeader(a)
          return header.type === 'tool-call'
        } catch {
          return false
        }
      })
      .map(a => ({ ...a, header: this.parseHeader(a), body: this.parseBody(a) }))
  }

  /**
   * 从 artifacts 中提取权限请求
   */
  extractPendingPermissions(artifacts: HappyArtifact[]): PermissionArtifact[] {
    return artifacts
      .filter(a => {
        try {
          const header = this.parseHeader(a)
          return header.type === 'permission' && !this.parseBody(a)?.response
        } catch {
          return false
        }
      })
      .map(a => ({ ...a, header: this.parseHeader(a), body: this.parseBody(a) }))
  }

  /**
   * 从 artifacts 中提取待办事项
   */
  extractTodos(artifacts: HappyArtifact[]): TodoArtifact[] {
    return artifacts
      .filter(a => {
        try {
          const header = this.parseHeader(a)
          return header.type === 'todo'
        } catch {
          return false
        }
      })
      .map(a => ({ ...a, header: this.parseHeader(a), body: this.parseBody(a) }))
  }

  /**
   * 获取待确认的权限请求（从后端 API）
   */
  async getPendingPermissions(): Promise<PermissionArtifact[]> {
    try {
      const res = await fetch(`${this.serverUrl}/api/permissions/pending`, {
        headers: {
          ...(await this.getApiKeyHeader())
        }
      })
      if (!res.ok) {
        return []
      }
      const raw = await res.json()
      const requests = Array.isArray(raw) ? raw : []
      // 将后端 PermissionRequest 转换为前端 PermissionArtifact 格式
      return requests.map((req: any) => ({
        id: req.id,
        header: {
          type: 'permission',
          subtype: 'permission-request',
          title: req.toolName,
          toolName: req.toolName,
          toolDisplayName: req.toolName,
          toolDescription: req.toolDescription,
          level: req.level,
          levelLabel: this.getLevelLabel(req.level),
          levelIcon: this.getLevelIcon(req.level),
          levelColor: this.getLevelColor(req.level)
        },
        body: {
          type: 'permission',
          inputSummary: req.inputSummary,
          riskExplanation: req.riskExplanation,
          permissionOptions: [
            { label: '仅允许本次', value: 'ALLOW_ONCE', style: 'default', description: '本次会话有效' },
            { label: '本次会话允许', value: 'ALLOW_SESSION', style: 'primary', description: '会话期间有效' },
            { label: '始终允许', value: 'ALLOW_ALWAYS', style: 'warning', description: '永久记住此授权' },
            { label: '拒绝', value: 'DENY', style: 'danger', description: '拒绝执行此操作' }
          ]
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        bodyVersion: 0,
        headerVersion: 1,
        accountId: this.accountId,
        sessionId: this.sessionId
      }))
    } catch (error) {
      console.error('获取权限请求失败:', error)
      return []
    }
  }

  private getLevelLabel(level: string): string {
    const labels: Record<string, string> = {
      'READ_ONLY': '只读',
      'MODIFY_STATE': '修改',
      'NETWORK': '网络',
      'DESTRUCTIVE': '破坏性',
      'AGENT_SPAWN': 'Agent'
    }
    return labels[level] || '未知'
  }

  private getLevelIcon(level: string): string {
    const icons: Record<string, string> = {
      'READ_ONLY': '👁️',
      'MODIFY_STATE': '✏️',
      'NETWORK': '🌐',
      'DESTRUCTIVE': '⚠️',
      'AGENT_SPAWN': '🤖'
    }
    return icons[level] || '❓'
  }

  private getLevelColor(level: string): string {
    const colors: Record<string, string> = {
      'READ_ONLY': '#6b7280',
      'MODIFY_STATE': '#f59e0b',
      'NETWORK': '#3b82f6',
      'DESTRUCTIVE': '#dc2626',
      'AGENT_SPAWN': '#8b5cf6'
    }
    return colors[level] || '#6b7280'
  }
}

// 导出单例
export const happyApi = new HappyApiService()
