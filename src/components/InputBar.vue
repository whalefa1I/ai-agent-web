<template>
  <div class="input-bar border-t bg-white p-4">
    <div class="max-w-4xl mx-auto">
      <!-- 输入框 -->
      <div class="flex items-end space-x-3 relative">
        <div class="flex-1 relative">
          <textarea
            v-model="input"
            :disabled="disabled || isThinking"
            placeholder="输入消息... (输入 / 显示命令)"
            class="w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 pr-12 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            rows="1"
            @keydown.enter.exact.prevent="sendMessage"
            @keydown.tab.prevent="handleTab"
            @keydown.down.prevent="handleKeyDown"
            @keydown.up.prevent="handleKeyUp"
            @keydown.escape.prevent="closeCommandMenu"
            @input="onInput"
            @click="onInput"
            ref="textareaRef"
          ></textarea>

          <!-- 斜杠命令自动补全菜单 -->
          <div
            v-if="showCommandMenu"
            class="absolute bottom-full left-0 mb-2 w-80 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50"
            :style="commandMenuStyle"
          >
            <div class="py-1">
              <div
                v-for="(cmd, index) in filteredCommands"
                :key="cmd.name"
                :class="[
                  'px-4 py-2.5 cursor-pointer flex items-start gap-3',
                  index === selectedCommandIndex ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'
                ]"
                @click="selectCommand(cmd)"
                @mouseenter="selectedCommandIndex = index"
              >
                <span class="text-primary-500 font-mono text-sm">/{cmd.name}</span>
                <span class="text-gray-500 text-sm flex-1">{{ cmd.description }}</span>
              </div>
              <div v-if="filteredCommands.length === 0" class="px-4 py-2.5 text-gray-400 text-sm">
                未找到匹配的命令
              </div>
            </div>
          </div>

          <!-- 附件按钮（预留） -->
          <button
            class="absolute right-3 bottom-3 text-gray-400 hover:text-gray-600 transition-colors"
            title="添加附件"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
        </div>

        <!-- 发送按钮 -->
        <button
          @click="sendMessage"
          :disabled="!input.trim() || disabled || isThinking"
          class="send-btn px-4 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
        >
          <span>发送</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

      <!-- 提示信息 -->
      <div class="mt-2 text-center text-xs text-gray-400">
        <span v-if="isThinking">AI 正在思考中...</span>
        <span v-else>按 Enter 发送，Shift+Enter 换行，Tab 补全命令</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { fetchSlashCommands } from '@/services/slash-command-api'

interface SlashCommand {
  name: string
  aliases: string[]
  description: string
  source: string
  enabled: boolean
}

const chatStore = useChatStore()
const input = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// 斜杠命令相关状态
const allCommands = ref<SlashCommand[]>([])
const showCommandMenu = ref(false)
const selectedCommandIndex = ref(0)
const commandMenuStyle = ref<Record<string, string>>({})
const commandTriggerPosition = ref({ start: 0, end: 0 })

const isThinking = computed(() => chatStore.isThinking)
const disabled = computed(() => chatStore.hasPendingPermission)

// 过滤后的命令列表
const filteredCommands = computed(() => {
  if (!showCommandMenu.value) return []

  const inputText = input.value
  const triggerPos = commandTriggerPosition.value
  const partialCommand = inputText.substring(triggerPos.start + 1, triggerPos.end)

  if (!partialCommand) {
    // 只输入了 /，返回所有命令
    return allCommands.value.filter(cmd => cmd.enabled)
  }

  // 模糊搜索
  const query = partialCommand.toLowerCase()
  return allCommands.value.filter(cmd => {
    if (!cmd.enabled) return false
    // 匹配命令名
    if (cmd.name.toLowerCase().startsWith(query)) return true
    // 匹配别名
    if (cmd.aliases.some(alias => alias.toLowerCase().startsWith(query))) return true
    // 匹配描述
    if (cmd.description.toLowerCase().includes(query)) return true
    return false
  })
})

// 加载斜杠命令列表
const loadCommands = async () => {
  try {
    allCommands.value = await fetchSlashCommands()
  } catch (error) {
    console.error('加载命令列表失败:', error)
  }
}

// 处理输入事件
const onInput = () => {
  checkSlashCommand()
  autoResize()
}

// 检查是否需要显示斜杠命令菜单
const checkSlashCommand = () => {
  const text = input.value
  const textarea = textareaRef.value

  if (!textarea) return

  const cursorPos = textarea.selectionStart

  // 查找最后一个 / 的位置（前面必须是空格或是开头）
  let lastSlashPos = -1
  for (let i = cursorPos - 1; i >= 0; i--) {
    if (text[i] === '/') {
      // 检查前面是否是空格或是开头
      if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n') {
        lastSlashPos = i
      }
      break
    } else if (text[i] === ' ' || text[i] === '\n') {
      // 遇到空格或换行，停止搜索
      break
    }
  }

  if (lastSlashPos >= 0) {
    // 找到 /，提取命令部分
    let endPos = cursorPos
    // 命令部分只包含字母数字和特定符号
    const cmdPattern = /^[a-zA-Z0-9_:-]*$/
    while (endPos < text.length && cmdPattern.test(text[endPos])) {
      endPos++
    }

    commandTriggerPosition.value = {
      start: lastSlashPos,
      end: endPos
    }

    // 计算菜单位置
    updateCommandMenuPosition(lastSlashPos)

    showCommandMenu.value = true
    selectedCommandIndex.value = 0
  } else {
    showCommandMenu.value = false
  }
}

// 更新命令菜单位置
const updateCommandMenuPosition = (triggerPos: number) => {
  const textarea = textareaRef.value
  if (!textarea) return

  // 获取触发位置的光标坐标
  const textBefore = input.value.substring(0, triggerPos)
  const lines = textBefore.split('\n')
  const currentLine = lines.length - 1
  const lineHeight = 24 // 估计行高

  // 简单的位置计算
  const top = -(lines.length - currentLine) * lineHeight - 10

  commandMenuStyle.value = {
    bottom: `${Math.abs(top)}px`,
    left: '0'
  }
}

// 关闭命令菜单
const closeCommandMenu = () => {
  showCommandMenu.value = false
}

// 选择命令
const selectCommand = (cmd: SlashCommand) => {
  const triggerPos = commandTriggerPosition.value
  const before = input.value.substring(0, triggerPos.start)
  const after = input.value.substring(triggerPos.end)

  input.value = before + '/' + cmd.name + ' ' + after

  // 关闭菜单
  closeCommandMenu()

  // 聚焦回输入框
  nextTick(() => {
    textareaRef.value?.focus()
    // 设置光标位置到命令后面
    if (textareaRef.value) {
      const newPos = before.length + cmd.name.length + 2 // +2 for '/' and ' '
      textareaRef.value.setSelectionRange(newPos, newPos)
    }
  })
}

// Tab 补全
const handleTab = () => {
  if (!showCommandMenu.value || filteredCommands.value.length === 0) return

  const cmd = filteredCommands.value[selectedCommandIndex.value]
  if (cmd) {
    selectCommand(cmd)
  }
}

// 方向键选择
const handleKeyDown = () => {
  if (!showCommandMenu.value) return
  selectedCommandIndex.value = Math.min(
    selectedCommandIndex.value + 1,
    filteredCommands.value.length - 1
  )
}

const handleKeyUp = () => {
  if (!showCommandMenu.value) return
  selectedCommandIndex.value = Math.max(selectedCommandIndex.value - 1, 0)
}

// 自动调整文本框高度
const autoResize = () => {
  const textarea = textareaRef.value
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }
}

// 发送消息
const sendMessage = async () => {
  // 如果命令菜单显示，先选择命令
  if (showCommandMenu.value && filteredCommands.value.length > 0) {
    const cmd = filteredCommands.value[selectedCommandIndex.value]
    if (cmd) {
      selectCommand(cmd)
      return
    }
  }

  const content = input.value.trim()
  if (!content || isThinking.value) return

  // 先清空输入框，再发送消息
  input.value = ''
  await nextTick()
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }

  // 异步发送消息，不阻塞 UI
  chatStore.sendMessage(content).catch(err => {
    console.error('发送失败:', err)
  })
}

// 生命周期
onMounted(() => {
  loadCommands()
})

onUnmounted(() => {
  // 清理
})
</script>

<style scoped>
.send-btn {
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.send-btn:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
  transform: translateY(-1px);
}

.send-btn:active:not(:disabled) {
  transform: translateY(0);
}
</style>
