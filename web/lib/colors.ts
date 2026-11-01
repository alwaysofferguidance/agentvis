/**
 * Holographic color palette and role color definitions.
 *
 * Extracted from agent-types.ts to keep that file focused on type definitions.
 * All colors are re-exported from agent-types.ts for backward compatibility.
 */

import type { AgentState, ContextBreakdown } from './agent-types'

// Neutral observatory palette with semantic status accents.
export const COLORS = {
  // Background
  void: '#0b0d10',
  hexGrid: '#1b2025',

  // Primary Hologram
  holoBase: '#aeb9c1',
  holoBright: '#e8edf0',
  holoHot: '#ffffff',

  // Agent States
  idle: '#9ba5ad',
  thinking: '#8eaaa9',
  tool_calling: '#d5aa65',
  complete: '#86b89a',
  error: '#dc777e',
  paused: '#888899',
  waiting_permission: '#d5aa65',

  // Edge/Particle Colors
  dispatch: '#b69cca',
  return: '#86b89a',
  tool: '#d5aa65',
  message: '#aeb9c1',

  // Context breakdown colors
  contextSystem: '#7c848b',     // neutral gray — fixed overhead
  contextUser: '#aeb9c1',       // neutral silver — user input
  contextToolResults: '#d5aa65', // amber — expensive!
  contextReasoning: '#b69cca',  // purple — agent thinking
  contextSubagent: '#86b89a',   // green — child agent results

  // UI Chrome
  nodeInterior: 'rgba(16, 19, 22, 0.62)',
  textPrimary: '#e6eaed',
  textDim: '#aeb6bc',
  textMuted: '#929ba2',

  // Glass card
  glassBg: 'rgba(18, 21, 24, 0.82)',
  glassBorder: 'rgba(190, 199, 206, 0.16)',
  glassHighlight: 'rgba(220, 226, 230, 0.035)',

  // Holo background/border opacities (avoids scattered rgba literals)
  holoBg03: 'rgba(190, 199, 206, 0.025)',
  holoBg05: 'rgba(190, 199, 206, 0.04)',
  holoBg10: 'rgba(190, 199, 206, 0.075)',
  holoBorder06: 'rgba(190, 199, 206, 0.055)',
  holoBorder08: 'rgba(190, 199, 206, 0.07)',
  holoBorder10: 'rgba(190, 199, 206, 0.09)',
  holoBorder12: 'rgba(190, 199, 206, 0.11)',

  // Panel chrome
  panelBg: 'rgba(15, 18, 21, 0.9)',
  panelSeparator: 'rgba(190, 199, 206, 0.075)',

  // Toggle button states
  toggleActive: 'rgba(190, 199, 206, 0.13)',
  toggleInactive: 'rgba(190, 199, 206, 0.035)',
  toggleBorder: 'rgba(190, 199, 206, 0.16)',

  // Live indicator
  liveDot: '#dc777e',
  liveText: '#dc777e',
  liveResumeBg: 'rgba(220, 119, 126, 0.12)',
  liveResumeBorder: 'rgba(220, 119, 126, 0.3)',

  // Discovery type colors
  discoveryFile: '#aeb9c1',
  discoveryPattern: '#b69fbd',
  discoveryFinding: '#83b69a',
  discoveryCode: '#d8aa61',

  // Session tab states
  tabSelectedBg: 'rgba(190, 199, 206, 0.11)',
  tabInactiveBg: 'rgba(190, 199, 206, 0.02)',
  tabSelectedBorder: 'rgba(190, 199, 206, 0.29)',
  tabInactiveBorder: 'rgba(190, 199, 206, 0.075)',
  tabClose: '#d78790',

  // Role colors (message bubbles)
  roleAssistantBg: 'rgba(174, 185, 193, 0.1)',
  roleAssistantBgSelected: 'rgba(174, 185, 193, 0.16)',
  roleAssistantText: '#d5dce1',
  roleThinkingBg: 'rgba(182, 159, 189, 0.1)',
  roleThinkingBgSelected: 'rgba(182, 159, 189, 0.16)',
  roleThinkingText: '#c8b2d2',
  roleUserBg: 'rgba(200, 160, 80, 0.12)',
  roleUserBgSelected: 'rgba(200, 160, 80, 0.2)',
  roleUserText: '#e0c888',

  // Result/success
  resultBg: 'rgba(134, 184, 154, 0.055)',
  resultBorder: 'rgba(134, 184, 154, 0.12)',

  // Unread indicator
  unreadDot: '#dc777e',

  // Play button
  playBtnBg: 'rgba(190, 199, 206, 0.09)',
  playBtnActiveBg: 'rgba(190, 199, 206, 0.15)',
  playBtnBorder: 'rgba(190, 199, 206, 0.28)',
  playBtnGlow: '0 0 8px rgba(190, 199, 206, 0.08)',

  // Scrubber
  scrubberFill: 'linear-gradient(90deg, rgba(190,199,206,0.28), rgba(190,199,206,0.58))',
  scrubberHeadGlow: '0 0 8px rgba(190, 199, 206, 0.28), 0 0 14px rgba(190, 199, 206, 0.1)',
  reviewBtnBorder: 'rgba(190, 199, 206, 0.23)',

  // Cost overlay
  costActiveBg: 'rgba(134, 184, 154, 0.12)',

  // Canvas drawing — bubble base colors (partial rgba, alpha appended at draw time)
  bubbleThinkingBase: 'rgba(140, 100, 200,',
  bubbleUserBase: 'rgba(200, 160, 80,',
  bubbleAssistantBase: 'rgba(174, 185, 193,',

  // Canvas drawing — tool card backgrounds (partial rgba, alpha appended at draw time)
  toolCardErrorBase: 'rgba(40, 10, 15,',
  toolCardSelectedBase: 'rgba(174, 185, 193,',
  toolCardBase: 'rgba(17, 20, 23,',

  // Canvas drawing — agent/tool card backgrounds
  cardBgDark: 'rgba(11, 13, 16, 0.9)',
  cardBg: 'rgba(17, 20, 23, 0.82)',
  cardBgSelected: 'rgba(24, 28, 32, 0.94)',
  cardBgError: 'rgba(40, 10, 15, 0.8)',
  cardBgSelectedHolo: 'rgba(174, 185, 193, 0.12)',
  cardBgFaintOverlay: 'rgba(0, 0, 0, 0.01)',

  // Active tool indicator (detail card)
  toolIndicatorBg: 'rgba(255, 187, 68, 0.1)',
  toolIndicatorBorder: 'rgba(255, 187, 68, 0.2)',
  toolIndicatorText: '#d5aa65',

  // Canvas drawing — cost labels
  costText: '#9bc4aa',
  costTextDim: '#9bc4aa80',
  costPillBg: 'rgba(18, 21, 24, 0.88)',
  costPillStroke: 'rgba(134, 184, 154, 0.28)',

  // Canvas drawing — cost panel bar fills
  barFillMain: 'rgba(174, 185, 193, 0.14)',
  barFillSub: 'rgba(182, 159, 189, 0.14)',

  // ─── Transcript / message feed colors ───────────────────────────────────────

  // User messages
  userMsgBg: 'rgba(255, 187, 68, 0.06)',
  userMsgBorder: 'rgba(255, 187, 68, 0.12)',
  userLabel: '#ffbb4490',
  userText: '#d5aa65',

  // Assistant messages
  assistantLabel: '#b8c2c9',
  assistantText: '#dce2e6',

  // Thinking messages
  thinkingBgExpanded: 'rgba(182, 159, 189, 0.055)',
  thinkingBgCollapsed: 'rgba(182, 159, 189, 0.03)',
  thinkingBorder: 'rgba(182, 159, 189, 0.09)',
  thinkingLabel: '#b69cca70',
  thinkingArrow: '#b69cca55',
  thinkingPreview: '#b69cca',
  thinkingTextExpanded: '#b69cca80',
  thinkingBorderLeft: 'rgba(182, 159, 189, 0.15)',

  // Tool call messages
  toolCallBg: 'rgba(255, 187, 68, 0.05)',
  toolCallBorder: 'rgba(255, 187, 68, 0.1)',

  // Tool result messages
  bashResultBg: 'rgba(0,0,0,0.25)',
  toolResultBg: 'rgba(134, 184, 154, 0.045)',
  bashResultBorder: 'rgba(255, 187, 68, 0.1)',
  toolResultBorder: 'rgba(134, 184, 154, 0.1)',
  bashResultText: '#c3cbd080',
  toolResultText: '#9bc4aa',
  textFaint: '#b8c1c860',

  // Search highlight
  searchHighlightBg: 'rgba(255,187,68,0.3)',

  // ─── Diff / code block colors ───────────────────────────────────────────────

  codeBlockBg: 'rgba(0,0,0,0.3)',
  diffRemoved: '#dc777e',
  diffRemovedBg: 'rgba(220,119,126,0.08)',
  diffAdded: '#86b89a',
  diffAddedBg: 'rgba(134,184,154,0.08)',

  // ─── Tool content colors ────────────────────────────────────────────────────

  filePathActive: '#c0c9cf',
  filePathInactive: '#aeb9c190',
  todoCompleted: '#86b89a',
  todoCompletedText: '#86b89a90',
  todoPending: '#aeb9c160',
  contentDim: '#c3cbd090',
  searchIcon: '#aeb9c160',

  // ─── Panel header / chrome text ─────────────────────────────────────────────

  panelLabel: '#c0c9cf',
  panelLabelDim: '#9ba5ad',
  scrollBtnText: '#d1d7dc',
  scrollbarThumb: 'rgba(190, 199, 206, 0.2)',
} as const

// ─── Role Colors (message feed & bubbles) ───────────────────────────────────

export const ROLE_COLORS: Record<string, { bg: string; bgSelected: string; text: string; label: string }> = {
  assistant: { bg: COLORS.roleAssistantBg, bgSelected: COLORS.roleAssistantBgSelected, text: COLORS.roleAssistantText, label: 'CLAUDE' },
  thinking:  { bg: COLORS.roleThinkingBg,  bgSelected: COLORS.roleThinkingBgSelected,  text: COLORS.roleThinkingText,  label: 'THINKING' },
  user:      { bg: COLORS.roleUserBg,       bgSelected: COLORS.roleUserBgSelected,       text: COLORS.roleUserText,       label: 'USER' },
} as const

// ─── Color Helper Functions ──────────────────────────────────────────────────

export function getStateColor(state: AgentState): string {
  switch (state) {
    case 'idle': return COLORS.idle
    case 'thinking': return COLORS.thinking
    case 'tool_calling': return COLORS.tool_calling
    case 'complete': return COLORS.complete
    case 'error': return COLORS.error
    case 'paused': return COLORS.paused
    case 'waiting_permission': return COLORS.waiting_permission
  }
}

export function getDiscoveryTypeColor(type: string): string {
  switch (type) {
    case 'file': return COLORS.discoveryFile
    case 'pattern': return COLORS.discoveryPattern
    case 'finding': return COLORS.discoveryFinding
    default: return COLORS.discoveryCode
  }
}

/** Safely combine a partial rgba base (e.g. 'rgba(10, 15, 30,') with an alpha value */
export function withAlpha(rgbaBase: string, alpha: number): string {
  return `${rgbaBase} ${alpha})`
}

/** Build the context-breakdown color segments for a given breakdown. */
export function contextSegments(bd: ContextBreakdown) {
  return [
    { value: bd.systemPrompt, color: COLORS.contextSystem },
    { value: bd.userMessages, color: COLORS.contextUser },
    { value: bd.toolResults, color: COLORS.contextToolResults },
    { value: bd.reasoning, color: COLORS.contextReasoning },
    { value: bd.subagentResults, color: COLORS.contextSubagent },
  ]
}
