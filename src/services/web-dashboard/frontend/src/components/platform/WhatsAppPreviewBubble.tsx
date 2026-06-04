export function WhatsAppPreviewBubble({ text }: { text: string }) {
  return (
    <div className="rounded-2xl rounded-tl-sm bg-[#005c4b] text-[#e9edef] text-xs leading-relaxed px-3 py-2 shadow-lg max-w-full whitespace-pre-wrap break-words border border-[#0a7a62]/40">
      {text || '…'}
      <p className="text-[10px] text-right text-[#99beb3] mt-1 opacity-80">agora ✓✓</p>
    </div>
  )
}
