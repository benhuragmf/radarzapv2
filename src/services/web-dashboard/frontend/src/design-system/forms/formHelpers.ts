import { zodResolver } from '@hookform/resolvers/zod'
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form'
import type { z } from 'zod'

/**
 * Hook de formulário com Zod — validação local não substitui o backend.
 * Envie ao servidor somente após `handleSubmit`; exiba erros da API no caller.
 */
export function useZodForm<TFieldValues extends FieldValues>(
  schema: z.ZodType<TFieldValues, FieldValues>,
  options?: Omit<UseFormProps<TFieldValues>, 'resolver'>,
): UseFormReturn<TFieldValues> {
  return useForm<TFieldValues>({
    ...options,
    resolver: zodResolver(schema) as Resolver<TFieldValues>,
  })
}

export type { UseFormReturn, DefaultValues, FieldValues }
export { zodResolver }

/** Extrai mensagem de erro de resposta API (JSON `{ error, message }` ou texto). */
export function apiErrorMessage(err: unknown, fallback = 'Erro ao processar solicitação'): string {
  if (err instanceof Error && err.message.trim()) return err.message
  if (typeof err === 'object' && err !== null) {
    const o = err as Record<string, unknown>
    if (typeof o.message === 'string' && o.message.trim()) return o.message
    if (typeof o.error === 'string' && o.error.trim()) return o.error
  }
  return fallback
}
