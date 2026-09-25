import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NFA, MatchResult, MatchStep, RegexTemplate, ASTNode, MatchEntry, GroupCapture, MatchStatus } from '../types'

export const GROUP_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

/** 颜色按捕获组编号稳定分配：任何片段中 Group N 颜色都相同，与出现顺序 / 是否匹配无关 */
export function getGroupColor(groupIndex: number): string {
  return GROUP_COLORS[(groupIndex - 1 + GROUP_COLORS.length) % GROUP_COLORS.length]
}

export const TEMPLATES: RegexTemplate[] = [
  { name: '邮箱地址', pattern: '^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\\.([a-zA-Z]{2,})$', description: '匹配标准邮箱格式：用户名@域名.顶级域', testString: 'user@example.com admin@mail.org user@example.com invalid-email', category: '常用' },
  { name: 'URL链接', pattern: '^(https?)://([^/:]+)(?::(\\d+))?(.*)$', description: '匹配HTTP/HTTPS URL：协议://主机:端口/路径', testString: 'https://www.example.com:8080/path/to/page http://localhost:3000/api', category: '常用' },
  { name: 'IPv4地址', pattern: '^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$', description: '匹配IPv4地址四段数字', testString: '192.168.1.1 10.0.0.1 255.255.255.0', category: '常用' },
  { name: '日期格式', pattern: '^(\\d{4})-(\\d{2})-(\\d{2})$', description: '匹配YYYY-MM-DD日期', testString: '2024-01-15 1999-12-31 2025-06-06', category: '常用' },
  { name: '手机号码', pattern: '^1[3-9]\\d{9}$', description: '匹配中国大陆手机号', testString: '13800138000 15912345678 18600000000', category: '常用' },
  { name: '身份证号', pattern: '^(\\d{6})(\\d{4})(\\d{2})(\\d{2})(\\d{3})([0-9Xx])$', description: '18位身份证：地区码+出生日期+顺序码+校验码', testString: '11010119900101001X 440304200512120039', category: '常用' },
  { name: '十六进制颜色', pattern: '^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$', description: '匹配#RGB或#RRGGBB格式', testString: '#FF5733 #abc #1A2B3C ff0000', category: '前端' },
  { name: '邮政编码', pattern: '^\\d{6}$', description: '6位中国邮编', testString: '100000 518000 200120', category: '常用' },
  { name: '浮点数', pattern: '^-?\\d+\\.\\d+$', description: '匹配带小数点的数字', testString: '3.14 -0.5 100.0', category: '数字' },
  { name: '科学计数法', pattern: '^-?\\d+(\\.\\d+)?[eE][+-]?\\d+$', description: '匹配科学计数法数字', testString: '1.5e10 -2.3E-4 6.022e23', category: '数字' },
  { name: 'MAC地址', pattern: '^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$', description: '匹配MAC地址XX:XX:XX:XX:XX:XX', testString: '00:1A:2B:3C:4D:5E AA-BB-CC-DD-EE-FF', category: '网络' },
  { name: 'UUID', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', description: '标准UUID格式', testString: '550e8400-e29b-41d4-a716-446655440000', category: '网络' },
  { name: 'QQ号', pattern: '^[1-9]\\d{4,10}$', description: '5-11位QQ号', testString: '12345 10000 1234567890', category: '常用' },
  { name: '密码强度', pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$', description: '至少8位含大小写字母数字特殊字符', testString: 'Passw0rd! Str0ng@Pass', category: '安全' },
  { name: '中文姓名', pattern: '^[\\u4e00-\\u9fa5]{2,4}$', description: '2-4位中文字符', testString: '张三 李世明 王小明', category: '常用' },
  { name: '车牌号', pattern: '^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-Z][A-HJ-NP-Z0-9]{5}$', description: '中国车牌格式', testString: '京A12345 沪B6789X', category: '常用' },
  { name: 'HTML标签', pattern: '<(\\w+)(\\s[^>]*)?>(.*?)</\\1>', description: '匹配HTML开闭标签对', testString: '<div class="x">content</div> <span>text</span>', category: '前端' },
  { name: '文件扩展名', pattern: '^.+\\.(\\w+)$', description: '提取文件扩展名', testString: 'image.png doc.pdf index.html', category: '前端' },
  { name: '经纬度', pattern: '^(\\-?\\d{1,3}\\.\\d+)\\s*,\\s*(\\-?\\d{1,3}\\.\\d+)$', description: '匹配经纬度坐标', testString: '116.404,39.915 -73.9857,40.7484', category: '地理' },
  { name: '版本号', pattern: '^(\\d+)\\.(\\d+)\\.(\\d+)(?:-(\\w+))?$', description: '语义化版本号x.y.z-tag', testString: '1.0.0 2.3.1-beta 10.20.30', category: '常用' },
  { name: '时间格式', pattern: '^([01]?\\d|2[0-3]):([0-5]\\d)(?::([0-5]\\d))?$', description: 'HH:MM或HH:MM:SS', testString: '14:30 23:59:59 00:00', category: '常用' }
]

interface StateNode {
  id: number
  isAccept: boolean
  transitions: Map<string, number[]>
  epsilonTransitions: number[]
  _matcher?: (ch: string) => boolean
}

const MAX_STEPS = 20000

function buildNFA(pattern: string): { states: StateNode[]; startState: number; acceptStates: number[] } {
  const states: StateNode[] = []
  let stateCounter = 0
  let pos = 0

  function newState(): number {
    const id = stateCounter++
    states.push({ id, isAccept: false, transitions: new Map(), epsilonTransitions: [] })
    return id
  }

  function addTransition(from: number, symbol: string, to: number) {
    if (!states[from].transitions.has(symbol)) {
      states[from].transitions.set(symbol, [])
    }
    states[from].transitions.get(symbol)!.push(to)
  }

  function addEpsilon(from: number, to: number) {
    states[from].epsilonTransitions.push(to)
  }

  function parseCharClass(): (ch: string) => boolean {
    const negative = pattern[pos] === '^'
    if (negative) pos++
    const ranges: [string, string][] = []
    const chars: string[] = []
    while (pos < pattern.length && pattern[pos] !== ']') {
      if (pattern[pos + 1] === '-' && pattern[pos + 2] && pattern[pos + 2] !== ']') {
        ranges.push([pattern[pos], pattern[pos + 2]])
        pos += 3
      } else {
        chars.push(pattern[pos])
        pos++
      }
    }
    pos++ // skip ]
    return (ch: string) => {
      if (negative) {
        return !chars.includes(ch) && !ranges.some(([s, e]) => ch >= s && ch <= e)
      }
      return chars.includes(ch) || ranges.some(([s, e]) => ch >= s && ch <= e)
    }
  }

  function parseConcat(): [number, number] {
    let start = newState()
    let end = start
    while (pos < pattern.length && !['|', ')'].includes(pattern[pos])) {
      let segStart: number, segEnd: number
      const ch = pattern[pos]
      if (ch === '(') {
        pos++
        if (pattern[pos] === '?') {
          pos++
          if (pattern[pos] === ':') { pos++; }
          const [s, e] = parseOr()
          segStart = s; segEnd = e
        } else {
          const [s, e] = parseOr()
          segStart = s; segEnd = e
        }
        pos++ // skip )
      } else if (ch === '[') {
        pos++
        segStart = newState()
        segEnd = newState()
        const matcher = parseCharClass()
        addTransition(segStart, '__class_' + segStart, segEnd)
        states[segStart]._matcher = matcher
      } else if (ch === '.') {
        segStart = newState()
        segEnd = newState()
        addTransition(segStart, '__dot', segEnd)
        pos++
      } else if (ch === '\\') {
        pos++
        const escaped = pattern[pos]
        segStart = newState()
        segEnd = newState()
        if (escaped === 'd') addTransition(segStart, '__digit', segEnd)
        else if (escaped === 'w') addTransition(segStart, '__word', segEnd)
        else if (escaped === 's') addTransition(segStart, '__space', segEnd)
        else addTransition(segStart, escaped, segEnd)
        pos++
      } else if (ch === '^' || ch === '$') {
        segStart = newState()
        segEnd = segStart
        pos++
      } else {
        segStart = newState()
        segEnd = newState()
        addTransition(segStart, ch, segEnd)
        pos++
      }

      // Handle quantifiers
      while (pos < pattern.length && ['*', '+', '?', '{'].includes(pattern[pos])) {
        const q = pattern[pos]
        if (q === '{') {
          while (pos < pattern.length && pattern[pos] !== '}') pos++
          pos++
        } else {
          pos++
        }
        const qStart = newState()
        const qEnd = newState()
        addEpsilon(qStart, segStart)
        if (q === '*') { addEpsilon(qStart, qEnd); addEpsilon(segEnd, qEnd); addEpsilon(segEnd, segStart) }
        else if (q === '+') { addEpsilon(segEnd, qEnd); addEpsilon(segEnd, segStart) }
        else if (q === '?') { addEpsilon(qStart, qEnd); addEpsilon(segEnd, qEnd) }
        segStart = qStart; segEnd = qEnd
        if (pos < pattern.length && pattern[pos] === '?') pos++ // lazy
      }

      if (end !== segStart) addEpsilon(end, segStart)
      end = segEnd
    }
    return [start, end]
  }

  function parseOr(): [number, number] {
    const [s1, e1] = parseConcat()
    let start = s1, end = e1
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++
      const [s2, e2] = parseConcat()
      const ns = newState(), ne = newState()
      addEpsilon(ns, start); addEpsilon(ns, s2)
      addEpsilon(end, ne); addEpsilon(e2, ne)
      start = ns; end = ne
    }
    return [start, end]
  }

  const [startState, acceptState] = parseOr()
  states[acceptState].isAccept = true
  return { states, startState, acceptStates: [acceptState] }
}

function epsilonClosure(states: StateNode[], stateId: number): Set<number> {
  const closure = new Set<number>([stateId])
  const stack = [stateId]
  while (stack.length) {
    const s = stack.pop()!
    for (const next of states[s].epsilonTransitions) {
      if (!closure.has(next)) {
        closure.add(next)
        stack.push(next)
      }
    }
  }
  return closure
}

function matchTransition(state: StateNode, symbol: string): number[] {
  const results: number[] = []
  for (const [sym, targets] of state.transitions) {
    if (sym === symbol) { results.push(...targets); continue }
    if (sym === '__dot' && symbol !== '\n') { results.push(...targets); continue }
    if (sym === '__digit' && /\d/.test(symbol)) { results.push(...targets); continue }
    if (sym === '__word' && /\w/.test(symbol)) { results.push(...targets); continue }
    if (sym === '__space' && /\s/.test(symbol)) { results.push(...targets); continue }
    if (sym.startsWith('__class_')) {
      const matcher = state._matcher
      if (matcher && matcher(symbol)) results.push(...targets)
    }
  }
  return results
}

/** 统计捕获组数量（跳过 (?: 等非捕获组，正确处理字符类与转义） */
function countCaptureGroups(pattern: string): number {
  let count = 0
  let inClass = false
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '\\') { i++; continue }
    if (ch === '[') { inClass = true; continue }
    if (ch === ']') { inClass = false; continue }
    if (inClass) continue
    if (ch === '(' && pattern[i + 1] !== '?') count++
  }
  return count
}

interface Segment { start: number; end: number; text: string }

/** 按空白切分测试文本为多段，保留全局偏移（^ $ 锚定以段为单位） */
function splitSegments(input: string): Segment[] {
  const segments: Segment[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(input)) !== null) {
    segments.push({ start: m.index, end: m.index + m[0].length, text: m[0] })
    if (m[0].length === 0) re.lastIndex++
  }
  return segments
}

interface NativeMatch {
  segmentStart: number
  index: number // 段内偏移
  text: string
  exec: RegExpExecArray
}

function collectNativeMatches(regex: RegExp, segments: Segment[]): NativeMatch[] {
  const out: NativeMatch[] = []
  for (const seg of segments) {
    regex.lastIndex = 0
    let m: RegExpExecArray | null
    let guard = 0
    while ((m = regex.exec(seg.text)) !== null && guard++ < 10000) {
      out.push({ segmentStart: seg.start, index: m.index, text: m[0], exec: m })
      if (m[0].length === 0) regex.lastIndex++
    }
  }
  return out
}

function buildEntries(raw: NativeMatch[], groupCount: number): MatchEntry[] {
  const bySegment = new Map<number, NativeMatch[]>()
  raw.forEach(r => {
    const arr = bySegment.get(r.segmentStart) || []
    arr.push(r)
    bySegment.set(r.segmentStart, arr)
  })
  const segStarts = Array.from(bySegment.keys()).sort((a, b) => a - b)

  const entries: MatchEntry[] = []
  let entryIdx = 0
  segStarts.forEach((segStart, segIdx) => {
    bySegment.get(segStart)!.forEach(r => {
      const m = r.exec
      const indices = (m as any).indices ?? null
      const namedGroups: Record<string, number> = {}
      if (indices && indices.groups) {
        Object.keys(indices.groups).forEach(name => {
          const span = indices.groups[name]
          if (span) {
            for (let i = 1; i < indices.length; i++) {
              const s = indices[i]
              if (s && s[0] === span[0] && s[1] === span[1]) { namedGroups[name] = i; break }
            }
          }
        })
      }
      const groups: GroupCapture[] = []
      for (let i = 1; i <= groupCount; i++) {
        const span = indices ? indices[i] : undefined
        const participating = !!span
        const name = Object.keys(namedGroups).find(n => namedGroups[n] === i) || null
        groups.push({
          index: i,
          name,
          text: m[i] !== undefined ? m[i] : '',
          start: span ? r.segmentStart + span[0] : -1,
          end: span ? r.segmentStart + span[1] : -1,
          participating
        })
      }
      entries.push({
        index: entryIdx++,
        segment: segIdx,
        start: r.segmentStart + r.index,
        end: r.segmentStart + r.index + r.text.length,
        text: r.text,
        groups
      })
    })
  })
  return entries
}

/** 用 NFA 模拟逐步执行，生成与片段关联的步骤（供画布与逐步播放） */
function buildSteps(states: StateNode[], startState: number, segments: Segment[], entries: MatchEntry[]): { steps: MatchStep[]; backtracks: number } {
  const steps: MatchStep[] = []
  let backtracks = 0
  let stepIndex = 0

  function matchIndexAt(pos: number): number {
    for (const e of entries) {
      if (pos >= e.start && pos < e.end) return e.index
    }
    return -1
  }

  outer:
  for (const seg of segments) {
    for (let startPos = seg.start; startPos < seg.end; startPos++) {
      let currentStates = Array.from(epsilonClosure(states, startState))
      const attemptStart = startPos
      const attemptSteps: MatchStep[] = []

      for (let i = startPos; i < seg.end; i++) {
        const char = seg.text[i - seg.start]
        const nextStates: number[] = []
        const seen = new Set<number>()

        for (const s of currentStates) {
          const targets = matchTransition(states[s], char)
          for (const t of targets) {
            const closure = epsilonClosure(states, t)
            for (const c of closure) {
              if (!seen.has(c)) {
                seen.add(c)
                nextStates.push(c)
                attemptSteps.push({
                  stepIndex: -1,
                  charIndex: i,
                  char,
                  currentState: s,
                  nextState: c,
                  transition: char,
                  isBacktrack: false,
                  isMatch: true,
                  attemptStart,
                  matchIndex: matchIndexAt(i)
                })
              }
            }
          }
        }

        if (nextStates.length === 0) {
          attemptSteps.push({
            stepIndex: -1,
            charIndex: i,
            char,
            currentState: currentStates[0] ?? -1,
            nextState: -1,
            transition: 'FAIL',
            isBacktrack: true,
            isMatch: false,
            attemptStart,
            matchIndex: matchIndexAt(i)
          })
          backtracks++
          break
        }
        currentStates = nextStates
        if (steps.length + attemptSteps.length >= MAX_STEPS) break outer
      }

      // 该次尝试若落在某个成功片段内（含中途失败的死胡同），统一归到该片段
      const attemptMatch = matchIndexAt(attemptStart)
      for (const st of attemptSteps) {
        if (st.matchIndex < 0) st.matchIndex = attemptMatch
        st.stepIndex = stepIndex++
        steps.push(st)
      }
      if (steps.length >= MAX_STEPS) break outer
    }
  }
  return { steps, backtracks }
}

function emptyResult(status: MatchStatus, reason: string, duration = 0): MatchResult {
  return {
    status,
    matched: false,
    matches: [],
    segmentCount: 0,
    perWhitespace: false,
    matchText: '',
    matchStart: -1,
    matchEnd: -1,
    groups: [],
    steps: [],
    backtracks: 0,
    totalSteps: 0,
    duration,
    reason,
    errorMessage: ''
  }
}

/** 是否含 ^ $ 锚点（忽略字符类内部与转义） */
function hasAnchor(pattern: string): boolean {
  let inClass = false
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '\\') { i++; continue }
    if (ch === '[') { inClass = true; continue }
    if (ch === ']') { inClass = false; continue }
    if (!inClass && (ch === '^' || ch === '$')) return true
  }
  return false
}

/**
 * 匹配范围单元：
 * - 锚点模式（^/$）：按空白切分成多段，每段独立锚定
 * - 普通模式：整段文本作为一个单元，全局扫描（允许匹配内含空白）
 */
function resolveScopes(pattern: string, input: string): { segments: Segment[]; perWhitespace: boolean } {
  if (hasAnchor(pattern)) return { segments: splitSegments(input), perWhitespace: true }
  return { segments: [{ start: 0, end: input.length, text: input }], perWhitespace: false }
}

type EvalStatus = 'empty' | 'error' | 'nomatch' | 'success'
type Evaluation =
  | { status: EvalStatus; groupCount: number; segments: Segment[]; perWhitespace: boolean; entries: MatchEntry[]; reason: string; errorMessage: string }

/** 共享匹配核心：编译正则 -> 确定范围 -> 执行 -> 构造带捕获组偏移的片段 */
function evaluate(pattern: string, input: string): Evaluation {
  const base = (status: EvalStatus, reason: string, errorMessage = ''): Evaluation => ({
    status, groupCount: 0, segments: [], perWhitespace: false, entries: [], reason, errorMessage
  })

  if (pattern.trim() === '') return base('empty', '正则表达式为空')
  if (input === '') return base('empty', '测试文本为空')

  let regex: RegExp
  try {
    regex = new RegExp(pattern, 'gd')
  } catch {
    try {
      regex = new RegExp(pattern, 'g')
    } catch (e: any) {
      return base('error', '正则表达式语法错误', e?.message || '正则表达式语法错误')
    }
  }

  const { segments, perWhitespace } = resolveScopes(pattern, input)
  const groupCount = countCaptureGroups(pattern)

  let raw: NativeMatch[]
  try {
    raw = collectNativeMatches(regex, segments)
  } catch (e: any) {
    return { ...base('error', '匹配执行异常', e?.message || '匹配执行异常'), segments }
  }

  if (raw.length === 0) {
    const reason = perWhitespace
      ? `共 ${segments.length} 段文本，均未与正则表达式匹配。可检查锚点（^ $）、字符集或量词是否正确。`
      : '测试文本中未找到与正则表达式匹配的内容。'
    return { ...base('nomatch', reason), groupCount, segments, perWhitespace }
  }

  return { status: 'success', groupCount, segments, perWhitespace, entries: buildEntries(raw, groupCount), reason: '', errorMessage: '' }
}

/** 执行匹配：原生正则负责权威结果（含捕获组偏移），NFA 负责步骤模拟 */
function runMatch(pattern: string, input: string, nfaBuilt: ReturnType<typeof buildNFA>): MatchResult {
  const startTime = performance.now()
  const ev = evaluate(pattern, input)
  const duration = Math.round((performance.now() - startTime) * 100) / 100

  if (ev.status === 'empty') {
    return {
      ...emptyResult('empty', ev.reason === '测试文本为空'
        ? '测试文本为空，请输入需要匹配的测试文本。'
        : '正则表达式为空，请输入正则表达式后再执行。', duration),
      segmentCount: ev.perWhitespace ? ev.segments.length : 0
    }
  }
  if (ev.status === 'error') return { ...emptyResult('error', ev.reason, duration), errorMessage: ev.errorMessage }
  if (ev.status === 'nomatch') {
    return { ...emptyResult('nomatch', ev.reason, duration), segmentCount: ev.segments.length, perWhitespace: ev.perWhitespace }
  }

  const entries = ev.entries
  const { steps, backtracks } = buildSteps(nfaBuilt.states, nfaBuilt.startState, ev.segments, entries)
  const first = entries[0]

  return {
    status: 'success',
    matched: true,
    matches: entries,
    segmentCount: ev.segments.length,
    perWhitespace: ev.perWhitespace,
    matchText: first.text,
    matchStart: first.start,
    matchEnd: first.end,
    groups: first.groups.filter(g => g.participating).map(g => g.text),
    steps,
    backtracks,
    totalSteps: steps.length,
    duration,
    reason: '',
    errorMessage: ''
  }
}

/** 模板列表等入口使用的轻量标注（不构建 NFA / 步骤），与结果面板同源同结果 */
export function analyzePattern(pattern: string, input: string): Pick<MatchResult, 'status' | 'matched' | 'matches' | 'segmentCount' | 'perWhitespace' | 'reason' | 'errorMessage'> {
  const ev = evaluate(pattern, input)
  return {
    status: ev.status === 'success' ? 'success' : ev.status,
    matched: ev.status === 'success',
    matches: ev.entries,
    segmentCount: ev.segments.length,
    perWhitespace: ev.perWhitespace,
    reason: ev.reason,
    errorMessage: ev.errorMessage
  }
}

export function computeNFA(nfaResult: ReturnType<typeof buildNFA>): NFA {
  const nodes = nfaResult.states.map((s, i) => ({
    id: s.id,
    isStart: i === nfaResult.startState,
    isAccept: nfaResult.acceptStates.includes(s.id),
    x: 0, y: 0
  }))

  // Layout: circular
  const cx = 400, cy = 300, radius = 200
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2
    n.x = cx + Math.cos(angle) * radius
    n.y = cy + Math.sin(angle) * radius
  })

  const transitions: any[] = []
  nfaResult.states.forEach(s => {
    s.transitions.forEach((targets, symbol) => {
      targets.forEach(t => {
        transitions.push({ from: s.id, to: t, symbol: symbol.startsWith('__') ? symbol.replace('__', '') : symbol, label: symbol.startsWith('__') ? symbol.replace('__', '') : symbol })
      })
    })
    s.epsilonTransitions.forEach(t => {
      transitions.push({ from: s.id, to: t, symbol: null, label: 'ε' })
    })
  })

  return { states: nodes, transitions, startState: nfaResult.startState, acceptStates: nfaResult.acceptStates }
}

export function parseAST(pattern: string): ASTNode {
  let pos = 0
  let groupIdx = 0

  function parseAtom(): ASTNode {
    const ch = pattern[pos]
    if (ch === '(') {
      pos++
      if (pattern[pos] === '?') { pos++; if (pattern[pos] === ':') pos++ }
      else groupIdx++
      const node = parseOr()
      if (pattern[pos] === ')') pos++
      return { type: 'group', children: [node], groupIndex: groupIdx }
    }
    if (ch === '[') {
      pos++
      let cls = ''
      while (pos < pattern.length && pattern[pos] !== ']') { cls += pattern[pos]; pos++ }
      pos++
      return { type: 'charclass', value: cls }
    }
    if (ch === '.') { pos++; return { type: 'dot' } }
    if (ch === '\\') {
      pos++
      const e = pattern[pos]; pos++
      if (e === 'd') return { type: 'digit' }
      if (e === 'w') return { type: 'word' }
      if (e === 's') return { type: 'space' }
      return { type: 'char', value: e }
    }
    if (ch === '^' || ch === '$') { pos++; return { type: 'anchor', value: ch } }
    pos++
    return { type: 'char', value: ch }
  }

  function parseQuantifier(): ASTNode {
    let node = parseAtom()
    while (pos < pattern.length && ['*', '+', '?', '{'].includes(pattern[pos])) {
      const q = pattern[pos]
      if (q === '{') {
        while (pos < pattern.length && pattern[pos] !== '}') pos++
        pos++
      } else {
        pos++
      }
      const type = q === '*' ? 'star' : q === '+' ? 'plus' : 'question'
      node = { type, children: [node] }
      if (pos < pattern.length && pattern[pos] === '?') pos++
    }
    return node
  }

  function parseConcat(): ASTNode {
    const nodes: ASTNode[] = []
    while (pos < pattern.length && !['|', ')'].includes(pattern[pos])) {
      nodes.push(parseQuantifier())
    }
    if (nodes.length === 1) return nodes[0]
    return { type: 'concat', children: nodes }
  }

  function parseOr(): ASTNode {
    let left = parseConcat()
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++
      const right = parseConcat()
      left = { type: 'or', children: [left, right] }
    }
    return left
  }

  return parseOr()
}

export const useRegexStore = defineStore('regex', () => {
  const pattern = ref('^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\\.([a-zA-Z]{2,})$')
  const testString = ref('user@example.com admin@mail.org user@example.com invalid-email')
  const currentStep = ref(0)
  const isPlaying = ref(false)
  const nfa = ref<NFA | null>(null)
  const matchResult = ref<MatchResult | null>(null)
  const ast = ref<ASTNode | null>(null)
  const error = ref('')
  const status = ref<MatchStatus>('idle')
  const selectedTemplate = ref<string>('')
  const selectedMatchIndex = ref<number | null>(null)

  const groupColors = GROUP_COLORS
  let playTimer: ReturnType<typeof setInterval> | null = null

  function clearPlayTimer() {
    if (playTimer !== null) {
      clearInterval(playTimer)
      playTimer = null
    }
  }

  /** 当前步骤归属的片段序号（找不到时回看最近的成功片段，再看即将到来的片段） */
  const activeMatchByStep = computed(() => {
    const result = matchResult.value
    if (!result || result.matches.length === 0) return -1
    const steps = result.steps
    if (steps.length === 0) return 0
    const idx = Math.min(currentStep.value, steps.length - 1)
    if (steps[idx].matchIndex >= 0) return steps[idx].matchIndex
    for (let i = idx - 1; i >= 0; i--) {
      if (steps[i].matchIndex >= 0) return steps[i].matchIndex
    }
    for (let i = idx + 1; i < steps.length; i++) {
      if (steps[i].matchIndex >= 0) return steps[i].matchIndex
    }
    return -1
  })

  /** 当前高亮片段：优先用户选中，否则跟随当前播放步骤 */
  const activeMatchIndex = computed(() => {
    if (selectedMatchIndex.value !== null && matchResult.value) {
      if (selectedMatchIndex.value < matchResult.value.matches.length) return selectedMatchIndex.value
    }
    return activeMatchByStep.value
  })

  const activeMatch = computed<MatchEntry | null>(() => {
    const result = matchResult.value
    if (!result || activeMatchIndex.value < 0) return null
    return result.matches[activeMatchIndex.value] || null
  })

  const currentStepData = computed<MatchStep | null>(() => {
    const result = matchResult.value
    if (!result || result.steps.length === 0) return null
    return result.steps[Math.min(currentStep.value, result.steps.length - 1)]
  })

  function execute() {
    clearPlayTimer()
    isPlaying.value = false
    selectedMatchIndex.value = null
    currentStep.value = 0
    error.value = ''

    if (pattern.value.trim() === '' || testString.value === '') {
      nfa.value = null
      ast.value = null
      matchResult.value = runMatch(pattern.value, testString.value, { states: [], startState: 0, acceptStates: [] })
      status.value = matchResult.value.status
      return
    }

    try {
      const built = buildNFA(pattern.value)
      nfa.value = computeNFA(built)
      ast.value = parseAST(pattern.value)
      matchResult.value = runMatch(pattern.value, testString.value, built)
      status.value = matchResult.value.status
      if (matchResult.value.status === 'error') {
        error.value = matchResult.value.errorMessage || matchResult.value.reason
        nfa.value = null
        ast.value = null
      }
    } catch (e: any) {
      clearPlayTimer()
      const message = e?.message || '正则表达式解析错误'
      error.value = message
      status.value = 'error'
      nfa.value = null
      matchResult.value = emptyResult('error', message)
      matchResult.value.errorMessage = message
      ast.value = null
    }
  }

  function setPattern(p: string) {
    pattern.value = p
    execute()
  }

  function setTestString(s: string) {
    testString.value = s
    execute()
  }

  function applyTemplate(t: RegexTemplate) {
    pattern.value = t.pattern
    testString.value = t.testString
    selectedTemplate.value = t.name
    execute()
  }

  /** 点击某个匹配片段：选中并跳到属于该片段的第一个步骤 */
  function selectMatch(index: number) {
    const result = matchResult.value
    if (!result) return
    const entry = result.matches[index]
    if (!entry) return
    selectedMatchIndex.value = index
    const firstStep = result.steps.findIndex(s => s.matchIndex === index)
    if (firstStep >= 0) currentStep.value = firstStep
    else currentStep.value = 0
    isPlaying.value = false
    clearPlayTimer()
  }

  function stepForward() {
    selectedMatchIndex.value = null
    if (matchResult.value && currentStep.value < matchResult.value.steps.length - 1) {
      currentStep.value++
    }
  }

  function stepBackward() {
    selectedMatchIndex.value = null
    if (currentStep.value > 0) currentStep.value--
  }

  function resetStep() {
    selectedMatchIndex.value = null
    currentStep.value = 0
    isPlaying.value = false
    clearPlayTimer()
  }

  function play() {
    if (!matchResult.value || matchResult.value.steps.length === 0) return
    clearPlayTimer()
    isPlaying.value = true
    selectedMatchIndex.value = null
    playTimer = setInterval(() => {
      if (matchResult.value && currentStep.value < matchResult.value.steps.length - 1) {
        currentStep.value++
      } else {
        isPlaying.value = false
        clearPlayTimer()
      }
    }, 200)
  }

  function stop() {
    isPlaying.value = false
    clearPlayTimer()
  }

  return {
    pattern, testString, currentStep, isPlaying, nfa, matchResult, ast, error, status,
    selectedTemplate, selectedMatchIndex, groupColors,
    activeMatchIndex, activeMatch, currentStepData,
    execute, setPattern, setTestString, applyTemplate, selectMatch,
    stepForward, stepBackward, resetStep, play, stop
  }
})
