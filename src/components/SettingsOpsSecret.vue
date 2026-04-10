<template>
  <div class="ops-secret-settings">
    <div class="setting-item">
      <label class="setting-label">
        <span class="label-text">Ops Secret</span>
        <span class="label-hint">用于监控子任务 SSE 进度</span>
      </label>
      <div class="input-group">
        <input
          :type="showSecret ? 'text' : 'password'"
          v-model="opsSecret"
          placeholder="输入你的 Ops Secret (sk-sp-...)"
          class="setting-input"
          @blur="saveSecret"
        />
        <button 
          class="toggle-btn"
          @click="showSecret = !showSecret"
          :title="showSecret ? '隐藏' : '显示'"
        >
          <svg v-if="showSecret" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
        </button>
      </div>
      <p class="setting-desc">
        用于实时显示并行子任务进度。可在 Railway 后台的 Environment Variables 中找到。
      </p>
    </div>

    <div class="connection-test" v-if="opsSecret">
      <button 
        class="test-btn"
        @click="testConnection"
        :disabled="isTesting"
      >
        <span v-if="isTesting">测试中...</span>
        <span v-else>测试连接</span>
      </button>
      <span v-if="testResult" class="test-result" :class="testResult.type">
        {{ testResult.message }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const STORAGE_KEY = 'ai-agent-ops-secret'

const opsSecret = ref('')
const showSecret = ref(false)
const isTesting = ref(false)
const testResult = ref<{ type: 'success' | 'error'; message: string } | null>(null)

// 加载已保存的 secret
onMounted(() => {
  opsSecret.value = localStorage.getItem(STORAGE_KEY) || ''
})

// 保存 secret
const saveSecret = () => {
  if (opsSecret.value.trim()) {
    localStorage.setItem(STORAGE_KEY, opsSecret.value.trim())
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
  testResult.value = null
}

// 测试连接
const testConnection = async () => {
  if (!opsSecret.value.trim()) return
  
  isTesting.value = true
  testResult.value = null
  
  try {
    // 获取服务器地址
    const saved = localStorage.getItem('ai-agent-settings')
    let serverUrl = 'http://localhost:8080'
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        serverUrl = settings.serverUrl || serverUrl
      } catch {
        // ignore
      }
    }
    
    // 尝试连接 SSE（使用当前 sessionId）
    const sessionId = localStorage.getItem('happy-session-id') || `session-${Date.now()}`
    
    const response = await fetch(`${serverUrl}/api/ops/stream/subagent/${sessionId}`, {
      headers: {
        'X-Ops-Secret': opsSecret.value.trim(),
        'Accept': 'text/event-stream'
      }
    })
    
    if (response.ok) {
      testResult.value = {
        type: 'success',
        message: '✅ 连接成功！SSE 实时进度已启用'
      }
      // 立即关闭测试连接
      response.body?.cancel()
    } else if (response.status === 401) {
      testResult.value = {
        type: 'error',
        message: '❌ 认证失败：Ops Secret 不正确'
      }
    } else {
      testResult.value = {
        type: 'error',
        message: `❌ 连接失败：HTTP ${response.status}`
      }
    }
  } catch (error) {
    testResult.value = {
      type: 'error',
      message: `❌ 网络错误：${error instanceof Error ? error.message : '无法连接到服务器'}`
    }
  } finally {
    isTesting.value = false
  }
}
</script>

<style scoped>
.ops-secret-settings {
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.setting-item {
  margin-bottom: 16px;
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.label-text {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.label-hint {
  font-size: 12px;
  color: #64748b;
}

.input-group {
  display: flex;
  gap: 8px;
}

.setting-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  background: white;
  transition: border-color 0.2s;
}

.setting-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.toggle-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: #f1f5f9;
}

.toggle-btn svg {
  width: 18px;
  height: 18px;
  color: #64748b;
}

.setting-desc {
  margin: 8px 0 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
}

.connection-test {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.test-btn {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.test-btn:hover:not(:disabled) {
  background: #2563eb;
}

.test-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.test-result {
  font-size: 13px;
}

.test-result.success {
  color: #16a34a;
}

.test-result.error {
  color: #dc2626;
}
</style>
