<template>
  <span
    v-if="status !== 'idle'"
    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold whitespace-nowrap"
    :class="badgeClass"
    :title="tooltip"
  >
    <span>{{ icon }}</span>
    <span v-if="showText">{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatchStatus } from '../types'

const props = withDefaults(defineProps<{
  status: MatchStatus
  matchCount?: number
  segmentCount?: number
  /** true: 按空白分段计数（X/Y 段）；false: 全文匹配计数（X 处） */
  perWhitespace?: boolean
  showText?: boolean
}>(), {
  matchCount: 0,
  segmentCount: 0,
  perWhitespace: true,
  showText: true
})

const icon = computed(() => {
  switch (props.status) {
    case 'success': return '✓'
    case 'nomatch': return '✗'
    case 'error': return '⚠'
    case 'empty': return '○'
    default: return ''
  }
})

const text = computed(() => {
  if (props.status === 'success') {
    return props.perWhitespace ? `命中 ${props.matchCount}/${props.segmentCount} 段` : `命中 ${props.matchCount} 处`
  }
  if (props.status === 'nomatch') {
    return props.perWhitespace ? `0/${props.segmentCount} 段 未匹配` : '未匹配'
  }
  if (props.status === 'error') return '正则错误'
  if (props.status === 'empty') return '空'
  return ''
})

const tooltip = computed(() => {
  if (props.status === 'success') {
    return props.perWhitespace
      ? `${props.segmentCount} 段文本中有 ${props.matchCount} 段匹配成功`
      : `全文中匹配到 ${props.matchCount} 处`
  }
  if (props.status === 'nomatch') {
    return props.perWhitespace ? `${props.segmentCount} 段文本均未与正则表达式匹配` : '测试文本中未找到匹配内容'
  }
  if (props.status === 'error') return '正则表达式语法错误或执行异常'
  if (props.status === 'empty') return '正则表达式或测试文本为空'
  return ''
})

const badgeClass = computed(() => {
  switch (props.status) {
    case 'success': return 'bg-green-900/60 text-green-300 border border-green-700'
    case 'nomatch': return 'bg-red-900/60 text-red-300 border border-red-800'
    case 'error': return 'bg-red-900/80 text-red-200 border border-red-600'
    case 'empty': return 'bg-slate-700/60 text-slate-400 border border-slate-600'
    default: return ''
  }
})
</script>
