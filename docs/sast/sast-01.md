# SAST-01 — Revisión de seguridad estática
## Portal de Vacaciones · Cervecería Cielito Lindo

| | |
|---|---|
| **Fecha de revisión** | 2026-03-24 |
| **Revisión** | Sem 1 · Lunes |
| **Alcance** | Configuración de entorno, secretos y estructura de documentación |
| **Herramienta** | Revisión manual + grep de patrones |

---

## Resultados

### 1. `.gitignore` — protección de archivos sensibles

| Ítem verificado | Resultado |
|-----------------|-----------|
| `.env` presente en `.gitignore` | ✅ OK |
| `.env.local` presente en `.gitignore` | ✅ OK |
| `.env.production` presente en `.gitignore` | ✅ OK |
| `.env*.local` (glob) presente en `.gitignore` | ✅ OK |
| `node_modules/` presente en `.gitignore` | ✅ OK |
| `dist/` presente en `.gitignore` | ✅ OK |

**Observaciones:** el `.gitignore` cubre además `.vercel/` y `*.log`. Sin hallazgos.

---

### 2. Búsqueda de secretos en `docs/`

Patrones buscados: `sk_`, `re_[token]`, `eyJ[token]`, `SERVICE_ROLE`, `secret`, `password`, `api_key`

| Hallazgo | Archivo | Línea | Clasificación | Resultado |
|----------|---------|-------|---------------|-----------|
| `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | `docs/env.md` | 67 | Ejemplo de JWT truncado con `...` en tabla de documentación | ⚠️ Falso positivo |
| `re_AbCdEfGhIjKlMnOpQrStUv` | `docs/env.md` | 156 | Placeholder de RESEND_API_KEY en tabla de documentación | ⚠️ Falso positivo |
| `CRON_SECRET` (múltiples) | `docs/arquitectura.md`, `docs/env.md` | varios | Nombre de variable documentado en prosa y snippets de código de ejemplo | ⚠️ Falso positivo |
| `secret`, `secreto`, `api_key` | `docs/env.md` | varios | Uso en prosa explicativa y advertencias de seguridad | ⚠️ Falso positivo |
| `SERVICE_ROLE` | — | — | Sin coincidencias | ✅ OK |
| `sk_` | — | — | Sin coincidencias | ✅ OK |
| `password` | — | — | Sin coincidencias | ✅ OK |

**Veredicto:** ✅ Sin secretos reales. Todos los hallazgos son ejemplos de
documentación truncados (`...`) o placeholders genéricos. Ninguno constituye
una credencial funcional.

**Criterio de distinción aplicado:**
- JWT real: cadena Base64 completa de 3 segmentos (`xxxxx.yyyyy.zzzzz`). El hallazgo termina en `...` → ejemplo ilustrativo.
- API key real de Resend: empieza con `re_` seguido de caracteres aleatorios reales. El hallazgo `re_AbCdEfGhIjKlMnOpQrStUv` es un patrón genérico de demostración sin entropía real.

---

### 3. `.env.example` y ausencia de `.env`

| Ítem verificado | Resultado |
|-----------------|-----------|
| `.env.example` existe en la raíz | ✅ OK |
| `.env.example` no contiene valores reales | ✅ OK |
| `.env` NO existe en el repositorio | ✅ OK |

**Observaciones:** los valores en `.env.example` son placeholders explícitos
(`tu-anon-key-aqui`, `genera-con-openssl-rand-base64-32`, `re_xxxxxxxxxxxx`).
El archivo `.env` no existe aún; deberá crearse manualmente por cada desarrollador
copiando `.env.example` y completando con valores reales desde Supabase y Vercel.

---

### 4. Estructura de `docs/`

| Archivo | Tamaño | Resultado |
|---------|--------|-----------|
| `docs/arquitectura.md` | 12 731 bytes (~12.4 KB) | ✅ OK |
| `docs/erd.md` | 15 402 bytes (~15 KB) | ✅ OK |
| `docs/env.md` | 6 901 bytes (~6.7 KB) | ✅ OK |
| `docs/sast/sast-01.md` | este archivo | ✅ OK |

Todos los documentos requeridos existen y tienen contenido sustancial.

---

## Resumen ejecutivo

| # | Área | Estado |
|---|------|--------|
| 1 | Protección de archivos sensibles (`.gitignore`) | ✅ OK |
| 2 | Secretos hardcodeados en `docs/` | ✅ OK — solo falsos positivos documentales |
| 3 | `.env.example` sin valores reales / `.env` ausente | ✅ OK |
| 4 | Estructura de documentación completa | ✅ OK |

**Resultado global: ✅ APROBADO — sin hallazgos críticos ni bloqueantes.**

No se identificaron secretos reales, credenciales funcionales ni datos
sensibles en el código o documentación del proyecto en este corte de revisión.

---

## Pendientes para próximas revisiones

- [ ] SAST-02: revisar `/src` cuando se agregue código fuente (verificar que
  no se importen `CRON_SECRET` ni `RESEND_API_KEY` desde el cliente).
- [ ] SAST-02: verificar que las políticas RLS estén habilitadas en las 4
  tablas antes del primer deploy a producción.
- [ ] SAST-02: ejecutar escaneo OWASP ZAP contra el dominio de Vercel Preview
  para validar los 6 headers de seguridad en `vercel.json`.

---

*Revisión manual Sem 1 · Lunes*
