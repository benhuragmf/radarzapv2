import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-medium text-gray-400 mb-1">{children}</h2>
}

export function CardValue({ children }: { children: ReactNode }) {
  return <p className="text-2xl font-bold text-white">{children}</p>
}
