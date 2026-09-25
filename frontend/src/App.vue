<template>
  <div class="min-h-screen bg-slate-900 text-slate-200">
    <header class="border-b border-slate-700 px-6 py-4">
      <h1 class="text-2xl font-bold text-cyan-400">正则表达式可视化调试器</h1>
      <p class="text-sm text-slate-500 mt-1">NFA 状态机可视化 · 逐步匹配高亮 · 分组捕获 · 回溯追踪</p>
    </header>

    <div class="flex flex-col lg:flex-row gap-4 p-4">
      <div class="lg:w-1/4 space-y-4">
        <RegexEditor />
        <TemplateLibrary />
      </div>

      <div class="lg:w-1/2 space-y-4">
        <NfaVisualizer />
        <MatchHighlight />
      </div>

      <div class="lg:w-1/4 space-y-4">
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold text-slate-400">匹配统计</h3>
            <MatchBadge
              v-if="store.matchResult"
              :status="store.status"
              :match-count="store.matchResult.matches.length"
              :segment-count="store.matchResult.segmentCount"
              :per-whitespace="store.matchResult.perWhitespace"
            />
          </div>
          <div v-if="store.matchResult && store.status !== 'idle'" class="space-y-2 text-sm">
            <div class="flex justify-between items-center">
              <span class="text-slate-500">匹配状态</span>
              <span :class="statusClass">{{ statusText }}</span>
            </div>
            <div v-if="store.status === 'success'">
              <div v-if="store.matchResult.perWhitespace" class="flex justify-between"><span class="text-slate-500">匹配片段</span><span class="text-green-400">{{ store.matchResult.matches.length }} / {{ store.matchResult.segmentCount }} 段</span></div>
              <div v-else class="flex justify-between"><span class="text-slate-500">匹配处数</span><span class="text-green-400">{{ store.matchResult.matches.length }} 处</span></div>
            </div>
            <div v-if="store.status === 'success' && store.activeMatch">
              <div class="flex justify-between items-start gap-2">
                <span class="text-slate-500 shrink-0">当前片段</span>
                <span class="text-cyan-400 font-mono break-all text-right">#{{ store.activeMatchIndex + 1 }} {{ store.activeMatch.text }}</span>
              </div>
              <div class="flex justify-between"><span class="text-slate-500">捕获组</span><span class="text-slate-300">{{ participatingCount }} / {{ store.activeMatch.groups.length }} 参与</span></div>
            </div>
            <div v-if="store.status === 'nomatch'" class="text-red-400/80 text-xs break-all">{{ store.matchResult.reason }}</div>
            <div v-if="store.status === 'error'" class="text-red-400/80 text-xs break-all font-mono">{{ store.matchResult.errorMessage }}</div>
            <div class="flex justify-between"><span class="text-slate-500">总步数</span><span class="text-slate-300">{{ store.matchResult.totalSteps }}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">回溯次数</span><span :class="store.matchResult.backtracks > 0 ? 'text-orange-400 font-bold' : 'text-slate-300'">{{ store.matchResult.backtracks }}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">耗时(ms)</span><span class="text-slate-300">{{ store.matchResult.duration }}</span></div>
          </div>
          <div v-else class="text-slate-500 text-sm">点击「执行匹配」开始</div>
        </div>

        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">逐步控制</h3>
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <button @click="store.stepBackward()" :disabled="store.currentStep === 0" class="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded text-sm">⏮ 上一步</button>
            <button v-if="!store.isPlaying" @click="store.play()" :disabled="!hasSteps" class="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 rounded text-sm">▶ 播放</button>
            <button v-else @click="store.stop()" class="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm">⏸ 停止</button>
            <button @click="store.stepForward()" :disabled="!hasSteps || store.currentStep >= totalSteps - 1" class="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded text-sm">下一步 ⏭</button>
            <button @click="store.resetStep()" class="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">⟲ 重置</button>
          </div>
          <div class="text-sm text-slate-400">步骤: {{ hasSteps ? store.currentStep + 1 : 0 }} / {{ totalSteps }}</div>
          <div v-if="store.activeMatch" class="text-xs text-green-400 mt-1">当前位于匹配片段 #{{ store.activeMatchIndex + 1 }}</div>
        </div>

        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 class="text-sm font-bold text-slate-400 mb-3">当前步骤详情</h3>
          <div v-if="store.currentStepData" class="space-y-1 text-sm">
            <div>步骤序号: <span class="text-cyan-400">{{ store.currentStepData.stepIndex + 1 }} / {{ totalSteps }}</span></div>
            <div>字符索引: <span class="text-cyan-400">{{ store.currentStepData.charIndex }}</span></div>
            <div>当前字符: <span class="text-yellow-400 font-mono">'{{ store.currentStepData.char }}'</span></div>
            <div>状态转换: <span class="text-green-400">{{ store.currentStepData.currentState }}</span> → <span class="text-blue-400">{{ store.currentStepData.nextState }}</span></div>
            <div>转移符号: <span class="text-purple-400 font-mono">{{ store.currentStepData.transition }}</span></div>
            <div>所属片段:
              <span v-if="store.currentStepData.matchIndex >= 0" class="text-green-400">#{{ store.currentStepData.matchIndex + 1 }}</span>
              <span v-else class="text-slate-500">未命中片段</span>
            </div>
            <div v-if="store.currentStepData.isBacktrack" class="text-orange-400 font-bold">⚠ 回溯发生（尝试起点 @{{ store.currentStepData.attemptStart }}）</div>
          </div>
          <div v-else-if="store.status === 'nomatch'" class="text-red-400/80 text-sm">{{ store.matchResult?.reason || '暂无结果' }}</div>
          <div v-else-if="store.status === 'error'" class="text-red-400/80 text-sm">执行失败，无法生成步骤。</div>
          <div v-else-if="store.status === 'empty'" class="text-slate-500 text-sm">{{ store.matchResult?.reason || '空态' }}</div>
          <div v-else class="text-slate-500 text-sm">无步骤数据</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRegexStore } from './store/regex'
import RegexEditor from './components/RegexEditor.vue'
import NfaVisualizer from './components/NfaVisualizer.vue'
import MatchHighlight from './components/MatchHighlight.vue'
import TemplateLibrary from './components/TemplateLibrary.vue'
import MatchBadge from './components/MatchBadge.vue'

const store = useRegexStore()
onMounted(() => store.execute())

const totalSteps = computed(() => store.matchResult?.steps.length || 0)
const hasSteps = computed(() => totalSteps.value > 0)

const statusText = computed(() => {
  switch (store.status) {
    case 'success': return '✓ 匹配成功'
    case 'nomatch': return '✗ 未匹配'
    case 'error': return '⚠ 执行失败'
    case 'empty': return '○ 空态'
    default: return '等待执行'
  }
})

const statusClass = computed(() => {
  if (store.status === 'success') return 'text-green-400'
  if (store.status === 'nomatch') return 'text-red-400'
  if (store.status === 'error') return 'text-red-400 font-bold'
  return 'text-slate-400'
})

const participatingCount = computed(() => {
  if (!store.activeMatch) return 0
  return store.activeMatch.groups.filter(g => g.participating).length
})
</script>
