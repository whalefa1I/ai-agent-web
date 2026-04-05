/**
 * Tool State REST API Composable
 *
 * 使用 REST API 轮询而非 WebSocket 连接
 * 连接到 ai-agent-server 的 /api/v2/tool-state 端点
 */

import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { ToolArtifact } from '@/types/tool-state'

const DEFAULT_SERVER_URL = 'http://localhost:8080'

/**
 * 获取服务器地址
 */
function getServerUrl(): string {
  const saved = localStorage.getItem('ai-agent-settings')
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      return settings.serverUrl || DEFAULT_SERVER_URL
    } catch (e) {
      return DEFAULT_SERVER_URL
    }
  }
  return DEFAULT_SERVER_URL
}

/**
 * Tool State REST API Composable
 */
export function useToolStateREST(userId: string, sessionId: string) {
  const artifacts = ref<ToolArtifact[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const pollingTimer = ref<number | null>(null)
  const pollingInterval = 3000 // 3 秒轮询一次
  const lastKnownVersions = ref<Map<string, string>>(new Map())

  /**
   * 获取会话的所有工具状态
   */
  async function fetchSessionArtifacts(): Promise<void> {
    if (!sessionId) return

    isLoading.value = true
    error.value = null

    try {
      const serverUrl = getServerUrl()
      const url = `${serverUrl}/api/v2/tool-state/session/${sessionId}`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      if (data.success) {
        const newArtifacts = data.artifacts || []

        // 检测变化 (避免不必要的更新)
        const hasChanges = newArtifacts.some((a: ToolArtifact) => {
          const lastVersion = lastKnownVersions.value.get(a.id)
          return lastVersion !== `${a.headerVersion}-${a.bodyVersion}`
        }) || lastKnownVersions.value.size !== newArtifacts.length

        if (hasChanges) {
          artifacts.value = newArtifacts

          // 更新已知版本
          const newMap = new Map<string, string>()
          newArtifacts.forEach((a: ToolArtifact) => {
            newMap.set(a.id, `${a.headerVersion}-${a.bodyVersion}`)
          })
          lastKnownVersions.value = newMap
        }
      } else {
        throw new Error(data.message || '获取工具状态失败')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '未知错误'
      console.error('获取工具状态失败:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 开始轮询
   */
  function startPolling(): void {
    stopPolling() // 先停止之前的轮询

    // 立即执行一次
    fetchSessionArtifacts()

    // 设置定时器
    pollingTimer.value = window.setInterval(fetchSessionArtifacts, pollingInterval)
  }

  /**
   * 停止轮询
   */
  function stopPolling(): void {
    if (pollingTimer.value) {
      clearInterval(pollingTimer.value)
      pollingTimer.value = null
    }
  }

  /**
   * 更新工具状态
   */
  async function updateArtifact(
    artifactId: string,
    status: string,
    body: Record<string, any>,
    expectedVersion: number
  ): Promise<boolean> {
    try {
      const serverUrl = getServerUrl()
      const response = await fetch(`${serverUrl}/api/v2/tool-state/${artifactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: userId,
          status,
          body,
          expectedVersion
        })
      })

      const data = await response.json()
      if (data.success) {
        // 立即刷新列表
        await fetchSessionArtifacts()
        return true
      } else if (data.reason === 'version-mismatch') {
        console.warn('版本冲突，需要刷新本地状态')
        await fetchSessionArtifacts()
        return false
      }
      return false
    } catch (err) {
      console.error('更新工具状态失败:', err)
      return false
    }
  }

  /**
   * 确认工具执行
   */
  async function confirmArtifact(artifactId: string, expectedVersion: number): Promise<boolean> {
    const artifact = artifacts.value.find(a => a.id === artifactId)
    if (!artifact) return false

    return updateArtifact(
      artifactId,
      'executing',
      {
        ...artifact.body,
        confirmation: { requested: true, granted: true }
      },
      expectedVersion
    )
  }

  /**
   * 拒绝工具执行
   */
  async function denyArtifact(artifactId: string, expectedVersion: number): Promise<boolean> {
    return updateArtifact(
      artifactId,
      'failed',
      {
        error: '用户拒绝执行',
        confirmation: { requested: true, granted: false }
      },
      expectedVersion
    )
  }

  /**
   * 手动刷新
   */
  async function refresh(): Promise<void> {
    await fetchSessionArtifacts()
  }

  // 监听 sessionId 变化，自动重启轮询
  watch(() => sessionId, (newId, oldId) => {
    if (newId && newId !== oldId) {
      lastKnownVersions.value = new Map()
      startPolling()
    }
  })

  onMounted(() => {
    if (sessionId) {
      startPolling()
    }
  })

  onUnmounted(() => {
    stopPolling()
  })

  return {
    artifacts,
    isLoading,
    error,
    fetchSessionArtifacts,
    startPolling,
    stopPolling,
    updateArtifact,
    confirmArtifact,
    denyArtifact,
    refresh
  }
}
