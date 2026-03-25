// Convierte registros snake_case de Supabase a camelCase para el frontend.
// Tipado loose (Record) intencionalmente: los tipos de dominio se definen aparte.

export function mapUser(u: Record<string, unknown>) {
  return {
    id:             u.id             as string,
    email:          u.email          as string,
    nombre:         u.nombre         as string,
    rol:            u.rol            as string,
    area:           u.area           as string | null,
    managerId:      u.manager_id     as string | null,
    diasAsignados:  u.dias_asignados as number | null,
    diasUsados:     u.dias_usados    as number,
    periodoInicio:  u.periodo_inicio as string | null,
    periodoFin:     u.periodo_fin    as string | null,
    worksSaturday:  u.works_saturday as boolean,
    active:         u.active         as boolean,
    alertaEnviada:  u.alerta_enviada as boolean,
    createdAt:      u.created_at     as string,
  }
}

export type MappedUser = ReturnType<typeof mapUser>

export function mapRequest(r: Record<string, unknown>) {
  return {
    id:           r.id            as string,
    userId:       r.user_id       as string,
    tipo:         r.tipo          as string,
    fechaInicio:  r.fecha_inicio  as string,
    fechaFin:     r.fecha_fin     as string,
    diasHabiles:  r.dias_habiles  as number,
    status:       r.status        as string,
    motivo:       r.motivo        as string | null,
    comentario:   r.comentario    as string | null,
    decididoPor:  r.decidido_por  as string | null,
    createdAt:    r.created_at    as string,
  }
}

export type MappedRequest = ReturnType<typeof mapRequest>

export function mapNotification(n: Record<string, unknown>) {
  return {
    id:        n.id         as string,
    userId:    n.user_id    as string,
    titulo:    n.titulo     as string,
    mensaje:   n.mensaje    as string,
    leida:     n.leida      as boolean,
    link:      n.link       as string | null,
    createdAt: n.created_at as string,
  }
}

export type MappedNotification = ReturnType<typeof mapNotification>
