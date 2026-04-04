<template>
  <div class="app-container">
    <router-view />
  </div>
</template>

<script setup lang="ts">
// 不再需要 WebSocket 初始化
</script>

<style>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
