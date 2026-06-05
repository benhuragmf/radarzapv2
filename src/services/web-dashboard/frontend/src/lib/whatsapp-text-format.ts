export type WaTextFormat = 'bold' | 'italic' | 'strikethrough' | 'monospace' | 'monoInline'

export const WA_TEXT_FORMAT_HINT =
  'WhatsApp: *negrito* · _itálico_ · ~tachado~ · `mono` · ```bloco mono```'

const MARKERS: Record<
  WaTextFormat,
  { open: string; close: string; placeholder: string }
> = {
  bold: { open: '*', close: '*', placeholder: 'negrito' },
  italic: { open: '_', close: '_', placeholder: 'itálico' },
  strikethrough: { open: '~', close: '~', placeholder: 'tachado' },
  monoInline: { open: '`', close: '`', placeholder: 'mono' },
  monospace: { open: '```', close: '```', placeholder: 'texto mono' },
}

export function applyWhatsAppFormat(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  format: WaTextFormat,
): { value: string; selectionStart: number; selectionEnd: number } {
  const m = MARKERS[format]
  const start = Math.max(0, Math.min(selectionStart, text.length))
  const end = Math.max(start, Math.min(selectionEnd, text.length))
  const selected = text.slice(start, end)
  const inner = selected || m.placeholder
  const wrapped = `${m.open}${inner}${m.close}`
  const value = text.slice(0, start) + wrapped + text.slice(end)
  const cursorStart = start + m.open.length
  const cursorEnd = cursorStart + inner.length
  return { value, selectionStart: cursorStart, selectionEnd: cursorEnd }
}

export function insertTextAtCursor(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  insert: string,
): { value: string; selectionStart: number; selectionEnd: number } {
  const start = Math.max(0, Math.min(selectionStart, text.length))
  const end = Math.max(start, Math.min(selectionEnd, text.length))
  const value = text.slice(0, start) + insert + text.slice(end)
  const pos = start + insert.length
  return { value, selectionStart: pos, selectionEnd: pos }
}

/** Prefixa linhas selecionadas (ou linha atual) com marcador de lista WA. */
export function applyWhatsAppBulletList(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): { value: string; selectionStart: number; selectionEnd: number } {
  const start = Math.max(0, Math.min(selectionStart, text.length))
  const end = Math.max(start, Math.min(selectionEnd, text.length))

  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const lineEndRaw = text.indexOf('\n', end)
  const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw
  const block = text.slice(lineStart, lineEnd)

  const lines = block.split('\n')
  const prefixed = lines
    .map(line => {
      const trimmed = line.trimStart()
      if (!trimmed) return line
      if (/^[-•*]\s/.test(trimmed)) return line
      const lead = line.slice(0, line.length - trimmed.length)
      return `${lead}• ${trimmed}`
    })
    .join('\n')

  const value = text.slice(0, lineStart) + prefixed + text.slice(lineEnd)
  const delta = prefixed.length - block.length
  return {
    value,
    selectionStart: start,
    selectionEnd: end + delta,
  }
}

export type WaFormattedSegment =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'strike'; value: string }
  | { kind: 'mono'; value: string }
  | { kind: 'monoInline'; value: string }

const WA_TOKEN_RE =
  /(\*[^*\n]+?\*|_[^_\n]+?_|~[^~\n]+?~|```[\s\S]+?```|`[^`\n]+?`)/g

export function parseWhatsAppFormattedText(text: string): WaFormattedSegment[] {
  if (!text) return [{ kind: 'text', value: '' }]

  const segments: WaFormattedSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  WA_TOKEN_RE.lastIndex = 0
  while ((match = WA_TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, match.index) })
    }

    const token = match[0]
    if (token.startsWith('```')) {
      segments.push({ kind: 'mono', value: token.slice(3, -3) })
    } else if (token.startsWith('`')) {
      segments.push({ kind: 'monoInline', value: token.slice(1, -1) })
    } else if (token.startsWith('*')) {
      segments.push({ kind: 'bold', value: token.slice(1, -1) })
    } else if (token.startsWith('_')) {
      segments.push({ kind: 'italic', value: token.slice(1, -1) })
    } else if (token.startsWith('~')) {
      segments.push({ kind: 'strike', value: token.slice(1, -1) })
    }

    lastIndex = WA_TOKEN_RE.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ kind: 'text', value: text }]
}
