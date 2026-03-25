# Variables de entorno — Portal de Vacaciones · Cervecería Cielito Lindo

> Referencia completa de todas las variables de entorno del proyecto.
> Actualizado: 2026-03-24.

---

## Regla fundamental

```
Variables con prefijo VITE_   →  se incrustan en el bundle del navegador.
                                  Cualquier usuario puede verlas.

Variables sin prefijo VITE_   →  solo disponibles en el servidor (Vercel
                                  Functions / Cron Jobs). NUNCA importar
                                  desde archivos dentro de /src.
```

Si una variable sin prefijo `VITE_` se importa en `/src`, Vite la reemplaza
por `undefined` en el bundle — no produce un error de compilación, pero falla
silenciosamente en producción y puede filtrarse en mensajes de error en
el cliente.

---

## Variables del cliente

Visibles en el bundle del navegador. Su seguridad depende de las políticas
RLS de Supabase, no de mantenerlas secretas.

### `VITE_SUPABASE_URL`

| Atributo | Valor |
|----------|-------|
| **Tipo** | URL pública |
| **Ejemplo** | `https://abcdefghijkl.supabase.co` |
| **Requerida** | Sí |

URL del proyecto Supabase. Se usa para inicializar el cliente en
`src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

**Dónde configurar:**
- Local: archivo `.env.local` en la raíz del proyecto.
- Producción: Vercel Dashboard → Project → Settings → Environment Variables.

**Seguridad:** no es un secreto. Exponer esta URL es seguro porque Supabase
requiere autenticación para cualquier operación sobre los datos. RLS garantiza
que aunque un atacante conozca la URL, no pueda leer ni escribir datos que no
le pertenecen.

---

### `VITE_SUPABASE_ANON_KEY`

| Atributo | Valor |
|----------|-------|
| **Tipo** | JWT público (rol `anon`) |
| **Ejemplo** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| **Requerida** | Sí |

Clave pública de Supabase con rol `anon`. Se incluye en cada petición HTTP al
API de Supabase para identificar el proyecto y aplicar las políticas RLS del
rol anónimo o autenticado.

**Dónde configurar:**
- Local: archivo `.env.local`.
- Producción: Vercel Dashboard → Project → Settings → Environment Variables.

**Seguridad:** es seguro exponerla. Es una clave de identificación de proyecto,
no de autorización. El acceso real a los datos lo controla RLS:

```
anon key visible en el bundle
         │
         ▼
  Supabase PostgREST
         │
         ▼
  RLS evalúa auth.uid() y auth.role()
         │
    ┌────┴────┐
    │         │
 PERMITE    DENIEGA
  la fila   la fila
```

Sin una sesión activa (`auth.uid() IS NULL`), las políticas RLS del proyecto
bloquean todo acceso a las tablas. La `anon key` sola no da acceso a ningún dato.

---

## Variables del servidor

Solo disponibles en Vercel Functions y Cron Jobs. **Nunca** deben aparecer
en ningún archivo dentro de `/src`.

### `CRON_SECRET`

| Atributo | Valor |
|----------|-------|
| **Tipo** | String aleatorio (secreto) |
| **Ejemplo** | `K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe...` |
| **Requerida** | Sí — en producción |
| **Generar con** | `openssl rand -base64 32` |

Token Bearer que protege los 3 endpoints de Vercel Cron Jobs contra
invocaciones no autorizadas. Vercel inyecta automáticamente este header
cuando ejecuta el cron según la configuración en `vercel.json`.

Los 3 endpoints que lo validan:

| Endpoint | Función |
|----------|---------|
| `/api/cron/escalar-solicitudes` | Escala a RH las solicitudes sin respuesta en 48 hrs |
| `/api/cron/actualizar-periodos` | Reinicia saldos y recalcula días LFT en aniversarios |
| `/api/cron/alertar-vencimientos` | Notifica a colaboradores con saldo próximo a vencer |

Validación en cada endpoint:

```js
export default function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  // … lógica con supabase service_role
}
```

**Dónde configurar:**
- Local: no es necesario para desarrollo (los cron no se ejecutan en local).
  Si se prueba el endpoint manualmente, agregar a `.env.local`.
- Producción: Vercel Dashboard → Project → Settings → Environment Variables.
  Marcar como **Sensitive** para que no sea visible después de guardada.

> **Advertencia:** si `CRON_SECRET` se filtra, cualquier persona puede
> invocar los cron endpoints y modificar saldos de vacaciones o escalar
> solicitudes de forma arbitraria. Rotar inmediatamente en Vercel Dashboard
> si se sospecha compromiso.

---

### `RESEND_API_KEY`

| Atributo | Valor |
|----------|-------|
| **Tipo** | API key (secreto) |
| **Ejemplo** | `re_AbCdEfGhIjKlMnOpQrStUv` |
| **Requerida** | Sí — en producción |
| **Obtener en** | resend.com → API Keys |

Clave de autenticación para el servicio de email transaccional Resend.
Usada por los Cron Jobs para enviar notificaciones por correo cuando
el portal no puede notificar en tiempo real (usuario sin sesión abierta).

Correos que se envían:

| Evento | Destinatario |
|--------|-------------|
| Nueva solicitud pendiente | Jefe directo |
| Solicitud aprobada / rechazada | Colaborador |
| Solicitud escalada a RH | RH |
| Saldo de vacaciones próximo a vencer | Colaborador |

**Dónde configurar:**
- Local: `.env.local` (para probar el envío de emails en desarrollo).
- Producción: Vercel Dashboard → Project → Settings → Environment Variables.
  Marcar como **Sensitive**.

> **Advertencia:** con esta clave se pueden enviar correos desde el dominio
> configurado en Resend. Si se filtra, un atacante podría enviar phishing
> usando el dominio de Cervecería Cielito Lindo. Rotar en resend.com →
> API Keys si se sospecha compromiso.

---

## Resumen de configuración por entorno

| Variable | `.env.local` | Vercel Dashboard | Visible en bundle |
|----------|:---:|:---:|:---:|
| `VITE_SUPABASE_URL` | ✅ | ✅ | ✅ (intencional) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ (intencional) |
| `CRON_SECRET` | opcional | ✅ | ❌ |
| `RESEND_API_KEY` | opcional | ✅ | ❌ |

---

## Checklist antes de ir a producción

- [ ] `VITE_SUPABASE_URL` configurada en Vercel Dashboard
- [ ] `VITE_SUPABASE_ANON_KEY` configurada en Vercel Dashboard
- [ ] `CRON_SECRET` generada con `openssl rand -base64 32` y configurada en Vercel Dashboard como Sensitive
- [ ] `RESEND_API_KEY` obtenida de resend.com y configurada en Vercel Dashboard como Sensitive
- [ ] `.env.local` agregado a `.gitignore` (nunca commitear valores reales)
- [ ] Verificar que ningún archivo en `/src` importe `process.env.CRON_SECRET` ni `process.env.RESEND_API_KEY`

---

*Documento mantenido por el equipo de desarrollo de Cervecería Cielito Lindo.*
