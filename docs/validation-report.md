# Resultados de validación — 17 de noviembre de 2026

## Resultado local observado

| Comprobación | Resultado |
| --- | --- |
| Ocho migraciones ejecutadas en orden desde una base vacía | Correcto |
| Las 44 pruebas originales después de corregir el trigger | 44/44 correctas |
| Suite final con cuatro regresiones adicionales | 48/48 correctas |
| Alcance de Fase 1, RLS de 18 tablas, dependencias fijadas y revisión básica de secretos | Correcto |
| TypeScript (`tsc --noEmit`) | Correcto |
| Compilación local (`next build`, Next.js 16.4.6) | Correcto; sin despliegue |
| Supabase local completo en esta computadora | No ejecutado: Docker instalado, motor detenido/no disponible |
| Supabase local en GitHub Actions, PostgreSQL 17.12 | 48/48 correctas; las ocho migraciones se aplicaron durante el arranque y el reset local |
| Proyecto Supabase remoto | No verificado por Codex: MCP devuelve `Unknown tool` |
| Migraciones aplicadas al proyecto remoto por este agente | Ninguna |

En esta computadora la ejecución usó **PostgreSQL 18.6, PGlite 0.5.16**. Posteriormente, [GitHub Actions ejecutó ambos jobs correctamente](https://github.com/capr1989/hagamos-un-trato-app/actions/runs/44141888198) sobre el commit `06b6354db5a55b4bdbca36b0f5ef3b4b7fb27672`: `source-and-postgres` validó alcance, TypeScript, 48 pruebas PGlite y build; `supabase-local` inició un stack aislado con la imagen `public.ecr.aws/supabase/postgres:17.12.0.000`, reconstruyó la base con las ocho migraciones y pasó 48/48 pruebas. Los fixtures se revirtieron y el stack se detuvo. Los jobs observados fueron `134246578612` y `134246579474`.

Ese PostgreSQL 17 se ejecutó como contenedor local del runner de GitHub; **no es el proyecto alojado HUT**. Ninguna de estas pruebas sustituye la identificación y verificación remotas pendientes por Supabase MCP.

## Correcciones de implementación

El trigger compartido intentaba resolver `NEW.value` sobre `directory_pages`. Se separó la evaluación por tabla antes de acceder a campos exclusivos de contactos. Se conservaron los nombres y versiones de los ocho borradores aún no aplicados.

La revisión añadió controles de implementación coherentes con v0.3: impedir renovaciones de contacto basadas en evidencia anterior, conservar la empresa de evidencias de cobertura incluso al reparentar registros y exigir autorización administrativa también al insertar decisiones sensibles. No se modificó la arquitectura aprobada ni se añadieron tablas o funcionalidades de fases posteriores.

## Pruebas verificables

La suite `tests/database/run.mjs` cubre integridad territorial y de categorías, unicidad con opcionales, contactos, evidencias y atribución, publicación por presencia O cobertura, estados de cobertura, filtros, duplicados/fusiones/alias, retiradas, reportes privados, auditoría y permisos anon/editor/admin. Las cuatro regresiones adicionales comprueban inserción válida de páginas, revisión reciente de contactos, reparentado con evidencia antigua y autorización de inserción editorial sensible.

Los fixtures se crean en transacción, usan nombres `TEST ONLY` y dominios `.invalid`, y se revierten al terminar. El runner de Supabase local rechaza destinos distintos de loopback:54322/postgres. No se insertaron fixtures o empresas en servicios remotos.

## Estado MCP y configuración

`get_project` para `lewlduoqmsdnmxfichus` falló con `-32001: Unknown tool` tanto en la conexión `Supabase` como en `Primary`. Eso no verifica ni deniega permisos de escritura: la herramienta no se resuelve. El ID, región y estado operativo comunicado están documentados como información proporcionada por el usuario, no como resultados de una consulta completada por Codex.

No se ejecutaron `create_project`, `apply_migration` ni operaciones alternativas por red/CLI/UI. No se tocaron otros proyectos o el repositorio de branding. El mercado público no está activado.

## Huellas de los SQL validados

| Archivo | SHA-256 |
| --- | --- |
| `20261117171305_foundation.sql` | `5f3c64c649d91bd39d6f07f44175c14a5d174ce920fb11380d53a0cc14612ecc` |
| `20261117171306_geography_and_markets.sql` | `4de959197450784e33328470232dfbccc80b5620269cd542991211c4e0b14f34` |
| `20261117171307_categories_and_services.sql` | `752a86c90cd048fd76e8378a2f9e0e04da1e7870beb7183066394c422e3bc6fb` |
| `20261117171309_companies_offerings_and_presence.sql` | `cbb1f25564b0eb45ebd1fed7a856729b5912843936af210a7c62f5372f6a9641` |
| `20261117171310_contacts_pages_and_aliases.sql` | `902bd6181ab46b864fe6ca56093e12413805f3640189767d0ab8e8b516550583` |
| `20261117171311_evidence_and_editorial_administration.sql` | `fed25f7de463f06f0de6398f9323fb64c65f6d3faaf4b34db1123c27d9c74874` |
| `20261117171312_integrity_security_and_publication.sql` | `24d702c0bca843611b59b55b37df6566ca57d7e330cf4dd5f351989073b9a414` |
| `20261117171313_initial_taxonomy.sql` | `d63ae732ad30fb83b5ba0f5669e73287c94955f741241e36100597d5a414cc35` |

## Límites pendientes de aplicación

La base y los permisos soportan los procesos editoriales. Las interfaces y rutas de administración, el endpoint limitado de reportes, la invalidación de cachés al editar y los procesos de retención se implementarán en la etapa de aplicación. Ninguno aparece como operativo en la página inicial. La geografía documental y la activación pública siguen pendientes de revisión.
