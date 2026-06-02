import { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const styles: Record<Variant, string> = {
  primary:   'bg-brand-600 hover:bg-brand-700 text-white',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-white',
  danger:    'bg-red-700 hover:bg-red-600 text-white',
  ghost:     'bg-transparent hover:bg-gray-800 text-gray-400 hover:text-white',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sz} ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
