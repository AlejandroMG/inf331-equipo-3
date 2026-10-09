# Producto

## Qué problema resuelve

Arrendar un espacio por horas o por días entre particulares hoy pasa por redes sociales, WhatsApp y transferencias fuera de cualquier plataforma. No se ve bien qué hay disponible, cuesta comparar precios, los horarios se coordinan a mano y hay poca confianza entre las partes. RentSmart centraliza la publicación, la búsqueda, la reserva y el pago.

## Usuarios

| Perfil | Qué hace |
|---|---|
| Arrendatario | Busca espacios, reserva un horario, paga y revisa sus reservas y pagos |
| Propietario | Publica espacios con fotos, precio, horario y reglas; revisa sus espacios y reservas |
| Admin | Suspende usuarios, despublica espacios y ve reservas y pagos de la plataforma |

Una misma cuenta puede ser arrendatario y propietario ([P-02](decisiones.md#p-02--una-cuenta-con-ambos-modos)). Se habilita como propietario al publicar su primer espacio.

## Alcance para el 9 de octubre (MVP)

Lo que tiene que funcionar de punta a punta en la entrega:

1. Registro, inicio de sesión y roles.
2. Publicar un espacio con fotos, precios, horario semanal, ubicación y reglas; editarlo, activarlo y desactivarlo.
3. Catálogo con filtros (tipo, precio, comuna, capacidad y texto) y detalle del espacio.
4. Reservar por hora o por día, pagar con Stripe en modo test y ver la reserva confirmada.
5. Validación de conflictos de agenda: dos reservas no pueden cruzarse.
6. IA que genera la descripción del espacio a partir de fotos y datos.
7. Panel del propietario (mis espacios), panel del arrendatario (mis reservas y pagos) y panel admin básico (usuarios).
8. Diseño responsive y datos persistidos en PostgreSQL.

Lo que no entra quedó en el milestone [Post 9 de octubre](https://github.com/AlejandroMG/inf331-equipo-3/milestone/7): búsqueda en lenguaje natural, reseñas, cancelaciones con política de reembolso, filtro por disponibilidad, calendario visual, E2E completo y más. Las ideas opcionales están en [Extras](https://github.com/AlejandroMG/inf331-equipo-3/milestone/6).

## Reglas de negocio

### Espacios

- **Tipos permitidos** ([P-08](decisiones.md#p-08--lista-cerrada-de-8-tipos-de-espacio)): sala de reuniones, oficina o cowork, estudio fotográfico o audiovisual, sala de ensayo, cocina equipada, cancha, salón de eventos y taller. El admin puede agregar tipos. No se permite alojamiento.
- **Ubicación** ([P-09](decisiones.md#p-09--ubicación-pública-con-detalle-privado)): región y comuna desde una lista cerrada, que sirve para filtrar. La dirección (calle y número) es pública. El detalle (número de depto u oficina, indicaciones de acceso) es privado y solo lo ve quien tiene una reserva `Confirmada` en ese espacio.
- **Precio**: por hora, por día o ambos. Montos en pesos chilenos, sin decimales.
- **Publicación**: un espacio solo se publica si tiene tipo, descripción, capacidad, comuna, precio (por hora o por día), al menos una foto y horario semanal ([P-18](decisiones.md#p-18--tipo-y-comuna-también-son-obligatorios-para-publicar)). Mientras tanto queda como borrador. Un espacio publicado no puede quedar sin alguno de esos datos: para dejarlo incompleto hay que desactivarlo primero.
- **Desactivar** un espacio lo saca del catálogo y bloquea nuevas reservas; las reservas ya confirmadas se mantienen.
- **Cambios de precio** aplican solo a reservas nuevas.

### Disponibilidad

- El propietario define un **horario semanal**: días y rangos en que se puede arrendar (por ejemplo, lunes a viernes de 09:00 a 21:00), en hora de Santiago.
- Se reserva en **bloques de 1 hora**, con un mínimo de 1 hora ([P-07](decisiones.md#p-07--por-hora-yo-por-día-en-bloques-de-1-hora)). Reservar "por día" toma todo el horario disponible de ese día.
- Un horario está ocupado si tiene una reserva `Pendiente` no vencida, `Pagada` o `Confirmada`.

### Reservas

Reserva inmediata, sin aprobación del propietario ([P-05](decisiones.md#p-05--reserva-inmediata)):

1. El arrendatario elige horario y ve el desglose (subtotal, comisión y total).
2. Al confirmar, la reserva queda **Pendiente** y retiene el horario **30 minutos** mientras paga en Stripe ([P-06](decisiones.md#p-06--pendiente--pagada--confirmada)).
3. Cuando Stripe confirma el pago, pasa a **Pagada**.
4. El sistema valida automáticamente que el espacio siga activo y el horario libre, y la pasa a **Confirmada**. Si la validación falla, la **Cancela** y reembolsa el total.
5. Al terminar el horario pasa a **Finalizada**.
6. Si el arrendatario no paga en 30 minutos, pasa a **Expirada** y libera el horario.

Cancelación ([P-14](decisiones.md#p-14--cancelación-gratis-hasta-24-horas-antes)): el arrendatario o el propietario pueden cancelar una reserva **Pendiente** o **Confirmada**, con un motivo. Si cancela el arrendatario hasta 24 horas antes del inicio, o si cancela el propietario, se reembolsa el total (con la comisión); si el arrendatario cancela con menos de 24 horas, no hay reembolso.

El diagrama de estados está en [arquitectura.md](arquitectura.md#ciclo-de-vida-de-una-reserva).

### Pendiente de definir

| Tema | Decisión | Se necesita antes de |
|---|---|---|
| Stripe con o sin Connect | [P-12](https://github.com/AlejandroMG/inf331-equipo-3/issues/79) | 3 de octubre |
| Monto de la comisión y quién la paga | [P-13](https://github.com/AlejandroMG/inf331-equipo-3/issues/80) | 3 de octubre |
| Proveedor de IA | [P-15](https://github.com/AlejandroMG/inf331-equipo-3/issues/82) | 3 de octubre |
| Dónde desplegar | [P-17](https://github.com/AlejandroMG/inf331-equipo-3/issues/84) | 3 de octubre |
| Qué exige el ramo en pruebas | [P-11](https://github.com/AlejandroMG/inf331-equipo-3/issues/78) | Respuesta del profesor |
| Reseñas en una o ambas direcciones | [P-16](https://github.com/AlejandroMG/inf331-equipo-3/issues/83) | Después del 9 de octubre |
