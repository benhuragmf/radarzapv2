import { useState, useRef } from 'react'

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'

import { PlatformPage } from '../../components/platform/PlatformPage'

import { Link, useSearchParams } from 'react-router-dom'

import { api, downloadFile } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, ListOrdered } from 'lucide-react'

type ExportProfile = 'radarzap-native' | 'google-compatible' | 'apple-compatible'

const EXPORT_PROFILES: { id: ExportProfile; label: string }[] = [
  { id: 'radarzap-native', label: 'RadarZap (nativo)' },
  { id: 'google-compatible', label: 'Google / Android' },
  { id: 'apple-compatible', label: 'Apple / iOS' },
]

import { getMe, can, type AuthUser } from '../../lib/auth'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'

interface CanonicalPreviewRow {

  nome: string

  telefone: string

  aniversario?: string

  grupos?: string[]

  email?: string

  empresa?: string

  telefoneSecundario?: string

  tipoTelefone?: string

  notas?: string

}



type ImportFileFormat = 'csv' | 'vcf'

interface ImportCsvResponse {

  success: boolean

  format: ImportFileFormat

  profile: string

  preview: CanonicalPreviewRow[]

  totalLinhasDados: number

  report: {

    criados: number

    atualizados: number

    ignorados: number

    erros: Array<{ linha: number; motivo: string }>

  }

}

function detectLocalFormat(text: string): ImportFileFormat {
  return /BEGIN:VCARD/i.test(text.trim()) ? 'vcf' : 'csv'
}



interface ContactGroupOption {
  _id: string
  name: string
  memberCount: number
}

interface ImportPayload {
  text: string
  format: ImportFileFormat
  contactGroupIds?: string[]
  mapGruposToSegments?: boolean
}

export default function PlatformContacts() {

  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const preselectedSegment = searchParams.get('segment') ?? ''

  const fileRef = useRef<HTMLInputElement>(null)

  const [fileText, setFileText] = useState<string | null>(null)

  const [fileName, setFileName] = useState<string | null>(null)

  const [fileFormat, setFileFormat] = useState<ImportFileFormat | null>(null)

  const [preview, setPreview] = useState<ImportCsvResponse | null>(null)

  const [importResult, setImportResult] = useState<ImportCsvResponse | null>(null)
  const [exporting, setExporting] = useState<ExportProfile | null>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(
    preselectedSegment ? [preselectedSegment] : [],
  )
  const [mapGruposToSegments, setMapGruposToSegments] = useState(false)



  const { data: me } = useQuery<AuthUser | null>({

    queryKey: ['auth-me'],

    queryFn: getMe,

  })

  const canManage = can(me ?? null, 'send:destination:manage')

  const { data: contactGroups = [] } = useQuery<ContactGroupOption[]>({
    queryKey: ['contact-groups'],
    queryFn: () => api.get('/contact-groups'),
    enabled: canManage,
  })

  const buildImportBody = (payload: ImportPayload, dryRun: boolean) => ({
    content: payload.text,
    format: payload.format,
    dryRun,
    contactGroupIds: payload.contactGroupIds?.length ? payload.contactGroupIds : undefined,
    mapGruposToSegments: payload.mapGruposToSegments === true,
  })

  const previewMutation = useMutation({

    mutationFn: (payload: ImportPayload) =>

      api.post<ImportCsvResponse>('/destinations/import-csv', buildImportBody(payload, true)),

    onSuccess: (data) => {

      setPreview(data)

      setImportResult(null)

    },

    onError: mutationError,

  })



  const importMutation = useMutation({

    mutationFn: (payload: ImportPayload) =>

      api.post<ImportCsvResponse>('/destinations/import-csv', buildImportBody(payload, false)),

    onSuccess: (data) => {

      setImportResult(data)

      qc.invalidateQueries({ queryKey: ['destinations'] })
      qc.invalidateQueries({ queryKey: ['contact-groups'] })

    },

    onError: mutationError,

  })



  const onFile = (file: File | undefined) => {

    if (!file) return

    const reader = new FileReader()

    reader.onload = () => {

      const text = String(reader.result ?? '')

      const format = detectLocalFormat(text)

      setFileText(text)

      setFileName(file.name)

      setFileFormat(format)

      setPreview(null)

      setImportResult(null)

      previewMutation.mutate({
        text,
        format,
        contactGroupIds: selectedGroupIds,
        mapGruposToSegments,
      })

    }

    reader.readAsText(file, 'UTF-8')

  }



  return (

    <PlatformPage

      title="Contatos (Plataforma)"

      description="Importe e exporte contatos via CSV ou vCard (.vcf). Revise a pré-visualização antes de confirmar o import."

      phase="Fase 3"

    >

      <p className="text-sm text-[var(--rz-text-muted)]">

        Especificação:{' '}

        <code className="text-[var(--rz-text-muted)]">docs/CONTATOS-CSV-IMPORTACAO.md</code>

        {' · '}

        <Link to="/contact" className="text-brand-400 hover:underline">

          Contatos atuais (Destinos) →

        </Link>

        {' · '}

        <Link to="/platform/segmentos" className="text-brand-400 hover:underline">

          Segmentos / Listas →

        </Link>

      </p>



      <Card className="space-y-3 border-[var(--rz-border)]/80">
        <p className="text-sm text-[var(--rz-text-secondary)] font-medium">Exportar contatos</p>
        <p className="text-xs text-[var(--rz-text-muted)]">
          UTF-8 com BOM para Excel. Apenas contatos ativos do tipo telefone.
        </p>
        <div className="flex flex-wrap gap-2">
          {EXPORT_PROFILES.map(({ id, label }) => (
            <Button
              key={id}
              type="button"
              variant="secondary"
              disabled={exporting !== null}
              onClick={async () => {
                setExporting(id)
                try {
                  await downloadFile(
                    `/destinations/export-csv?profile=${encodeURIComponent(id)}`,
                    `contatos-${id}.csv`,
                  )
                } catch (err) {
                  notifyError((err as Error).message)
                } finally {
                  setExporting(null)
                }
              }}
            >
              <Download size={14} className="mr-1.5" />
              {exporting === id ? 'Baixando…' : label}
            </Button>
          ))}
        </div>
      </Card>

      {!canManage && (

        <Card className="flex items-start gap-3 border-amber-700/40 bg-amber-950/20">

          <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={20} />

          <p className="text-sm text-amber-200/90">

            Você não tem permissão para importar contatos. Peça a um administrador da empresa.

          </p>

        </Card>

      )}



      {canManage && (

        <Card className="space-y-4 border-[var(--rz-border)]/80">

          <div className="space-y-3 pb-3 border-b border-[var(--rz-border)]">
            <p className="text-sm text-[var(--rz-text-secondary)] font-medium flex items-center gap-2">
              <ListOrdered size={16} className="text-brand-400" />
              Segmentos na importação
            </p>
            <p className="text-xs text-[var(--rz-text-muted)]">
              Opcional: coloque todos os contatos do arquivo em um ou mais segmentos. A coluna{' '}
              <code className="text-[var(--rz-text-muted)]">grupos</code> do CSV também pode virar segmento automaticamente.
            </p>
            {contactGroups.length === 0 ? (
              <p className="text-xs text-[var(--rz-text-muted)]">
                Nenhum segmento ainda.{' '}
                <Link to="/platform/segmentos" className="text-brand-400 hover:underline">
                  Criar segmento
                </Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                {contactGroups.map(g => {
                  const on = selectedGroupIds.includes(g._id)
                  return (
                    <button
                      key={g._id}
                      type="button"
                      onClick={() =>
                        setSelectedGroupIds(prev =>
                          on ? prev.filter(id => id !== g._id) : [...prev, g._id],
                        )
                      }
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        on
                          ? 'border-brand-500 bg-brand-600/20 text-brand-300'
                          : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-[var(--rz-border)]'
                      }`}
                    >
                      {g.name} ({g.memberCount})
                    </button>
                  )
                })}
              </div>
            )}
            {selectedGroupIds.length > 0 && (
              <button
                type="button"
                className="text-xs text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)]"
                onClick={() => setSelectedGroupIds([])}
              >
                Limpar seleção de segmentos
              </button>
            )}
            <label className="flex items-start gap-2 text-xs text-[var(--rz-text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={mapGruposToSegments}
                onChange={e => setMapGruposToSegments(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Usar coluna <strong className="text-[var(--rz-text-secondary)]">Grupos</strong> do arquivo para criar ou
                vincular segmentos (ex.: Google Group Membership, coluna grupos no CSV RadarZap)
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">

            <input

              ref={fileRef}

              type="file"

              accept=".csv,.vcf,text/csv,text/vcard,text/x-vcard"

              className="hidden"

              onChange={(e) => onFile(e.target.files?.[0])}

            />

            <Button

              type="button"

              variant="secondary"

              onClick={() => fileRef.current?.click()}

              disabled={previewMutation.isPending || importMutation.isPending}

            >

              <Upload size={16} className="mr-2" />

              Escolher CSV ou VCF

            </Button>

            {fileName && (

              <span className="text-sm text-[var(--rz-text-muted)] flex items-center gap-2">

                <FileSpreadsheet size={14} />

                {fileName}

                {fileFormat && (

                  <span className="text-xs uppercase tracking-wide text-brand-400/90">

                    {fileFormat}

                  </span>

                )}

              </span>

            )}

          </div>



          {previewMutation.isPending && (

            <p className="text-sm text-[var(--rz-text-muted)]">Analisando arquivo…</p>

          )}



          {preview && (

            <div className="space-y-3">

              <p className="text-sm text-[var(--rz-text-secondary)]">

                Formato:{' '}

                <span className="text-brand-400 font-medium uppercase">{preview.format}</span>

                {' · '}

                Perfil:{' '}

                <span className="text-brand-400 font-medium">{preview.profile}</span>

                {' · '}

                {preview.format === 'vcf'
                  ? `${preview.totalLinhasDados} contato(s) no arquivo`
                  : `${preview.totalLinhasDados} linha(s) de dados`}

                {preview.report.erros.length > 0 && (

                  <span className="text-amber-400">

                    {' '}

                    · {preview.report.erros.length} aviso(s)/erro(s)

                  </span>

                )}

              </p>



              {preview.preview.length > 0 && (

                <div className="overflow-x-auto rounded-lg border border-[var(--rz-border)]/80">

                  <table className="w-full text-xs text-left">

                    <thead className="bg-[var(--rz-surface-muted)]/80 text-[var(--rz-text-muted)]">

                      <tr>

                        <th className="px-3 py-2">Nome</th>

                        <th className="px-3 py-2">Telefone</th>

                        <th className="px-3 py-2">Tipo</th>

                        <th className="px-3 py-2">2º tel.</th>

                        <th className="px-3 py-2">Empresa</th>

                        <th className="px-3 py-2">E-mail</th>

                        <th className="px-3 py-2">Aniversário</th>

                        <th className="px-3 py-2">Grupos</th>

                        <th className="px-3 py-2">Notas</th>

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-[var(--rz-border)]">

                      {preview.preview.map((row, i) => (

                        <tr key={i} className="text-[var(--rz-text-secondary)]">

                          <td className="px-3 py-2">{row.nome}</td>

                          <td className="px-3 py-2 font-mono whitespace-nowrap">{row.telefone}</td>

                          <td className="px-3 py-2">{row.tipoTelefone ?? '—'}</td>

                          <td className="px-3 py-2 font-mono whitespace-nowrap">
                            {row.telefoneSecundario ?? '—'}
                          </td>

                          <td className="px-3 py-2 max-w-[120px] truncate" title={row.empresa}>
                            {row.empresa ?? '—'}
                          </td>

                          <td className="px-3 py-2">{row.email ?? '—'}</td>

                          <td className="px-3 py-2">{row.aniversario ?? '—'}</td>

                          <td className="px-3 py-2">{row.grupos?.join('; ') ?? '—'}</td>

                          <td className="px-3 py-2 max-w-[100px] truncate" title={row.notas}>
                            {row.notas ?? '—'}
                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                  <p className="text-xs text-[var(--rz-text-muted)] px-3 py-2">Pré-visualização (até 5 linhas)</p>

                </div>

              )}



              {preview.report.erros.length > 0 && (

                <ul className="text-xs text-amber-300/90 space-y-1 max-h-32 overflow-y-auto">

                  {preview.report.erros.slice(0, 10).map((e, i) => (

                    <li key={i}>

                      {e.linha > 0 ? `Linha ${e.linha}: ` : ''}

                      {e.motivo}

                    </li>

                  ))}

                  {preview.report.erros.length > 10 && (

                    <li>… e mais {preview.report.erros.length - 10}</li>

                  )}

                </ul>

              )}



              {(selectedGroupIds.length > 0 || mapGruposToSegments) && (
                <p className="text-xs text-brand-400/90">
                  Na confirmação:{' '}
                  {selectedGroupIds.length > 0 &&
                    `${selectedGroupIds.length} segmento(s) fixo(s)`}
                  {selectedGroupIds.length > 0 && mapGruposToSegments && ' · '}
                  {mapGruposToSegments && 'segmentos pela coluna Grupos do arquivo'}
                </p>
              )}

              <Button

                type="button"

                onClick={() =>
                  fileText &&
                  fileFormat &&
                  importMutation.mutate({
                    text: fileText,
                    format: fileFormat,
                    contactGroupIds: selectedGroupIds,
                    mapGruposToSegments,
                  })
                }

                disabled={!fileText || !fileFormat || importMutation.isPending}

              >

                {importMutation.isPending ? 'Importando…' : 'Confirmar importação'}

              </Button>

            </div>

          )}



          {importResult && (

            <Card className="flex items-start gap-3 border-emerald-800/40 bg-emerald-950/20">

              <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />

              <div className="text-sm text-emerald-100/90 space-y-1">

                <p className="font-medium">Importação concluída</p>

                <p>

                  Criados: {importResult.report.criados} · Atualizados:{' '}

                  {importResult.report.atualizados} · Ignorados: {importResult.report.ignorados}

                </p>

                {importResult.report.erros.length > 0 && (

                  <p className="text-amber-300">

                    Erros: {importResult.report.erros.length} (ver lista acima após nova prévia)

                  </p>

                )}

              </div>

            </Card>

          )}

        </Card>

      )}

    </PlatformPage>

  )

}

