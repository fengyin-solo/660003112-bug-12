<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-bold text-slate-400">NFA 状态机可视化</h3>
      <div class="flex items-center gap-2">
        <MatchBadge
          v-if="store.matchResult"
          :status="store.status"
          :match-count="store.matchResult.matches.length"
          :segment-count="store.matchResult.segmentCount"
          :per-whitespace="store.matchResult.perWhitespace"
        />
        <span v-if="store.nfa" class="text-xs text-slate-500">{{ store.nfa.states.length }} 状态 · {{ store.nfa.transitions.length }} 转移</span>
      </div>
    </div>

    <!-- 与结果面板同源的当前片段提示 -->
    <div class="mb-2 text-xs flex items-center gap-2 min-h-[20px]">
      <template v-if="store.matchResult && store.matchResult.status === 'error'">
        <span class="text-red-400">⚠ {{ store.matchResult.reason }}：{{ store.matchResult.errorMessage }}</span>
      </template>
      <template v-else-if="store.matchResult && store.matchResult.status === 'empty'">
        <span class="text-slate-500">○ {{ store.matchResult.reason }}</span>
      </template>
      <template v-else-if="store.matchResult && store.matchResult.status === 'nomatch'">
        <span class="text-red-400">✗ 暂无结果：{{ store.matchResult.reason }}</span>
      </template>
      <template v-else-if="step">
        <span class="text-slate-500">步骤 {{ step.stepIndex }}</span>
        <span class="text-slate-400">字符</span>
        <span class="text-yellow-400 font-mono">'{{ step.char }}'</span>
        <span class="text-slate-500">@{{ step.charIndex }}</span>
        <span v-if="step.matchIndex >= 0" class="text-green-400">→ 片段 #{{ step.matchIndex + 1 }}</span>
        <span v-else-if="step.isBacktrack" class="text-orange-400">→ 尝试 @{{ step.attemptStart }} ⚠ 回溯</span>
        <span v-else class="text-slate-500">→ 推进中</span>
      </template>
      <span v-else class="text-slate-600">无步骤数据</span>
    </div>

    <div v-if="store.matchResult && store.matchResult.status === 'error'" class="w-full bg-slate-900 rounded-lg border border-red-900 h-[300px] flex flex-col items-center justify-center gap-3">
      <div class="text-red-400 text-sm">无法构建状态机：正则表达式无效</div>
      <div class="text-red-500/70 text-xs font-mono px-4 text-center break-all">{{ store.matchResult.errorMessage }}</div>
      <button @click="store.execute()" class="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs text-white">↻ 重试</button>
    </div>
    <canvas v-else ref="canvasRef" width="800" height="500" class="w-full bg-slate-900 rounded-lg border border-slate-700"></canvas>

    <div class="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
      <span><span class="inline-block w-3 h-3 rounded-full bg-cyan-500 mr-1"></span>起始状态</span>
      <span><span class="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"></span>接受状态</span>
      <span><span class="inline-block w-3 h-3 rounded-full bg-orange-500 mr-1"></span>当前激活</span>
      <span><span class="inline-block w-3 h-3 rounded-full bg-slate-600 mr-1"></span>普通状态</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRegexStore } from '../store/regex'
import MatchBadge from './MatchBadge.vue'

const store = useRegexStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)

const step = ref(store.currentStepData)
watch(() => store.currentStepData, v => { step.value = v }, { deep: true })

function draw() {
  const canvas = canvasRef.value
  if (!canvas || !store.nfa) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const activeStates = new Set<number>()
  if (store.matchResult && store.currentStep < store.matchResult.steps.length) {
    const s = store.matchResult.steps[store.currentStep]
    if (s) { activeStates.add(s.currentState); if (s.nextState >= 0) activeStates.add(s.nextState) }
  }

  // Draw transitions
  store.nfa.transitions.forEach(t => {
    const from = store.nfa!.states.find(s => s.id === t.from)
    const to = store.nfa!.states.find(s => s.id === t.to)
    if (!from || !to) return

    const isActive = activeStates.has(t.from) && activeStates.has(t.to)
    ctx.strokeStyle = isActive ? '#f97316' : '#475569'
    ctx.lineWidth = isActive ? 2.5 : 1
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)

    if (t.from === t.to) {
      // Self loop
      const mx = from.x, my = from.y - 35
      ctx.quadraticCurveTo(mx + 25, my, from.x + 10, from.y - 15)
    } else {
      const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2
      const dx = to.x - from.x, dy = to.y - from.y
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const offX = -dy / len * 20, offY = dx / len * 20
      ctx.quadraticCurveTo(mx + offX, my + offY, to.x, to.y)
    }
    ctx.stroke()

    // Arrowhead
    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    const ex = to.x - Math.cos(angle) * 22, ey = to.y - Math.sin(angle) * 22
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - Math.cos(angle - 0.4) * 8, ey - Math.sin(angle - 0.4) * 8)
    ctx.lineTo(ex - Math.cos(angle + 0.4) * 8, ey - Math.sin(angle + 0.4) * 8)
    ctx.closePath()
    ctx.fillStyle = isActive ? '#f97316' : '#475569'
    ctx.fill()

    // Label
    const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2
    const dx2 = to.x - from.x, dy2 = to.y - from.y
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1
    const lx = mx - dy2 / len2 * 15, ly = my + dx2 / len2 * 15
    ctx.fillStyle = isActive ? '#fbbf24' : '#94a3b8'
    ctx.font = '11px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(t.label, lx, ly)
  })

  // Draw states
  store.nfa.states.forEach(s => {
    const isActive = activeStates.has(s.id)
    const color = s.isStart ? '#06b6d4' : s.isAccept ? '#22c55e' : isActive ? '#f97316' : '#475569'

    ctx.beginPath()
    ctx.arc(s.x, s.y, 20, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = isActive ? '#fbbf24' : '#1e293b'
    ctx.lineWidth = 2
    ctx.stroke()

    if (s.isAccept) {
      ctx.beginPath()
      ctx.arc(s.x, s.y, 15, 0, Math.PI * 2)
      ctx.strokeStyle = '#16a34a'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    ctx.fillStyle = '#f1f5f9'
    ctx.font = 'bold 12px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(s.id), s.x, s.y)

    if (s.isStart) {
      ctx.beginPath()
      ctx.moveTo(s.x - 40, s.y)
      ctx.lineTo(s.x - 22, s.y)
      ctx.strokeStyle = '#06b6d4'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(s.x - 22, s.y)
      ctx.lineTo(s.x - 28, s.y - 4)
      ctx.lineTo(s.x - 28, s.y + 4)
      ctx.closePath()
      ctx.fillStyle = '#06b6d4'
      ctx.fill()
    }
  })
}

onMounted(() => { nextTick(draw) })
watch(() => [store.nfa, store.currentStep, store.status], () => nextTick(draw), { deep: true })
</script>
