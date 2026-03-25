import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ProtectedRoute } from './guards/ProtectedRoute'
import LoginPage    from './pages/LoginPage'
import EmployeePage from './pages/EmployeePage'
import ManagerPage  from './pages/ManagerPage'
import HRPage       from './pages/HRPage'

const ROLE_ROUTES: Record<string, string> = {
  colaborador: '/employee',
  jefe:        '/manager',
  rh:          '/hr',
}

// Ruta raíz: redirige según rol o, si no hay sesión, al login
function RootRedirect() {
  const { user, session, loading } = useAuth()

  if (loading) return null // El spinner ya lo muestra ProtectedRoute; aquí evitamos parpadeo

  if (!session) return <Navigate to="/login" replace />
  if (user)     return <Navigate to={ROLE_ROUTES[user.rol] ?? '/login'} replace />
  return <Navigate to="/login" replace />
}

// Ruta /login: si ya hay sesión activa, redirige al dashboard correcto
function LoginRedirect() {
  const { user, session, loading } = useAuth()

  if (loading)          return null
  if (session && user)  return <Navigate to={ROLE_ROUTES[user.rol] ?? '/login'} replace />
  return <LoginPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/"       element={<RootRedirect />} />
      <Route path="/login"  element={<LoginRedirect />} />

      <Route path="/employee" element={
        <ProtectedRoute allowedRoles={['colaborador']}>
          <EmployeePage />
        </ProtectedRoute>
      } />

      <Route path="/manager" element={
        <ProtectedRoute allowedRoles={['jefe']}>
          <ManagerPage />
        </ProtectedRoute>
      } />

      <Route path="/hr" element={
        <ProtectedRoute allowedRoles={['rh']}>
          <HRPage />
        </ProtectedRoute>
      } />

      {/* Cualquier ruta no encontrada */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
