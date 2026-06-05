import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Upload, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { MAX_STATUS_IMAGE_BYTES, validateImageFileClient } from '../../lib/safe-image-upload'

interface Props {
  preview: string | null
  onChange: (dataUrl: string | null, preview: string | null) => void
  onError?: (message: string) => void
}

export function StatusImageUpload({ preview, onChange, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      setLoading(true)
      try {
        const result = await validateImageFileClient(file)
        if (result.ok === false) {
          onError?.(result.error)
          return
        }
        onChange(result.dataUrl, result.dataUrl)
      } finally {
        setLoading(false)
      }
    },
    [onChange, onError],
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  const maxMb = MAX_STATUS_IMAGE_BYTES / (1024 * 1024)

  if (preview) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-gray-700 bg-gray-900">
        <img src={preview} alt="Prévia" className="w-full max-h-48 object-contain bg-black/40" />
        <div className="absolute top-2 right-2 flex gap-1">
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            Trocar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => onChange(null, null)}
            aria-label="Remover imagem"
          >
            <X size={14} />
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => void handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      onDragOver={e => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
        dragOver
          ? 'border-brand-400 bg-brand-950/30'
          : 'border-gray-600 hover:border-brand-500/70 hover:bg-gray-800/50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => void handleFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex flex-col items-center gap-3 pointer-events-none">
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
          {loading ? (
            <Upload size={22} className="text-brand-400 animate-pulse" />
          ) : (
            <ImagePlus size={22} className="text-brand-400" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-200">Clique ou arraste a imagem aqui</p>
          <p className="text-xs text-gray-500 mt-1">JPEG, PNG ou WebP · máx. {maxMb} MB</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-brand-400 font-medium">
          <Upload size={14} /> Selecionar imagem
        </span>
      </div>
    </div>
  )
}
