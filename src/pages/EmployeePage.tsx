import { useAuth } from '../context/AuthContext'

export default function EmployeePage() {
  const { user, signOut } = useAuth()
  return (
    <div className="p-8">
      <h1 className="text-xl font-medium mb-2">EmployeePage — Sem 2</h1>
      <p className="text-gray-500 mb-4">Bienvenida, {user?.nombre}</p>
      <button
        onClick={signOut}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Cerrar sesión
      </button>
    </div>
  )
}
