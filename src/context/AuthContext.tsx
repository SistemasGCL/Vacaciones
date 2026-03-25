import {
  createContext,
  useContext,
  useEffect,
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

  const loadProfile = async (userId: string) => {
    console.log('[Auth] loadProfile — userId:', userId)

    try {
      console.log('[Auth] Probando conexión básica...')

      const { data, error, status } = await sb
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      console.log('[Auth] Query completada — status:', status)
      console.log('[Auth] data:', data)
      console.log('[Auth] error:', error)

      if (error) {
        console.error('[Auth] Error en query:', error.message, error.code)
        setLoading(false)
        return
      }

      if (data) {
        setUser(mapUser(data))
        setLoading(false)
      }

    } catch (e) {
      console.error('[Auth] Exception:', e)
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    // onAuthStateChange dispara INITIAL_SESSION al suscribirse,
    // lo que reemplaza la necesidad de llamar getSession() por separado
    // y evita la race condition de doble loadProfile.
    const { data: { subscription } } = sb.auth.onAuthStateChange(
      async (event, s) => {
        if (!mounted) return

        console.log('[Auth] onAuthStateChange — event:', event, '| userId:', s?.user?.id ?? null)

        setSession(s)

        if (s?.user) {
          setLoading(true)
          await loadProfile(s.user.id)
          if (mounted) setLoading(false)
        } else {
          setUser(null)
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string): Promise<string | null> {
    console.log('[Auth] signIn — email:', email)
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('[Auth] signIn error:', error.message)
      return error.message
    }
    return null
  }

  async function signOut(): Promise<void> {
    console.log('[Auth] signOut')
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
