<template>
  <div class="debug-panel" :class="{ 'collapsed': isCollapsed }">
    <!-- 面板头部 -->
    <div class="debug-header" @click="toggleCollapse">
      <div class="header-left">
        <span class="toggle-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
        <span class="header-title">🔧 调试日志</span>
        <span class="log-count">{{ logs.length }} 条</span>
      </div>
      <div class="header-actions">
        <button @click.stop="clearLogs" class="btn-clear" title="清空日志">🗑️</button>
        <button @click.stop="exportLogs" class="btn-export" title="导出日志">📥</button>
        <button @click.stop="toggleFilter" class="btn-filter" title="筛选">
          {{ showAllLogs ? '全部' : '错误' }}
        </button>
        <button @click.stop="toggleCollapse" class="btn-collapse">
          {{ isCollapsed ? '展开' : '收起' }}
        </button>
      </div>
    </div>

    <!-- 日志列表 -->
    <div class="debug-body" v-show="!isCollapsed">
      <div class="log-filters" v-if="showFilter">
        <label>
          <input type="checkbox" v-model="filterDebug" /> Debug
        </label>
        <label>
          <input type="checkbox" v-model="filterInfo" /> Info
        </label>
        <label>
          <input type="checkbox" v-model="filterWarn" /> Warn
        </label>
        <label>
          <input type="checkbox" v-model="filterError" /> Error
        </label>
      </div>

      <div class="log-list">
        <div
          v-for="log in filteredLogs"
          :key="log.timestamp + log.message"
          class="log-entry"
          :class="`level-${log.level}`"
        >
          <div class="log-timestamp">{{ formatTime(log.timestamp) }}</div>
          <div class="log-component">{{ log.component }}</div>
          <div class="log-level">{{ log.level.toUpperCase() }}</div>
          <div class="log-message">{{ log.message }}</div>
          <div class="log-data" v-if="log.data">
            <pre>{{ JSON.stringify(log.data, null, 2) }}</pre>
          </div>
        </div>

        <div v-if="filteredLogs.length === 0" class="no-logs">
          暂无日志
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { logger, type LogEntry } from '@/utils/debug-logger';

const logs = ref<LogEntry[]>([]);
const isCollapsed = ref(false);
const showFilter = ref(false);
const showAllLogs = ref(true);

// 过滤器
const filterDebug = ref(true);
const filterInfo = ref(true);
const filterWarn = ref(true);
const filterError = ref(true);

// 定时获取日志
let pollInterval: number | null = null;

const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    if (!showAllLogs.value) {
      return log.level === 'error' || log.level === 'warn';
    }
    switch (log.level) {
      case 'debug': return filterDebug.value;
      case 'info': return filterInfo.value;
      case 'warn': return filterWarn.value;
      case 'error': return filterError.value;
      default: return true;
    }
  });
});

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}

function toggleFilter() {
  showFilter.value = !showFilter.value;
  showAllLogs.value = filterDebug.value && filterInfo.value && filterWarn.value && filterError.value;
}

function clearLogs() {
  logger.clear();
  logs.value = [];
}

function exportLogs() {
  const content = logger.exportLogs();
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `debug-logs-${new Date().toISOString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatTime(timestamp: string): string {
  return timestamp.split('T')[1]?.split('.')[0] || timestamp;
}

// 轮询日志
function pollLogs() {
  const newLogs = logger.getLogs();
  logs.value = newLogs;
}

onMounted(() => {
  pollLogs();
  pollInterval = window.setInterval(pollLogs, 1000);
});

watch([filterDebug, filterInfo, filterWarn, filterError], () => {
  showAllLogs.value = filterDebug.value && filterInfo.value && filterWarn.value && filterError.value;
});
</script>

<style scoped>
.debug-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  z-index: 9999;
  border-top: 2px solid #007acc;
  max-height: 400px;
  overflow: hidden;
}

.debug-panel.collapsed {
  max-height: auto;
}

.debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #252526;
  cursor: pointer;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-icon {
  font-size: 10px;
}

.header-title {
  font-weight: 600;
}

.log-count {
  font-size: 11px;
  color: #808080;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.header-actions button {
  background: #3c3c3c;
  border: 1px solid #555;
  color: #d4d4d4;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}

.header-actions button:hover {
  background: #4c4c4c;
}

.debug-body {
  height: 300px;
  overflow-y: auto;
  background: #1e1e1e;
}

.log-filters {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid #333;
  background: #252526;
}

.log-filters label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.log-list {
  padding: 8px;
}

.log-entry {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid #333;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry.level-debug {
  background: #1e1e1e;
}

.log-entry.level-info {
  background: #1a1a2e;
}

.log-entry.level-warn {
  background: #2d2a1a;
  color: #f1c40f;
}

.log-entry.level-error {
  background: #2a1a1a;
  color: #e74c3c;
}

.log-timestamp {
  color: #808080;
  min-width: 80px;
}

.log-component {
  color: #4ec9b0;
  font-weight: 600;
  min-width: 120px;
}

.log-level {
  min-width: 50px;
  font-weight: 700;
}

.log-level.debug {
  color: #808080;
}

.log-level.info {
  color: #569cd6;
}

.log-level.warn {
  color: #f1c40f;
}

.log-level.error {
  color: #e74c3c;
}

.log-message {
  flex: 1;
  min-width: 200px;
}

.log-data {
  width: 100%;
  margin-top: 4px;
  padding: 4px 8px;
  background: #111;
  border-radius: 3px;
  overflow-x: auto;
}

.log-data pre {
  margin: 0;
  color: #ce9178;
  font-size: 11px;
}

.no-logs {
  text-align: center;
  color: #808080;
  padding: 20px;
}
</style>
