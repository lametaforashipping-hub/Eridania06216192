import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PageHeader({ title }) {
  const navigate = useNavigate()
  return (
    <div className="page-header">
      <button onClick={() => navigate('/')} className="page-back-btn" data-testid="back-btn">
        <ArrowLeft size={24} color="#fff" />
      </button>
      <h1 className="page-header-title">{title}</h1>
    </div>
  )
}
