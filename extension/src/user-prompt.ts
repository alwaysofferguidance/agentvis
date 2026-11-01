/**
 * Remove recognized leading IDE scaffolding from a user turn.
 *
 * Only anchored, structural wrappers are stripped. Ordinary text that merely
 * mentions AGENTS.md or instruction tags is returned unchanged.
 */
export function extractUserPromptText(raw: string): string | null {
  let text = raw.replace(/^\uFEFF/, '').trim()
  if (!text) return null
  const originalText = text

  const agentsHeader = text.match(/^# AGENTS\.md instructions(?:[ \t]+for\b[^\r\n]*)?[ \t]*\r?\n/i)
  if (agentsHeader) {
    const pathQualified = /[ \t]+for\b/i.test(agentsHeader[0])
    text = text.slice(agentsHeader[0].length).trimStart()

    // Modern scaffold has explicit instruction boundaries, allowing a real
    // prompt after the injected blocks to survive.
    const instructionOpen = text.match(/^<INSTRUCTIONS>\s*/i)
    if (!instructionOpen) return pathQualified ? null : originalText
    const closeIndex = text.search(/<\/INSTRUCTIONS>/i)
    if (closeIndex < 0) return null // Incomplete scaffold; no safe boundary.
    const close = text.match(/<\/INSTRUCTIONS>/i)!
    text = text.slice(closeIndex + close[0].length).trimStart()
  }

  // Environment metadata can stand alone or immediately follow AGENTS rules.
  if (/^<environment_context>/i.test(text)) {
    const closeIndex = text.search(/<\/environment_context>/i)
    if (closeIndex < 0) return text
    const close = text.match(/<\/environment_context>/i)!
    const block = text.slice(0, closeIndex)
    // Avoid treating a user-quoted tag as metadata unless it contains a known
    // environment field. The normal runtime wrapper includes cwd.
    if (/<(?:cwd|shell|current_date|timezone|os)>/i.test(block)) {
      text = text.slice(closeIndex + close[0].length).trimStart()
    }
  }

  return text.trim() || null
}
