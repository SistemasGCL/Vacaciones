# Arquitectura — Portal de Vacaciones · Cervecería Cielito Lindo

> Documento de decisiones técnicas. Actualizado: 2026-03-24.

---

## 1. Stack elegido

### Tecnologías en uso

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Bundler / dev server | Vite | 6.x |
| UI | React | 19.x |
| Routing | React Router | v7 |
| Estilos | Tailwind CSS | v4 |
| Backend / base de datos | Supabase JS | v2 |
| Tareas programadas | Vercel Cron Jobs | — |

### Por qué NO se usa cada alternativa descartada

#### Edge Functions (Supabase / Vercel)
Las Edge Functions añaden una capa de indirección innecesaria cuando Supabase
Row Level Security (RLS) ya garantiza que cada cliente sólo puede leer y
escribir sus propios datos. Mantener funciones serverless separadas implicaría:

- Duplicar la lógica de autorización (RLS + validación en la función).
- Aumentar la latencia en cada operación CRUD.
- Complejizar el despliegue y el debugging local.

La única excepción son los **Vercel Cron Jobs**, que sí corren en el servidor
porque necesitan credenciales de servicio (`service_role`) para operar fuera
del contexto de un usuario autenticado (escalado automático de solicitudes,
notificaciones, descuento de saldo).

#### Axios
`fetch` nativo es suficiente para las pocas llamadas REST que no pasan por el
cliente de Supabase. Agregar Axios incrementa el bundle sin beneficio real en
este proyecto.

#### React Query (TanStack Query)
El cliente `supabase-js` ya maneja la reactividad en tiempo real mediante
*subscriptions* (Realtime). Agregar React Query crearía dos fuentes de verdad
para el mismo dato. El estado remoto se gestiona con `useState` + `useEffect`
o con los hooks propios de Supabase cuando se necesitan actualizaciones en
tiempo real.

### Cómo RLS reemplaza a las Edge Functions como capa de seguridad

```
┌──────────────────────────────────────────────────────────┐
│  Cliente React (Vite)                                    │
│  supabase.from('solicitudes').select(...)                │
└────────────────────────┬─────────────────────────────────┘
                         │  JWT del usuario autenticado
                         ▼
┌──────────────────────────────────────────────────────────┐
│  Supabase PostgREST                                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │  RLS — Row Level Security                         │  │
│  │  • colaborador ve SOLO sus propias filas           │  │
│  │  • manager ve filas de su equipo directo           │  │
│  │  • RH ve todas las filas                           │  │
│  └────────────────────────────────────────────────────┘  │
│  PostgreSQL                                              │
└──────────────────────────────────────────────────────────┘
```

Las políticas RLS se evalúan **dentro de la base de datos**, antes de que
cualquier dato llegue al cliente. No hay forma de saltarlas desde el
frontend, aunque el código fuente del cliente sea visible. Esto elimina la
necesidad de una función intermediaria que valide permisos.

---

## 2. Campos especiales de negocio

### `works_saturday` (boolean) — tabla `empleados`

Indica que el colaborador trabaja los sábados de forma regular.

**Impacto en el cálculo de vacaciones:**
Cuando `works_saturday = true`, los sábados se cuentan como días hábiles al
calcular cuántos días de vacaciones consume una solicitud. Para el resto de
los colaboradores (`works_saturday = false`), los sábados son inhábiles y no
se descuentan del saldo.

```
Ejemplo:
  Solicitud: lunes 17 → viernes 21 de marzo
  works_saturday = false  → 5 días hábiles descontados
  works_saturday = true   → 5 días (el sábado 22 no está en el rango)

  Solicitud: lunes 17 → sábado 22 de marzo
  works_saturday = false  → 5 días hábiles descontados
  works_saturday = true   → 6 días hábiles descontados
```

### `manager_id` (uuid FK self-referential) — tabla `empleados`

Referencia al `id` de otro registro dentro de la misma tabla `empleados`.
Permite construir una jerarquía multinivel sin tablas adicionales.

```
empleados
  id: uuid PK
  manager_id: uuid FK → empleados.id   (nullable = CEO / sin jefe)
```

Consulta para obtener la cadena de aprobación completa:

```sql
-- Subida recursiva hasta encontrar manager_id IS NULL
WITH RECURSIVE cadena AS (
  SELECT id, nombre, manager_id, 1 AS nivel
  FROM empleados WHERE id = $1
  UNION ALL
  SELECT e.id, e.nombre, e.manager_id, c.nivel + 1
  FROM empleados e
  JOIN cadena c ON e.id = c.manager_id
)
SELECT * FROM cadena ORDER BY nivel;
```

### `active` (boolean) — tabla `empleados`

Controla si el colaborador puede iniciar sesión y crear solicitudes.

- `active = true` → acceso normal al portal.
- `active = false` → la política RLS bloquea el acceso; el registro y su
  historial de solicitudes **se conservan íntegros** en la base de datos para
  efectos de auditoría y cumplimiento laboral.

No se eliminan registros de empleados; se desactivan.

### Días de vacaciones — Ley Federal del Trabajo MX (reforma 2023)

A partir de la reforma de 2023, los días mínimos de vacaciones aumentaron.
La tabla de referencia por antigüedad (`lft_dias`) es:

| Año(s) de antigüedad | Días mínimos LFT |
|---------------------|-----------------|
| 1 | 12 |
| 2 | 14 |
| 3 | 16 |
| 4 | 18 |
| 5–9 | 20 |
| 10–14 | 22 |
| 15–19 | 24 |
| 20–24 | 26 |
| 25–29 | 28 |
| 30+ | 30 |

El saldo se calcula al aniversario del colaborador. La columna
`saldo_vacaciones` en `empleados` se actualiza mediante un Cron Job que corre
cada día a las 00:05 hora del Centro de México.

---

## 3. Flujo completo de una solicitud

```
┌──────────────────────────────────────────────────────────────────────┐
│                FLUJO DE UNA SOLICITUD DE VACACIONES                  │
└──────────────────────────────────────────────────────────────────────┘

 [Colaborador]
      │
      │  1. Crea solicitud en el portal
      │     • Selecciona fechas
      │     • Sistema calcula días hábiles según works_saturday
      │     • Verifica saldo disponible
      │     • Estado inicial: PENDIENTE
      ▼
 [Base de datos — tabla solicitudes]
      │
      │  2. INSERT dispara Supabase Realtime
      │
      ▼
 [Jefe directo — manager_id]
      │
      │  3. Recibe notificación en el portal (Realtime)
      │     y correo electrónico (Cron Job de notificaciones)
      │
      ├──── APRUEBA ──────────────────────────────────────────────────┐
      │                                                               │
      ├──── RECHAZA ──────────────────────────────────────────────────┤
      │                                                               │
      │  4. ¿Transcurrieron 48 horas sin respuesta?                   │
      │                                                               │
      └──── SÍ ──▶ [Cron Job — cada hora]                            │
                       │                                             │
                       │  5. Escala automáticamente a RH             │
                       │     • manager_id de la solicitud → RH       │
                       │     • Estado: ESCALADA                      │
                       ▼                                             │
                  [RH aprueba / rechaza]                             │
                       │                                             │
                       └─────────────────────────────────────────────┘
                                          │
                                          ▼
                              [Estado: APROBADA / RECHAZADA]
                                          │
                                          │  6. Notificación al colaborador
                                          │     (Realtime + correo)
                                          │
                                          ▼
                              [Si APROBADA]
                                          │
                                          │  7. Cron Job descuenta días del
                                          │     saldo_vacaciones del colaborador
                                          │     al primer día de inicio de
                                          │     las vacaciones
                                          ▼
                              [Saldo actualizado en BD]
```

---

## 4. Decisiones de seguridad

### RLS activo desde el día 1

Las cuatro tablas principales tienen RLS habilitado antes de insertar
cualquier dato de producción:

| Tabla | Política clave |
|-------|---------------|
| `empleados` | Cada usuario ve sólo su propia fila; managers ven a sus reportes directos; RH ve todo |
| `solicitudes` | Colaborador ve sus solicitudes; manager ve las de su equipo; RH ve todas |
| `historial_aprobaciones` | Solo lectura para partes involucradas |
| `configuracion` | Solo lectura para autenticados; escritura solo para RH |

Nunca se deshabilita RLS aunque la tabla esté vacía. La vista pública
(`anon`) no tiene acceso a ninguna tabla.

### 6 headers de seguridad en `vercel.json`

Configurados para pasar el escaneo OWASP ZAP sin hallazgos críticos:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options",    "value": "nosniff" },
        { "key": "X-Frame-Options",            "value": "DENY" },
        { "key": "X-XSS-Protection",           "value": "1; mode=block" },
        { "key": "Referrer-Policy",            "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy",         "value": "camera=(), microphone=(), geolocation=()" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; connect-src 'self' https://*.supabase.co; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        }
      ]
    }
  ]
}
```

### Variables de entorno: regla de los prefijos

```
VITE_SUPABASE_URL        ✅  Pública — necesaria en el cliente React
VITE_SUPABASE_ANON_KEY   ✅  Pública — clave anon, protegida por RLS

SUPABASE_SERVICE_KEY     ✅  NUNCA en /src — solo en Cron Jobs (servidor)
CRON_SECRET              ✅  NUNCA en /src — solo en Cron Jobs (servidor)
```

**Regla:** cualquier variable sin prefijo `VITE_` no debe aparecer en ningún
archivo dentro de `src/`. Vite no las inyecta en el bundle, pero una
importación accidental quedaría como `undefined` en producción y podría
filtrar la clave en un error de runtime.

### Vercel Cron Jobs protegidos con `CRON_SECRET`

Cada endpoint de cron (`/api/cron/*`) valida el header de autorización antes
de ejecutar cualquier lógica:

```js
// api/cron/escalar-solicitudes.js
export default function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  // … lógica con supabase service_role
}
```

Vercel inyecta automáticamente el header cuando ejecuta el cron. Cualquier
llamada externa sin el secret recibe `401`.

---

*Documento mantenido por el equipo de desarrollo de Cervecería Cielito Lindo.*
