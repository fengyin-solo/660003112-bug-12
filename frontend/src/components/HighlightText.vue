<template>
  <span
    :class="mark ? [
      'rounded-[3px] transition-all',
      mark.kind === 'match' ? 'cursor-pointer px-[1px]' : 'px-[1px]',
      mark.kind === 'match' && mark.active ? 'text-white' : '',
      mark.kind === 'match' && !mark.active ? 'text-slate-300 hover:brightness-125' : '',
      mark.kind === 'fail' ? 'text-orange-300' : ''
    ] : 'whitespace-pre-wrap break-all leading-7'"
    :style="mark ? markStyle(mark) : {}"
    :title="mark ? markTitle(mark) : ''"
    @click="mark && mark.kind === 'match' ? onClickMark(mark) : null"
  >
    <template v-for="(node, i) in treeNodes" :key="i">
      <span v-if="node.type === 'text'">{{ node.text }}</span>
      <span
        v-else-if="node.type === 'caret'"
        class="inline-block w-[2px] h-4 mx-[1px] bg-cyan-300 align-middle animate-pulse"
        title="当前步骤位置"
      ></span>
      <HighlightText
        v-else
        :nodes="node.children"
        :mark="node.mark"
        @match-click="(idx) => emit('match-click', idx)"
      />
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getGroupColor } from '../store/regex'

export interface HighlightMark {
  kind: 'match' | 'group' | 'fail'
  start: number
  end: number
  matchIndex?: number
  groupIndex?: number
  active?: boolean
}

interface TextNode { type: 'text'; text: string }
interface CaretNode { type: 'caret' }
interface MarkNode { type: 'mark'; mark: HighlightMark; children: TreeNode[] }
type TreeNode = TextNode | CaretNode | MarkNode

const props = defineProps<{
  text?: string
  marks?: HighlightMark[]
  nodes?: TreeNode[]
  mark?: HighlightMark
  caretIndex?: number | null
}>()

const emit = defineEmits<{ (e: 'match-click', index: number): void }>()

function caretInRange(caret: number | null, start: number, end: number): number | null {
  if (caret === null) return null
  if (caret >= start && caret <= end) return caret
  return null
}

function buildNodes(text: string, marks: HighlightMark[], start: number, end: number, caret: number | null): TreeNode[] {
  const nodes: TreeNode[] = []
  let pos = start

  const pushText = (a: number, b: number) => {
    if (a >= b) return
    if (caret !== null && caret > a && caret < b) {
      if (a < caret) nodes.push({ type: 'text', text: text.slice(a, caret) })
      nodes.push({ type: 'caret' })
      if (caret < b) nodes.push({ type: 'text', text: text.slice(caret, b) })
    } else {
      nodes.push({ type: 'text', text: text.slice(a, b) })
    }
  }

  while (pos < end) {
    let cand: HighlightMark | null = null
    for (const m of marks) {
      if (m.end <= m.start) continue
      if (m.start < start || m.end > end) continue
      if (m.start < pos) continue
      if (!cand || m.start < cand.start || (m.start === cand.start && m.end > cand.end)) cand = m
    }
    if (!cand) {
      pushText(pos, end)
      break
    }
    if (caret === pos && pos === cand.start) nodes.push({ type: 'caret' })
    pushText(pos, cand.start)
    // 与外层完全同范围的子标记不嵌套渲染（由分组列表 / 颜色图例表达）
    const childPool = marks.filter(m => m !== cand
      && m.start >= cand.start && m.end <= cand.end
      && !(m.start === cand.start && m.end === cand.end))
    nodes.push({
      type: 'mark',
      mark: cand,
      children: buildNodes(text, childPool, cand.start, cand.end, caretInRange(caret, cand.start, cand.end))
    })
    pos = cand.end
    if (caret === pos && pos === end) nodes.push({ type: 'caret' })
    if (pos <= cand.start) break
  }
  return nodes
}

const treeNodes = computed<TreeNode[]>(() => {
  if (props.nodes) return props.nodes
  if (props.text === undefined) return []
  const caret = props.caretIndex ?? null
  return buildNodes(props.text, props.marks || [], 0, props.text.length, caret)
})

function markStyle(m: HighlightMark): Record<string, string> {
  if (m.kind === 'group' && m.groupIndex !== undefined) {
    const color = getGroupColor(m.groupIndex)
    return { 'box-shadow': `inset 0 0 0 1.5px ${color}`, 'background-color': `${color}22`, 'border-radius': '3px' }
  }
  if (m.kind === 'fail') {
    return { 'text-decoration-line': 'underline', 'text-decoration-style': 'wavy', 'text-decoration-color': '#f97316', 'text-decoration-thickness': '1.5px', 'text-underline-offset': '3px' }
  }
  if (m.active) {
    return { 'background-color': '#22c55e33', 'box-shadow': 'inset 0 0 0 1.5px #22c55e', 'border-radius': '3px' }
  }
  return { 'background-color': '#47556944', 'box-shadow': 'inset 0 0 0 1px #64748b', 'border-radius': '3px' }
}

function markTitle(m: HighlightMark): string {
  if (m.kind === 'group') return `捕获组 ${m.groupIndex}，点击片段可跳转`
  if (m.kind === 'fail') return '本次尝试未匹配（回溯）'
  return `匹配片段 #${(m.matchIndex ?? 0) + 1}${m.active ? '（当前步骤）' : '，点击跳转到该片段'}`
}

function onClickMark(m: HighlightMark) {
  if (m.kind === 'match' && m.matchIndex !== undefined) emit('match-click', m.matchIndex)
}
</script>
