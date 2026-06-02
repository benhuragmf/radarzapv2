import { loginWithDiscord } from '../lib/auth'
import { Zap } from 'lucide-react'

export default function Login({ error }: { error?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center">
            <Zap size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">RadarZap</h1>
            <p className="text-xs text-gray-500">Painel Administrativo</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <h2 className="text-lg font-semibold text-white mb-2">Entrar no painel</h2>
          <p className="text-sm text-gray-400 mb-6">
            Use sua conta Discord para acessar o painel de controle.
          </p>

          {error && (
            <div className="mb-4 px-4 py-2 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-400">
              {error === 'no_account' && 'Sua conta Discord não tem acesso ao RadarZap. Use /setup no bot primeiro.'}
              {error === 'token_failed' && 'Falha na autenticação com o Discord. Tente novamente.'}
              {error === 'oauth_error' && 'Erro durante o login. Tente novamente.'}
              {!['no_account', 'token_failed', 'oauth_error'].includes(error) && 'Erro desconhecido. Tente novamente.'}
            </div>
          )}

          <button
            onClick={loginWithDiscord}
            className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium py-3 px-6 rounded-xl transition-colors"
          >
            {/* Discord logo SVG */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Entrar com Discord
          </button>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Apenas usuários registrados no RadarZap podem acessar.
        </p>
      </div>
    </div>
  )
}
