# Franquicias Exitosas · Portal ESCALA

Plataforma donde el consultor gestiona proyectos de franquiciamiento con el **Método ESCALA®** ("Estructura · Desarrolla · Expande") y cada cliente ve en línea, en tiempo real, el avance de su proyecto.

- Modelo de datos y mapa de pantallas aprobados: [`docs/01-modelo-de-datos-y-pantallas.md`](docs/01-modelo-de-datos-y-pantallas.md)
- Stack: Next.js 16 (App Router) + TypeScript + Tailwind 4 · Supabase (Postgres, Auth con enlace mágico, Storage, Realtime) · Vercel.

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| A | Autenticación, roles, clientes, proyectos, plantilla ESCALA, dashboard del cliente, consola del consultor | ✅ |
| B | Gantt, tareas, entregables, actas de puerta, solicitudes de información | Esquema listo; pantallas pendientes |
| C | Matriz, competidores, modelo financiero, bitácora, honorarios, informes, notificaciones | Esquema listo; pantallas pendientes |

## Base de datos (`supabase/`)

| Archivo | Contenido |
|---|---|
| `migrations/0001_core.sql` | Tipos, perfiles, clientes, proyectos, marcas, archivos, comentarios, actividad, notificaciones |
| `migrations/0002_escala_template.sql` | Plantilla ESCALA: 6 pasos, 5 puertas, tareas, entregables, solicitudes, 9 criterios, 53 secciones del manual |
| `migrations/0003_execution.sql` | Pasos y puertas por marca, actas, tareas, entregables, solicitudes, reuniones, decisiones, **reglas 5 y 6**, creación desde la plantilla y aprobaciones del cliente |
| `migrations/0004_analytics.sql` | Matriz, competidores, modelo financiero, manual, unidades y auditorías (**reglas 1, 2 y 4**) |
| `migrations/0005_fees_reports.sql` | Honorarios, estado de cuenta, **regla 7**, informes y resumen del dashboard |
| `migrations/0006_rls.sql` | Row Level Security en todas las tablas |
| `migrations/0007_storage_realtime.sql` | Buckets de Storage y Realtime |
| `migrations/0008_seed_demo_function.sql` | Función `seed_demo_escala()` para cargar el ejemplo Kfresas y Vaca Lechera |
| `migrations/0009_hardening.sql` | Ajustes del Security/Performance Advisor (funciones internas no expuestas, índices) |
| `seed.sql` | Cómo cargar el ejemplo |

Las reglas ESCALA se aplican en la base de datos, no solo en la pantalla:

1. Toda cifra lleva etiqueta (`comprobado` / `estimacion` / `supuesto`); un valor vacío se muestra como **[POR CONFIRMAR]**.
2. No se guarda el canon ni la regalía sin validar el payback.
3. Cada marca marca su formato de entrada.
4. Todo hallazgo de auditoría apunta a una sección del manual.
5. El paso A (Atraer) queda bloqueado sin marca registrada.
6. Un paso no se cierra sin el acta de su puerta aprobada por el cliente.
7. Un entregable se descarga solo si su cuota está pagada.

## 1. Configurar Supabase

1. Crea el proyecto en [supabase.com](https://supabase.com). Región recomendada: **South America (São Paulo)**.
2. En **SQL Editor**, ejecuta en orden los archivos de `supabase/migrations/` (0001 → 0009). Con la CLI: `supabase link` y `supabase db push`.
   > El proyecto de producción `mtwrkhtruwxxevamaqzc` ya tiene aplicadas las 9 migraciones.
3. **Authentication → Sign In / Providers**: deja **Email** activo y **desactiva "Allow new users to sign up"**. Solo entran las personas que invita el consultor.
4. **Authentication → URL Configuration**:
   - Site URL: `https://tu-dominio` (en local, `http://localhost:3000`).
   - Redirect URLs: `https://tu-dominio/**` y `http://localhost:3000/**`.
5. **Authentication → Email Templates**: para que el enlace funcione aunque se abra en otro dispositivo, cambia el enlace de las plantillas:
   - *Magic Link*: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
   - *Invite user*: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
6. **Authentication → SMTP** (recomendado en producción): configura un remitente propio (por ejemplo, Resend con tu dominio). El correo integrado de Supabase tiene un límite bajo de envíos por hora.
7. Crea al consultor: **Authentication → Users → Invite user** con tu correo. Luego, en el SQL Editor:
   ```sql
   update public.profiles set role = 'admin', full_name = 'Renzo Parada' where email = 'tu-correo@...';
   ```
8. (Opcional) Carga el ejemplo. Primero invita también al cliente y después ejecuta:
   ```sql
   select public.seed_demo_escala('correo-del-consultor', 'correo-del-cliente');
   ```

## 2. Variables de entorno

Copia `.env.example` a `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=        # Project Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # clave pública (anon / publishable)
SUPABASE_SERVICE_ROLE_KEY=       # solo servidor: invitar usuarios
NEXT_PUBLIC_SITE_URL=            # http://localhost:3000 o el dominio final
```

## 3. Desarrollo local

```bash
npm install
npm run dev
```

## 4. Despliegue en Vercel

1. En Vercel: **Add New → Project** e importa este repositorio. Vercel detecta Next.js.
2. Carga las 4 variables de entorno de la sección 2 (`NEXT_PUBLIC_SITE_URL` = dominio de producción).
3. Despliega. Después agrega el dominio en **Settings → Domains** y actualiza la *Site URL* y las *Redirect URLs* de Supabase.

## Estructura

```
src/
  app/
    login/, auth/{callback,confirm,signout}     acceso con enlace mágico
    portal/[projectId]/                         portal del cliente (dashboard)
    consultor/                                  consola: cartera, clientes, equipo, plantilla
    consultor/proyectos/nuevo/                  crear proyecto desde la plantilla
    consultor/p/[projectId]/                    consola de cada proyecto
  components/{ui,escala,portal,layout,consultor}
  lib/{supabase,auth.ts,escala.ts,format.ts}
  proxy.ts                                      sesión y protección de rutas
supabase/{migrations,seed.sql}
```
