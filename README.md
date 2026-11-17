# Hagamos un Trato — aplicación y base de datos

Infraestructura inicial de Fase 1: directorio público de aire acondicionado y energía solar para Ciudad de Panamá. La fuente de verdad es la arquitectura y el diccionario **v0.3 aprobados**. No hay captación de clientes, leads, matching comercial, suscripciones, pagos ni despliegue público.

## Estado real

- Ocho migraciones versionadas, generadas con Supabase CLI 3.2.0 y validadas localmente.
- Dieciocho tablas de aplicación, RLS, integridad, índices, lectura pública condicionada y administración editorial privada.
- Baseline de 44 pruebas y cuatro regresiones adicionales: 48/48 correctas tanto en PGlite como en Supabase local/PostgreSQL 17.12 dentro de GitHub Actions. Los resultados y el commit validado están en `docs/validation-report.md`.
- Proyecto objetivo comunicado por el usuario: `hagamos-un-trato-dev`, `lewlduoqmsdnmxfichus`, región `us-east-1`, PostgreSQL 17.
- El conector Supabase MCP devuelve `Unknown tool` al consultar ese proyecto. No se afirma que las migraciones estén aplicadas ni que exista una vinculación operativa.
- No se incluyen empresas, límites geográficos inventados ni mercados activos. La taxonomía aprobada contiene dos categorías y diez servicios; Panamá se incorpora inactivo.
- La página Next.js es solo una señal de preparación, con `noindex`. No se ha publicado la aplicación ni activado analítica.

## Desarrollo y validación local

Requiere Node 24.19.0 y npm. Las dependencias están fijadas y `package-lock.json` está versionado.

```sh
npm ci
npm run validate
npm run build
npm run dev
```

`npm run test:db` reconstruye PostgreSQL en memoria con PGlite, aplica los ocho SQL y ejecuta las pruebas. El pequeño shim de Auth vive exclusivamente en `tests/database/bootstrap.pglite.sql`; nunca se aplica a Supabase. Estas pruebas son complementarias y no sustituyen la verificación remota.

Con Docker activo se puede ejecutar Supabase **local**:

```sh
npm run db:local:start
npm run db:local:reset
npm run test:db:supabase-local
npm run db:local:stop
```

El reset afecta solamente al stack local de este directorio. La CLI fijada v3 usa destino local por defecto. El runner de pruebas SQL contra Supabase solo admite loopback en el puerto 54322 y rechaza URLs remotas. Los fixtures llevan etiquetas `TEST ONLY`, dominios `.invalid` y se revierten transaccionalmente.

## Estructura

```text
.github/workflows/validate.yml   Validación, sin despliegues
src/app/                       Base mínima de Next.js
src/lib/supabase/               Cliente de lectura pública para servidor
supabase/config.toml           Configuración del stack local
supabase/project.dev.json      Identidad objetivo; no contiene secretos
supabase/migrations/            Ocho migraciones ordenadas por dependencia
supabase/seed.sql               Vacío deliberadamente
tests/database/                Pruebas SQL y shim exclusivo de PGlite
scripts/check-repository.mjs    Comprobaciones de alcance y secretos
docs/                          Arquitectura aprobada, seguridad y operación
```

## Datos públicos y seguridad

Presencia física documentada y cobertura confirmada son independientes. Una empresa puede incluirse por cualquiera de ellas, con evidencia y reutilización permitida; la ausencia de cobertura se calcula como `unconfirmed`. Las exclusiones `not_served` y los conflictos `disputed` no se reinterpretan como atención local.

La lectura pública exige además identidad/categoría, utilidad mínima, estados de publicación y control editorial válidos. Los contactos vencidos dejan de generar botones aunque no haya corrido un mantenimiento. El filtro de servicio exige relación con su categoría y excluye negativas/conflictos de cobertura. Las consultas no duplican empresas que tienen presencia y cobertura.

`private` no se expone en la Data API. Las funciones auxiliares de política devuelven únicamente visibilidad o estado publicable; no devuelven evidencia, reportes o motivos internos. Ver [seguridad](docs/security.md) para privilegios y justificación.

## Proyecto de desarrollo y migraciones remotas

La identidad está registrada en `supabase/project.dev.json`. Esto **no** instala la integración GitHub–Supabase, no habilita sincronización y no demuestra una conexión remota. Nunca se modifica `project_id` del stack local para fingir una vinculación.

Las operaciones externas se realizan exclusivamente por MCP. Antes de aplicar, consultar la identidad real y las tablas/migraciones existentes; si no coincide el ID o aparece `Unknown tool`, detener esa secuencia. No usar CLI, SQL directo de red ni dashboards como alternativa. Ver [procedimiento de Supabase](docs/supabase-development.md).

Copiar `.env.example` a `.env.local` solo para desarrollo y completar la clave **publishable** cuando se haya verificado el proyecto. No subir archivos `.env` reales, tokens, contraseñas ni claves secretas. No se solicitan secretos para superar limitaciones del conector.

## Referencias de diseño y convenciones

- [Arquitectura aprobada v0.3](docs/architecture-v0.3.md)
- [Diccionario aprobado v0.3](docs/data-dictionary-v0.3.md)
- [Mapa de implementación](docs/implementation.md)
- [Resultados y límites de validación](docs/validation-report.md)
- [Migraciones locales de Supabase](https://supabase.com/docs/guides/local-development/database-migrations)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Seguridad de la Data API](https://supabase.com/docs/guides/api/securing-your-api)

El branding sigue separado en `capr1989/hagamos-un-trato-brand`; no se ha modificado ni copiado su contenido.
