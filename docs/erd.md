# ERD — Base de datos · Portal de Vacaciones · Cervecería Cielito Lindo

> Diseño de las 4 tablas de Supabase con RLS activo. Actualizado: 2026-03-24.

---

## Diagrama de relaciones

```
┌──────────────────────────────────────────────────────────────────────┐
│                              users                                   │
│  id (PK)  ◄──────────────────────────────────┐                       │
│  email                                       │                       │
│  nombre                                      │  self-referential     │
│  rol                                         │                       │
│  area                                        │                       │
│  manager_id (FK) ────────────────────────────┘                       │
│  dias_asignados                                                      │
│  dias_usados                                                         │
│  periodo_inicio                                                      │
│  periodo_fin                                                         │
│  works_saturday                                                      │
│  active                                                              │
│  alerta_enviada                                                      │
│  created_at                                                          │
└───────────┬──────────────────────────────────────────────────────────┘
            │ id                                     │ id
            │                                        │
            │ 1                                      │ 1
            │                                        │
           N│                                       N│
┌───────────▼──────────────────┐       ┌────────────▼─────────────────┐
│          requests            │       │        notifications          │
│  id (PK)                     │       │  id (PK)                     │
│  user_id (FK) → users.id     │       │  user_id (FK) → users.id     │
│  tipo                        │       │  titulo                      │
│  fecha_inicio                │       │  mensaje                     │
│  fecha_fin                   │       │  leida                       │
│  dias_habiles                │       │  link                        │
│  status                      │       │  created_at                  │
│  motivo                      │       └──────────────────────────────┘
│  comentario                  │
│  decidido_por (FK) → users.id│
│  created_at                  │
└──────────────────────────────┘

┌──────────────────────────────┐
│           settings           │
│  key (PK)                    │
│  value (jsonb)               │
│  updated_at                  │
└──────────────────────────────┘
  (sin FK — tabla de configuración global)
```

---

## Tabla `users`

Registro central de todos los colaboradores de la cervecería. Cada fila representa
una cuenta de usuario vinculada a la autenticación de Supabase Auth (`auth.users`).

### Campos

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | uuid | PK, default `gen_random_uuid()` | Identificador único. Se sincroniza con `auth.users.id` para que las políticas RLS funcionen con `auth.uid()`. |
| `email` | text | UNIQUE NOT NULL | Correo corporativo. Se usa como identificador de login en Supabase Auth. |
| `nombre` | text | NOT NULL | Nombre completo del colaborador tal como aparece en documentos laborales. |
| `rol` | text | NOT NULL | Nivel de acceso dentro del portal. Valores posibles: `colaborador`, `jefe`, `rh`. Determina qué políticas RLS aplican. |
| `area` | text | nullable | Departamento o área organizacional (ej. `Producción`, `Ventas`, `RH`). Informativo; no afecta la lógica de aprobación. |
| `manager_id` | uuid | FK → `users.id`, nullable | Referencia self-referential al jefe directo. `NULL` indica que el registro es de un CEO o de RH sin supervisor. Ver nota abajo. |
| `dias_asignados` | int | nullable | Días de vacaciones correspondientes al periodo activo, calculados con la tabla LFT 2023 según años de antigüedad. Se actualiza mediante Cron Job en la fecha de aniversario. |
| `dias_usados` | int | NOT NULL, default `0` | Días de vacaciones ya consumidos en el periodo activo. Se incrementa cuando una solicitud de tipo `vacaciones` cambia a `aprobada`. |
| `periodo_inicio` | date | nullable | Fecha de aniversario laboral; marca el inicio del periodo vacacional vigente. |
| `periodo_fin` | date | nullable | `periodo_inicio + 1 año`. Al cruzar esta fecha el Cron Job reinicia `dias_usados = 0` y recalcula `dias_asignados`. |
| `works_saturday` | boolean | NOT NULL, default `false` | Si `true`, los sábados se contabilizan como días hábiles al calcular `dias_habiles` en una solicitud. Afecta directamente la función `calcularDiasHabiles()` en `utils/dates.ts`. |
| `active` | boolean | NOT NULL, default `true` | `false` = cuenta desactivada. La política RLS bloquea el acceso al portal pero el registro y su historial se conservan íntegros para auditoría. Nunca se elimina un usuario. |
| `alerta_enviada` | boolean | NOT NULL, default `false` | Bandera que evita que el Cron Job de alertas envíe más de una notificación por periodo cuando el colaborador está próximo a vencer sus vacaciones sin haberlas tomado. Se reinicia a `false` junto con `dias_usados` al inicio de cada nuevo periodo. |
| `created_at` | timestamptz | NOT NULL, default `now()` | Fecha de registro en el sistema. |

### Notas importantes

**`manager_id` — FK self-referential:**
Permite jerarquías de aprobación de profundidad arbitraria sin tablas extra.
Al escalar una solicitud no respondida en 48 hrs, el Cron Job sube por la
cadena de `manager_id` hasta encontrar un usuario con `rol = 'rh'`.

```
Director General (manager_id = NULL)
  └── Gerente de Producción (manager_id = Director General)
        └── Jefe de Turno (manager_id = Gerente de Producción)
              └── Colaborador (manager_id = Jefe de Turno)
```

**`works_saturday` — impacto en `utils/dates.ts`:**
La función `calcularDiasHabiles(fechaInicio, fechaFin, worksSaturday)` itera
día a día y excluye domingos siempre. Si `worksSaturday = false` también
excluye sábados. Los días festivos nacionales se excluyen adicionalmente
usando el catálogo de `settings` con key `'dias_festivos'`.

**Saldo disponible:**
```
saldo_disponible = dias_asignados - dias_usados
```
Una solicitud solo puede crearse si `saldo_disponible >= dias_habiles` de la
solicitud (validación en frontend y en política RLS de INSERT).

---

## Tabla `requests`

Cada fila representa una solicitud de ausencia creada por un colaborador.
Cubre dos tipos: vacaciones formales y días personales.

### Campos

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | uuid | PK, default `gen_random_uuid()` | Identificador único de la solicitud. |
| `user_id` | uuid | FK → `users.id` NOT NULL | Colaborador que origina la solicitud. Requerido por RLS para filtrar por propietario. |
| `tipo` | text | NOT NULL | Categoría de la ausencia. `vacaciones` descuenta `dias_usados`; `personal` no afecta el saldo vacacional. |
| `fecha_inicio` | date | NOT NULL | Primer día de la ausencia solicitada (inclusivo). |
| `fecha_fin` | date | NOT NULL | Último día de la ausencia solicitada (inclusivo). |
| `dias_habiles` | int | NOT NULL | Calculado en el momento de la creación con `calcularDiasHabiles()`. Se guarda para que cambios posteriores en `works_saturday` no alteren solicitudes históricas. |
| `status` | text | NOT NULL, default `'pendiente'` | Estado de la solicitud en el flujo de aprobación. Valores: `pendiente`, `aprobada`, `rechazada`, `cancelada`. |
| `motivo` | text | nullable | Texto libre ingresado por el colaborador al crear la solicitud. Opcional para días personales, no requerido para vacaciones. |
| `comentario` | text | nullable | Observación dejada por el jefe o RH al aprobar o rechazar. Visible para el colaborador en el historial. |
| `decidido_por` | uuid | FK → `users.id`, nullable | `id` del usuario (jefe o RH) que cambió el `status`. `NULL` mientras la solicitud está `pendiente` o `cancelada` por el colaborador. |
| `created_at` | timestamptz | NOT NULL, default `now()` | Fecha y hora de creación de la solicitud. |

### Flujo de `status`

```
               [Colaborador crea]
                      │
                      ▼
                 PENDIENTE ──── Colaborador cancela ──▶ CANCELADA
                      │
          ┌───────────┴────────────┐
          │                        │
    Jefe/RH aprueba          Jefe/RH rechaza
          │                        │
          ▼                        ▼
       APROBADA               RECHAZADA
          │
          ▼
   Cron Job descuenta
   dias_usados en users
```

### Notas importantes

- `dias_habiles` se persiste en el momento de INSERT para preservar el
  histórico aunque el colaborador cambie `works_saturday` después.
- Solo las solicitudes con `tipo = 'vacaciones'` y `status = 'aprobada'`
  incrementan `users.dias_usados`.
- El Cron Job de escalado revisa solicitudes con `status = 'pendiente'` y
  `created_at < now() - interval '48 hours'` para reasignar la decisión a RH.

---

## Tabla `notifications`

Bandeja de entrada interna del portal. Cada fila es una notificación
dirigida a un usuario específico, generada automáticamente por el flujo
de solicitudes o por los Cron Jobs.

### Campos

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | uuid | PK, default `gen_random_uuid()` | Identificador único de la notificación. |
| `user_id` | uuid | FK → `users.id` NOT NULL | Destinatario de la notificación. La política RLS garantiza que cada usuario solo ve las suyas. |
| `titulo` | text | NOT NULL | Encabezado corto que aparece en la campana de notificaciones (ej. `"Solicitud aprobada"`). |
| `mensaje` | text | NOT NULL | Cuerpo de la notificación con el detalle (ej. `"Tu solicitud del 17 al 21 de marzo fue aprobada por Ana López"`). |
| `leida` | boolean | NOT NULL, default `false` | El frontend marca `true` cuando el usuario abre la notificación. El contador de no leídas se obtiene con `count(*) where leida = false`. |
| `link` | text | nullable | Ruta interna del portal a la que debe navegar el usuario al hacer clic (ej. `/employee?tab=historial`, `/manager?tab=pendientes`). Permite deep-linking sin lógica extra en el componente. |
| `created_at` | timestamptz | NOT NULL, default `now()` | Marca de tiempo usada para ordenar la bandeja de entrada (más reciente primero). |

### Generación de notificaciones

| Evento | Destinatario | Título ejemplo |
|--------|-------------|----------------|
| Colaborador crea solicitud | Jefe directo | `"Nueva solicitud pendiente"` |
| Jefe aprueba | Colaborador | `"Solicitud aprobada"` |
| Jefe rechaza | Colaborador | `"Solicitud rechazada"` |
| Escalado automático (48 hrs) | RH | `"Solicitud escalada sin respuesta"` |
| RH decide | Colaborador | `"Solicitud aprobada / rechazada por RH"` |
| Saldo próximo a vencer | Colaborador | `"Tienes días pendientes por tomar"` |

---

## Tabla `settings`

Tabla de configuración global del sistema. No tiene FK hacia otras tablas.
Usada por los Cron Jobs y por RH para parametrizar el comportamiento del portal
sin necesidad de redespliegue.

### Campos

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `key` | text | PK | Identificador único de la configuración (ej. `'dias_festivos'`, `'horas_escalado'`). |
| `value` | jsonb | NOT NULL | Valor de la configuración en formato JSON. Permite almacenar escalares, arrays y objetos en una sola tabla. |
| `updated_at` | timestamptz | NOT NULL, default `now()` | Última modificación. Útil para auditoría y para detectar si una configuración fue cambiada durante un incidente. |

### Registros esperados en producción

| `key` | `value` (ejemplo) | Propósito |
|-------|-------------------|-----------|
| `dias_festivos` | `["2026-01-01","2026-02-03","2026-03-16"]` | Días no laborables excluidos del cálculo de días hábiles en `utils/dates.ts`. |
| `horas_escalado` | `48` | Horas sin respuesta antes de escalar una solicitud a RH. Configurable sin tocar código. |
| `alerta_dias_restantes` | `5` | Días de saldo mínimo restantes para disparar la alerta de vencimiento. |
| `lft_tabla` | `{"1":12,"2":14,"3":16,"4":18,"5":20,...}` | Tabla LFT 2023 de días mínimos por año de antigüedad. Permite actualizarla si la ley cambia. |

### Notas importantes

- Solo usuarios con `rol = 'rh'` tienen permiso de escritura en esta tabla
  (política RLS de UPDATE/INSERT/DELETE).
- Todos los usuarios autenticados pueden leer `settings` (política RLS de SELECT).
- Los Cron Jobs acceden con `service_role`, que bypass RLS, pero igualmente
  solo leen esta tabla; nunca la modifican desde el cron.

---

## Resumen de relaciones

```
users.id  ←─── users.manager_id          (self-referential, nullable)
users.id  ←─── requests.user_id          (1 usuario → N solicitudes)
users.id  ←─── requests.decidido_por     (1 usuario → N decisiones tomadas)
users.id  ←─── notifications.user_id     (1 usuario → N notificaciones)
```

`settings` no tiene relaciones con otras tablas. Es una tabla de configuración
plana accedida por key.

---

## Políticas RLS por tabla

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `users` | Propio registro; manager ve su equipo; RH ve todo | Solo RH / función de onboarding | Solo RH o el propio usuario (campos limitados) | Nunca — se desactiva con `active = false` |
| `requests` | Propio; manager ve su equipo; RH ve todo | Solo el propio colaborador (`active = true`) | Manager o RH cambian `status`; colaborador puede `cancelada` | Nunca |
| `notifications` | Solo el propio `user_id` | Cron Jobs con `service_role` | Solo el propio usuario (marcar `leida = true`) | Nunca |
| `settings` | Todos los autenticados | Solo RH | Solo RH | Solo RH |

---

*Documento mantenido por el equipo de desarrollo de Cervecería Cielito Lindo.*
