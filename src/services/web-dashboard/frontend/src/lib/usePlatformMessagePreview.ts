import { useEffect, useState } from 'react'
import { api } from './api'

type MessageMode = 'platform_template' | 'plain'

export interface PlatformMessagePreviewOptions {
  enabled?: boolean
  messageMode: MessageMode
  templateName?: string
  customMessage?: string
  mensagemExtra?: string
  destinationId?: string | null
}

export function usePlatformMessagePreview({
  enabled = true,
  messageMode,
  templateName,
  customMessage = '',
  mensagemExtra = '',
  destinationId,
}: PlatformMessagePreviewOptions) {
  const [previewText, setPreviewText] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewSource, setPreviewSource] = useState<'destination' | 'tenant'>('tenant')

  useEffect(() => {
    if (!enabled) {
      setPreviewText('')
      setPreviewLoading(false)
      return
    }

    const hasTemplate = messageMode === 'platform_template' && !!templateName?.trim()
    const hasPlain = messageMode === 'plain' && !!customMessage.trim()
    if (!hasTemplate && !hasPlain) {
      setPreviewText('')
      setPreviewLoading(false)
      return
    }

    const t = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const body: Record<string, string | undefined> = {
          destinationId: destinationId ?? undefined,
          mensagem: mensagemExtra.trim() || undefined,
        }
        if (messageMode === 'platform_template') {
          body.name = templateName
        } else {
          body.content = customMessage.trim()
        }
        const res = await api.post<{
          preview: string
          sampleSource?: 'destination' | 'tenant'
        }>('/platform/templates/preview', body)
        setPreviewText(res.preview || '')
        setPreviewSource(res.sampleSource === 'destination' ? 'destination' : 'tenant')
      } catch {
        setPreviewText('')
      } finally {
        setPreviewLoading(false)
      }
    }, 400)

    return () => clearTimeout(t)
  }, [
    enabled,
    messageMode,
    templateName,
    customMessage,
    mensagemExtra,
    destinationId,
  ])

  return { previewText, previewLoading, previewSource }
}
