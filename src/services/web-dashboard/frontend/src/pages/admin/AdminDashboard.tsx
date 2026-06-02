import { Card } from '../../components/ui/Card'

interface Props {
  title?: string
}

export default function AdminDashboard({ title = 'Dashboard Global' }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Card className="text-gray-400 text-sm">
        Painel administrativo interno RadarZap. Módulo em expansão.
      </Card>
    </div>
  )
}
