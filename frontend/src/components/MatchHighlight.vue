<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <h3 class="text-sm font-bold text-slate-400 mb-3">匹配结果高亮</h3>

    <!-- 异常：解析失败 + 原因 + 重试 -->
    <div v-if="store.error" class="bg-red-900/30 border border-red-800 rounded-lg p-3">
      <div class="text-red-400 text-sm font-bold">✗ 解析失败</div>
      <div class="text-red-300/80 text-xs mt-1 break-all">{{ store.error }}</div>
      <button @click="store.execute()" class="mt-2 px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-xs text-white">⟳ 重试</button>
    </div>

    <!-- 暂无结果 -->
    <div v-else-if="!store.matchResult" class="text-slate-500 text-sm">等待执行...</div>

    <template v-else>
      <!-- 状态行：与匹配统计面板一致 -->
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-2">
        <span v-if="store.matchResult.matched" class="text-green-400 font-bold">✓ 匹配成功</span>
        <span v-else class="text-red-400 font-bold">✗ 未匹配</span>
        <span v-if="store.matchResult.matched" class="text-slate-500">位置 {{ store.matchResult.matchStart }} - {{ store.matchResult.matchEnd }}</span>
        <span v-if="currentCharIndex >= 0" class="text-orange-400">当前步骤字符 #{{ currentCharIndex }}</span>
      </div>

      <!-- 原始文本：未匹配/超长均完整显示，高亮跟随当前步骤与选中分组 -->
      <div class="bg-slate-900 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap break-all max-h-48 overflow-y-auto leading-6">
        <template v-if="store.testString">
          <span v-for="(seg, i) in segments" :key="i" :class="seg.cls" :style="seg.style">{{ seg.text }}</span>
        </template>
        <span v-else class="text-slate-600 italic">（测试文本为空）</span>
      </div>

      <!-- 图例：颜色语义与 NFA 画布一致 -->
      <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span v-if="store.matchResult.matched"><span class="inline-block w-3 h-3 rounded-sm bg-green-600 mr-1 align-middle"></span>匹配区域</span>
        <span><span class="inline-block w-3 h-3 rounded-sm bg-orange-500 mr-1 align-middle"></span>当前步骤</span>
        <span v-for="g in coloredGroups" :key="g.index">
          <span class="inline-block w-3 h-3 rounded-sm mr-1 align-middle" :style="{ backgroundColor: store.groupColor(g.index) }"></span>Group {{ g.index }}
        </span>
      </div>

      <!-- 未匹配：说明原因 -->
      <div v-if="!store.matchResult.matched" class="mt-2 text-red-300/80 text-xs">
        在测试文本中未找到符合该模式的片段（共执行 {{ store.matchResult.totalSteps }} 步，回溯 {{ store.matchResult.backtracks }} 次）
      </div>

      <!-- 引擎能力说明 -->
      <div v-if="store.unsupportedNote" class="mt-2 text-yellow-400/90 text-xs">⚠ {{ store.unsupportedNote }}</div>
    </template>

    <!-- 分组捕获列表：点击选中片段，文本高亮跟随移动 -->
    <div v-if="store.matchResult && store.matchResult.matched" class="mt-4">
      <h4 class="text-xs font-bold text-slate-500 mb-2">分组捕获 ({{ store.matchResult.groupSpans.length }})</h4>
      <div class="space-y-1">
        <div v-for="g in store.matchResult.groupSpans" :key="g.index"
          @click="store.selectGroup(g.index)"
          :class="['flex items-center gap-2 text-sm cursor-pointer rounded px-1 -mx-1 transition-all', store.selectedGroup === g.index ? 'ring-1 ring-cyan-400 bg-cyan-900/20' : 'hover:bg-slate-700/40']">
          <span class="inline-block w-4 h-4 rounded shrink-0" :style="{ backgroundColor: store.groupColor(g.index) }"></span>
          <span class="text-slate-500 w-16 shrink-0">Group {{ g.index }}</span>
          <span class="text-slate-200 font-mono bg-slate-900 px-2 py-0.5 rounded break-all">{{ g.text || '∅' }}</span>
          <span v-if="g.start >= 0" class="text-slate-500 text-xs shrink-0">@{{ g.start }}-{{ g.end }}</span>
        </div>
      </div>
      <div class="text-xs text-slate-600 mt-1">点击分组可在文本中定位对应片段</div>
    </div>

    <div v-if="store.matchResult && store.matchResult.steps.length > 0" class="mt-4">
      <h4 class="text-xs font-bold text-slate-500 mb-2">执行步骤 (最近5步)</h4>
      <div class="space-y-1 max-h-32 overflow-y-auto">
        <div v-for="step in recentSteps" :key="step.stepIndex"
          class="text-xs font-mono px-2 py-1 rounded"
          :class="step.isBacktrack ? 'bg-orange-900 text-orange-300' : step.stepIndex === store.currentStep ? 'bg-cyan-900 text-cyan-300' : 'bg-slate-900 text-slate-400'">
          [{{ step.stepIndex }}] '{{ step.char }}' → 状态{{ step.currentState }}→{{ step.nextState === -1 ? '失败' : step.nextState }} ({{ step.transition }}){{ step.isBacktrack ? ' ⚠回溯' : '' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRegexStore } from '../store/regex'

const store = useRegexStore()

const recentSteps = computed(() => {
  if (!store.matchResult) return []
  const end = store.currentStep + 1
  return store.matchResult.steps.slice(Math.max(0, end - 5), end)
})

// 当前播放步骤指向的字符位置，高亮跟随其移动
const currentCharIndex = computed(() => {
  const res = store.matchResult
  if (!res || res.steps.length === 0) return -1
  const step = res.steps[Math.min(store.currentStep, res.steps.length - 1)]
  return step ? step.charIndex : -1
})

const coloredGroups = computed(() => {
  if (!store.matchResult || !store.matchResult.matched) return []
  return store.matchResult.groupSpans.filter(g => g.index > 0 && g.start >= 0)
})

interface Segment {
  text: string
  cls: string
  style?: Record<string, string>
}

const CURRENT_CLS = 'bg-orange-500 text-white rounded-sm px-px'

// 按字符构建高亮片段，优先级：当前步骤字符(橙，与画布"当前激活"一致) > 选中分组(实心) > 分组颜色 > 匹配区域(绿)
const segments = computed<Segment[]>(() => {
  const text = store.testString
  const res = store.matchResult
  if (!text) return []
  const cur = currentCharIndex.value

  if (!res || !res.matched) {
    // 未匹配时完整显示原始内容，仅标记当前步骤字符
    if (!res || cur < 0 || cur >= text.length) return [{ text, cls: 'text-slate-300' }]
    return [
      { text: text.slice(0, cur), cls: 'text-slate-300' },
      { text: text[cur], cls: CURRENT_CLS },
      { text: text.slice(cur + 1), cls: 'text-slate-300' }
    ].filter(s => s.text.length > 0)
  }

  const n = text.length
  const groupColorAt: (string | null)[] = new Array(n).fill(null)
  const inMatch = new Array<boolean>(n).fill(false)
  const inSelected = new Array<boolean>(n).fill(false)
  let selectedColor: string | null = null

  for (let i = Math.max(0, res.matchStart); i < Math.min(n, res.matchEnd); i++) inMatch[i] = true
  // 按分组序号着色：嵌套分组序号更大后画，自然覆盖外层，重复内容按精确位置着色不串位
  for (const g of res.groupSpans) {
    if (g.index === 0 || g.start < 0) continue
    const color = store.groupColor(g.index)
    for (let i = g.start; i < g.end && i < n; i++) groupColorAt[i] = color
  }
  if (store.selectedGroup !== null) {
    const g = res.groupSpans.find(x => x.index === store.selectedGroup)
    if (g && g.start >= 0) {
      selectedColor = store.groupColor(g.index)
      for (let i = g.start; i < g.end && i < n; i++) inSelected[i] = true
    }
  }

  const styleOf = (i: number): string => `${inMatch[i]}|${groupColorAt[i] ?? ''}|${inSelected[i]}|${i === cur}`
  const segs: Segment[] = []
  let start = 0
  for (let i = 1; i <= n; i++) {
    if (i === n || styleOf(i) !== styleOf(start)) {
      segs.push(makeSegment(text.slice(start, i), start))
      start = i
    }
  }
  return segs

  function makeSegment(t: string, i: number): Segment {
    if (i === cur) return { text: t, cls: CURRENT_CLS }
    if (inSelected[i]) return { text: t, cls: 'text-white rounded-sm px-px', style: { backgroundColor: groupColorAt[i] ?? selectedColor ?? '#06b6d4' } }
    if (groupColorAt[i]) return { text: t, cls: 'text-white rounded-sm px-px', style: { backgroundColor: groupColorAt[i] + '59' } }
    if (inMatch[i]) return { text: t, cls: 'bg-green-600/60 text-white rounded-sm px-px' }
    return { text: t, cls: 'text-slate-500' }
  }
})
</script>
