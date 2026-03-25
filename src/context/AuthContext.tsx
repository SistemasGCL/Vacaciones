import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { sb } from '../lib/supabaseClient'
import { mapUser } from '../utils/mappers'
import type { MappedUser } from '../utils/mappers'

interface AuthContextValue {
  user:    MappedUser | null
  session: Session | null
  loading: boolean
  signIn:  (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user,    setUser]    = useState<MappedUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string): Promise<string | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)

    try {
      const { data, error } = await sb
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
        .abortSignal(controller.signal)

      clearTimeout(timer)

      if (error) return error.message

      const mapped = mapUser(data as Record<string, unknown>)

      if (!mapped.active) return 'Cuenta desactivada'

      setUser(mapped)
      return null
    } catch (err: unknown) {
      clearTimeout(timer)
      if (err instanceof Error && err.name === 'AbortError') {
        return 'Tiempo de espera agotado al cargar el perfil'
      }
      return 'Error inesperado al cargar el perfil'
    }
  }

  // Inicializa sesión y suscribe a cambios
  useEffect(() => {
    let mounted = true

    sb.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return
      setSession(s)
      if (s?.user) await loadProfile(s.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange(
      async (_event, s) => {
        if (!mounted) return
        setSession(s)
        if (s?.user) {
          setLoading(true)
          await loadProfile(s.user.id)
          setLoading(false)
        } else {
          setUser(null)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Devuelve el mensaje de error si hubo uno, o null si todo fue bien
  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) return error.message
    return null
  }

  async function signOut(): Promise<void> {
    await sb.auth.signOut()
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
