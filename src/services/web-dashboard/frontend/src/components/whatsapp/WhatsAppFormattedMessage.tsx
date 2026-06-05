import { parseWhatsAppFormattedText } from '../../lib/whatsapp-text-format'

export function WhatsAppFormattedMessage({ text }: { text: string }) {
  const segments = parseWhatsAppFormattedText(text)

  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.kind) {
          case 'bold':
            return (
              <strong key={i} className="font-semibold">
                {seg.value}
              </strong>
            )
          case 'italic':
            return (
              <em key={i} className="italic">
                {seg.value}
              </em>
            )
          case 'strike':
            return (
              <span key={i} className="line-through opacity-90">
                {seg.value}
              </span>
            )
          case 'mono':
            return (
              <code
                key={i}
                className="block my-1 px-2 py-1 rounded bg-black/25 font-mono text-[11px] whitespace-pre-wrap"
              >
                {seg.value}
              </code>
            )
          case 'monoInline':
            return (
              <code key={i} className="px-1 rounded bg-black/25 font-mono text-[11px]">
                {seg.value}
              </code>
            )
          default:
            return <span key={i}>{seg.value}</span>
        }
      })}
    </>
  )
}
