import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sb } from '../lib/supabaseClient'

const ROLE_ROUTES: Record<string, string> = {
  colaborador: '/employee',
  jefe:        '/manager',
  rh:          '/hr',
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.085-3.408M9.88 9.88A3 3 0 0114.12 14.12M6.32 6.32A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a10.05 10.05 0 01-4.132 5.411M3 3l18 18" />
    </svg>
  )
}

export default function LoginPage() {
  const { signIn, user, session, loading } = useAuth()
  const navigate = useNavigate()

  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock,     setCapsLock]     = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [resetSent,    setResetSent]    = useState(false)
  const [emailError,   setEmailError]   = useState<string | null>(null)

  // Si ya hay sesión activa, redirige directamente
  useEffect(() => {
    if (!loading && session && user) {
      navigate(ROLE_ROUTES[user.rol] ?? '/login', { replace: true })
    }
  }, [loading, session, user, navigate])

  function validateEmail(value: string): boolean {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    setEmailError(valid ? null : 'Ingresa un correo electrónico válido')
    return valid
  }

  function handleCapsLock(e: React.KeyboardEvent) {
    setCapsLock(e.getModifierState('CapsLock'))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!validateEmail(email)) return

    setSubmitting(true)
    const err = await signIn(email, password)
    setSubmitting(false)

    if (err) {
      const messages: Record<string, string> = {
        'Invalid login credentials': 'Correo o contraseña incorrectos',
        'Email not confirmed':        'Confirma tu correo antes de ingresar',
        'Cuenta desactivada':         'Tu cuenta está desactivada. Contacta a RH',
        'Tiempo de espera agotado al cargar el perfil':
          'No se pudo cargar tu perfil. Intenta de nuevo',
      }
      setError(messages[err] ?? 'Ocurrió un error. Intenta de nuevo')
      return
    }
    // La redirección la maneja el useEffect al detectar user+session
  }

  async function handleForgotPassword() {
    if (!validateEmail(email)) return
    setError(null)
    await sb.auth.resetPasswordForEmail(email)
    setResetSent(true)
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#1e3a5f' }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          {/* Logo simbólico */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Portal de Vacaciones
          </h1>
          <p className="mt-1 text-sm text-blue-200">Cervecería Cielito Lindo</p>
        </div>

        {/* Tarjeta */}
        <div className="rounded-2xl bg-white px-8 py-10 shadow-2xl">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError(null) }}
                onBlur={e => validateEmail(e.target.value)}
                className={`mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-amber-500 ${
                  emailError ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
                }`}
                placeholder="tu@email.com"
              />
              {emailError && (
                <p className="mt-1 text-xs text-red-600">{emailError}</p>
              )}
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleCapsLock}
                  onKeyUp={handleCapsLock}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-amber-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>

              {/* Aviso Caps Lock */}
              {capsLock && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd" />
                  </svg>
                  Caps Lock activado
                </p>
              )}
            </div>

            {/* Error general */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Confirmación reset */}
            {resetSent && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                Revisa tu correo para restablecer tu contraseña.
              </div>
            )}

            {/* Botón acceder */}
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
            >
              {submitting && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {submitting ? 'Ingresando…' : 'ACCEDER'}
            </button>

            {/* Olvidaste contraseña */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-gray-500 underline-offset-2 hover:text-amber-600 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}
