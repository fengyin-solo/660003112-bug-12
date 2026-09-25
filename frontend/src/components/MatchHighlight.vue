<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-bold text-slate-400">匹配结果高亮</h3>
      <MatchBadge
        v-if="result"
        :status="result.status"
        :match-count="result.matches.length"
        :segment-count="result.segmentCount"
        :per-whitespace="result.perWhitespace"
      />
    </div>

    <!-- 错误 / 异常 -->
    <div v-if="status === 'error'" class="bg-red-950/40 border border-red-800 rounded-lg p-3">
      <div class="text-red-300 text-sm font-bold mb-1">⚠ 执行失败：{{ result?.reason || '正则表达式解析错误' }}</div>
      <div class="text-red-400/80 text-xs font-mono break-all mb-2">{{ result?.errorMessage || error }}</div>
      <div class="text-slate-500 text-xs mb-3">请检查正则语法后重试。</div>
      <button @click="store.execute()" class="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs text-white">↻ 重试</button>
    </div>

    <!-- 空态 -->
    <div v-else-if="status === 'empty'" class="bg-slate-900 rounded-lg p-4 text-sm text-slate-500 border border-dashed border-slate-700">
      <div class="flex items-center gap-2">
        <span>○</span>
        <span>{{ result?.reason || '等待输入' }}</span>
      </div>
    </div>

    <!-- 未执行 -->
    <div v-else-if="!result || status === 'idle'" class="bg-slate-900 rounded-lg p-4 text-sm text-slate-500 border border-dashed border-slate-700">
      等待执行... 点击「执行匹配」按钮开始
    </div>

    <!-- 未匹配：原文仍完整展示 -->
    <template v-else-if="status === 'nomatch'">
      <div class="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto max-h-60 overflow-y-auto text-slate-500">
        <HighlightText :text="store.testString" :marks="marks" :caret-index="caretIndex" @match-click="store.selectMatch" />
      </div>
      <div class="mt-2 text-red-400 text-xs">✗ 暂无结果：{{ result?.reason }}</div>
    </template>

    <!-- 匹配成功：原文完整展示，超长可滚动 -->
    <template v-else-if="status === 'success'">
      <div class="flex items-center gap-3 mb-2 text-xs text-slate-500">
        <span v-if="result && result.perWhitespace">共 {{ result.segmentCount }} 段，命中 <span class="text-green-400 font-bold">{{ result.matches.length }}</span> 段</span>
        <span v-else>全文匹配到 <span class="text-green-400 font-bold">{{ result ? result.matches.length : 0 }}</span> 处</span>
        <span v-if="activeMatch" class="text-cyan-400">当前片段 #{{ activeIndex + 1 }}<template v-if="result && result.perWhitespace">（第 {{ activeMatch.segment + 1 }} 段）</template></span>
      </div>
      <div class="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-auto max-h-60 text-slate-200">
        <HighlightText :text="store.testString" :marks="marks" :caret-index="caretIndex" @match-click="store.selectMatch" />
      </div>
      <div class="mt-1 text-[11px] text-slate-600">点击高亮片段可跳转到对应步骤；播放 / 单步时高亮自动跟随当前步骤。</div>

      <!-- 当前片段分组：颜色按组号稳定 -->
      <div v-if="activeMatch" class="mt-4">
        <h4 class="text-xs font-bold text-slate-500 mb-2">分组捕获 · 片段 #{{ activeIndex + 1 }}（{{ activeMatch.groups.length }} 个捕获组）</h4>
        <div class="space-y-1">
          <div v-for="group in activeMatch.groups" :key="group.index"
            class="flex items-center gap-2 text-sm"
            :class="group.participating ? '' : 'opacity-50'">
            <span class="inline-block w-4 h-4 rounded shrink-0 border"
              :style="{ backgroundColor: groupColor(group.index), borderColor: groupColor(group.index) }"></span>
            <span class="text-slate-500 w-24 shrink-0 text-xs">
              Group {{ group.index }}<span v-if="group.name" class="text-slate-600"> &lt;{{ group.name }}&gt;</span>
            </span>
            <span class="text-slate-200 font-mono bg-slate-900 px-2 py-0.5 rounded text-xs break-all">
              {{ group.participating ? group.text : '∅ 未参与匹配' }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- 最近步骤 -->
    <div v-if="result && result.steps.length > 0" class="mt-4">
      <h4 class="text-xs font-bold text-slate-500 mb-2">执行步骤（最近5步）</h4>
      <div class="space-y-1 max-h-32 overflow-y-auto">
        <div v-for="step in recentSteps" :key="step.stepIndex"
          class="text-xs font-mono px-2 py-1 rounded"
          :class="step.isBacktrack ? 'bg-orange-900/70 text-orange-300' : step.stepIndex === store.currentStep ? 'bg-cyan-900/70 text-cyan-300' : 'bg-slate-900 text-slate-400'">
          [{{ step.stepIndex }}] '{{ step.char }}' @{{ step.charIndex }} → 状态{{ step.currentState }}→{{ step.nextState }}
          <span v-if="step.matchIndex >= 0" class="text-green-400">·片段#{{ step.matchIndex + 1 }}</span>
          <span v-else-if="step.isBacktrack" class="text-orange-400"> ·尝试@{{ step.attemptStart }}</span>
          {{ step.isBacktrack ? ' ⚠ 回溯' : '' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRegexStore, getGroupColor } from '../store/regex'
import HighlightText from './HighlightText.vue'
import type { HighlightMark } from './HighlightText.vue'
import MatchBadge from './MatchBadge.vue'
import type { MatchResult } from '../types'

const store = useRegexStore()
const result = computed(() => store.matchResult)
const status = computed(() => store.status)
const error = computed(() => store.error)
const activeIndex = computed(() => store.activeMatchIndex)
const activeMatch = computed(() => store.activeMatch)

function groupColor(i: number) {
  return getGroupColor(i)
}

const recentSteps = computed(() => {
  if (!result.value) return []
  const end = store.currentStep + 1
  return result.value.steps.slice(Math.max(0, end - 5), end)
})

/** 当前步骤光标位置 */
const caretIndex = computed<number | null>(() => {
  const step = store.currentStepData
  if (!step) return null
  return step.charIndex
})

/** 构造匹配 / 分组 / 回溯尝试的标记区间 */
const marks = computed<HighlightMark[]>(() => {
  const r = result.value
  if (!r) return []
  const out: HighlightMark[] = []

  if (r.status === 'success') {
    r.matches.forEach(entry => {
      const isActive = entry.index === activeIndex.value
      out.push({ kind: 'match', start: entry.start, end: entry.end, matchIndex: entry.index, active: isActive })
      if (isActive) {
        entry.groups.forEach(g => {
          if (g.participating && g.end > g.start) {
            out.push({ kind: 'group', start: g.start, end: g.end, groupIndex: g.index })
          }
        })
      }
    })
    out.push(...buildFailMarks(r, activeIndex.value))
  }
  return out
})

/** 当前步骤为真正失败的回溯（不属于任何成功片段）时，标记该次尝试区间 */
function buildFailMarks(r: MatchResult, active: number): HighlightMark[] {
  const step = store.currentStepData
  if (!step || !step.isBacktrack || step.matchIndex >= 0) return []
  const end = step.charIndex + 1
  if (end <= step.attemptStart) return []
  return [{ kind: 'fail', start: step.attemptStart, end, active: false }]
}
</script>
