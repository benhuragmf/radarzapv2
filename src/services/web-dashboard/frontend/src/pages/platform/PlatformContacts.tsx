import { useState, useRef } from 'react'

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'

import { PlatformPage } from '../../components/platform/PlatformPage'

import { Link } from 'react-router-dom'

import { api, downloadFile } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react'

type ExportProfile = 'radarzap-native' | 'google-compatible' | 'apple-compatible'

const EXPORT_PROFILES: { id: ExportProfile; label: string }[] = [
  { id: 'radarzap-native', label: 'RadarZap (nativo)' },
  { id: 'google-compatible', label: 'Google / Android' },
  { id: 'apple-compatible', label: 'Apple / iOS' },
]

import { getMe, can, type AuthUser } from '../../lib/auth'

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



export default function PlatformContacts() {

  const qc = useQueryClient()

  const fileRef = useRef<HTMLInputElement>(null)

  const [fileText, setFileText] = useState<string | null>(null)

  const [fileName, setFileName] = useState<string | null>(null)

  const [fileFormat, setFileFormat] = useState<ImportFileFormat | null>(null)

  const [preview, setPreview] = useState<ImportCsvResponse | null>(null)

  const [importResult, setImportResult] = useState<ImportCsvResponse | null>(null)
  const [exporting, setExporting] = useState<ExportProfile | null>(null)



  const { data: me } = useQuery<AuthUser | null>({

    queryKey: ['auth-me'],

    queryFn: getMe,

  })

  const canManage = can(me ?? null, 'send:destination:manage')



  const previewMutation = useMutation({

    mutationFn: ({ text, format }: { text: string; format: ImportFileFormat }) =>

      api.post<ImportCsvResponse>('/destinations/import-csv', {
        content: text,
        format,
        dryRun: true,
      }),

    onSuccess: (data) => {

      setPreview(data)

      setImportResult(null)

    },

    onError: (err: Error) => alert(err.message),

  })



  const importMutation = useMutation({

    mutationFn: ({ text, format }: { text: string; format: ImportFileFormat }) =>

      api.post<ImportCsvResponse>('/destinations/import-csv', {
        content: text,
        format,
        dryRun: false,
      }),

    onSuccess: (data) => {

      setImportResult(data)

      qc.invalidateQueries({ queryKey: ['destinations'] })

    },

    onError: (err: Error) => alert(err.message),

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

      previewMutation.mutate({ text, format })

    }

    reader.readAsText(file, 'UTF-8')

  }



  return (

    <PlatformPage

      title="Contatos (Plataforma)"

      description="Importe e exporte contatos via CSV ou vCard (.vcf). Revise a pré-visualização antes de confirmar o import."

      phase="Fase 3"

    >

      <p className="text-sm text-gray-400">

        Especificação:{' '}

        <code className="text-gray-500">docs/CONTATOS-CSV-IMPORTACAO.md</code>

        {' · '}

        <Link to="/contact" className="text-brand-400 hover:underline">

          Contatos atuais (Destinos) →

        </Link>

      </p>



      <Card className="space-y-3 border-gray-700/80">
        <p className="text-sm text-gray-300 font-medium">Exportar contatos</p>
        <p className="text-xs text-gray-500">
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
                  alert((err as Error).message)
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

        <Card className="space-y-4 border-gray-700/80">

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

              <span className="text-sm text-gray-400 flex items-center gap-2">

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

            <p className="text-sm text-gray-500">Analisando arquivo…</p>

          )}



          {preview && (

            <div className="space-y-3">

              <p className="text-sm text-gray-300">

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

                <div className="overflow-x-auto rounded-lg border border-gray-700/80">

                  <table className="w-full text-xs text-left">

                    <thead className="bg-gray-800/80 text-gray-400">

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

                    <tbody className="divide-y divide-gray-800">

                      {preview.preview.map((row, i) => (

                        <tr key={i} className="text-gray-300">

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

                  <p className="text-xs text-gray-500 px-3 py-2">Pré-visualização (até 5 linhas)</p>

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



              <Button

                type="button"

                onClick={() =>
                  fileText &&
                  fileFormat &&
                  importMutation.mutate({ text: fileText, format: fileFormat })
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

