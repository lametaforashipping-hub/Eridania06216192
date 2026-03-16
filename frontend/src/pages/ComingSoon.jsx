import PageHeader from '../components/PageHeader'
import { Construction } from 'lucide-react'

export default function ComingSoon({ title }) {
  return (
    <div className="coming-soon-page">
      <PageHeader title={title} />
      <div className="coming-soon-content">
        <Construction size={64} color="#8b5cf6" />
        <h2>{title}</h2>
        <p>Esta sección estará disponible próximamente en la versión web.</p>
      </div>
    </div>
  )
}
