import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface Props {
  children:     React.ReactNode
  allowedRoles: string[]
}

export function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, session, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!user || !allowedRoles.includes(user.rol)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-xl font-semibold text-gray-700">Acceso denegado</p>
        <p className="text-sm text-gray-500">
          No tienes permiso para ver esta página.
        </p>
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          Volver al login
        </button>
      </div>
    )
  }

  return <>{children}</>
}
