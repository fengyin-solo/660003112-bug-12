<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-bold text-slate-400">正则表达式输入</h3>
      <MatchBadge
        v-if="store.matchResult"
        :status="store.status"
        :match-count="store.matchResult.matches.length"
        :segment-count="store.matchResult.segmentCount"
        :per-whitespace="store.matchResult.perWhitespace"
      />
    </div>
    <div class="relative">
      <span class="absolute left-3 top-2 text-cyan-500 font-bold text-lg">/</span>
      <input
        v-model="localPattern"
        @input="onInput"
        @keyup.enter="execute"
        type="text"
        placeholder="输入正则表达式..."
        class="w-full bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-12 py-2 text-cyan-400 font-mono text-sm focus:outline-none focus:border-cyan-500"
      />
      <span class="absolute right-3 top-2 text-cyan-500 font-bold text-lg">/g</span>
    </div>
    <div v-if="store.error" class="mt-2 text-red-400 text-xs">
      <div class="font-bold">⚠ {{ store.matchResult?.reason || '正则表达式解析错误' }}</div>
      <div class="font-mono text-red-500/80 break-all">{{ store.error }}</div>
    </div>
    <textarea
      v-model="localTestString"
      @input="onTestInput"
      placeholder="输入测试字符串..."
      rows="3"
      class="w-full mt-3 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-cyan-500 resize-none"
    ></textarea>
    <div class="flex gap-2 mt-3">
      <button @click="execute" class="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-bold text-sm">执行匹配</button>
      <button v-if="store.status === 'error'" @click="store.execute()" class="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-white font-bold text-sm">↻ 重试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRegexStore } from '../store/regex'
import MatchBadge from './MatchBadge.vue'

const store = useRegexStore()
const localPattern = ref(store.pattern)
const localTestString = ref(store.testString)

// 切换模板 / 外部更新时，输入框内容与 store 保持同步
watch(() => store.pattern, v => { localPattern.value = v })
watch(() => store.testString, v => { localTestString.value = v })

let debounceTimer: ReturnType<typeof setTimeout> | undefined
function onInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { store.setPattern(localPattern.value) }, 300)
}
function onTestInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { store.setTestString(localTestString.value) }, 300)
}
function execute() {
  clearTimeout(debounceTimer)
  store.pattern = localPattern.value
  store.testString = localTestString.value
  store.execute()
}
</script>
