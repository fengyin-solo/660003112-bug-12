export interface NFAState {
  id: number
  isStart: boolean
  isAccept: boolean
  x: number
  y: number
}

export interface NFATransition {
  from: number
  to: number
  symbol: string | null // null = epsilon
  label: string
}

export interface NFA {
  states: NFAState[]
  transitions: NFATransition[]
  startState: number
  acceptStates: number[]
}

export interface MatchStep {
  stepIndex: number
  charIndex: number
  char: string
  currentState: number
  nextState: number
  transition: string
  isBacktrack: boolean
  isMatch: boolean
  attemptStart: number // 本次尝试在测试文本中的起始位置
  matchIndex: number // 该步骤所属的匹配片段序号，-1 表示不属于任何成功片段
}

/** 单个捕获组在某次匹配中的信息 */
export interface GroupCapture {
  index: number // 捕获组编号，从 1 开始
  name: string | null // 命名分组名
  text: string // 捕获文本，未参与匹配时为 ''
  start: number // 全局偏移，未参与匹配时为 -1
  end: number
  participating: boolean
}

/** 测试文本中的一处匹配片段（多段匹配时会有多个） */
export interface MatchEntry {
  index: number // 全文中的片段序号，从 0 开始
  segment: number // 所属空白分段序号，从 0 开始
  start: number // 全局起始偏移
  end: number // 全局结束偏移（不含）
  text: string
  groups: GroupCapture[]
}

// idle: 尚未执行；empty: 正则或测试文本为空；success: 有匹配；
// nomatch: 执行成功但无结果；error: 正则非法 / 执行异常
export type MatchStatus = 'idle' | 'empty' | 'success' | 'nomatch' | 'error'

export interface MatchResult {
  status: MatchStatus
  matched: boolean
  matches: MatchEntry[]
  segmentCount: number
  /** true: 按空白分段锚定（^/$ 模式）；false: 全文全局匹配 */
  perWhitespace: boolean
  matchText: string // 首个片段文本（兼容统计面板）
  matchStart: number
  matchEnd: number
  groups: string[] // 当前片段分组文本（兼容旧字段）
  steps: MatchStep[]
  backtracks: number
  totalSteps: number
  duration: number
  reason: string // 无结果 / 失败原因说明
  errorMessage: string
}

export interface RegexTemplate {
  name: string
  pattern: string
  description: string
  testString: string
  category: string
}

export interface ASTNode {
  type: 'char' | 'star' | 'plus' | 'question' | 'or' | 'concat' | 'group' | 'dot' | 'anchor' | 'charclass' | 'digit' | 'word' | 'space'
  value?: string
  children?: ASTNode[]
  groupIndex?: number
}
