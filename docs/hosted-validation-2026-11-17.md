# HUT — Verificación del backend alojado

Fecha: 17 de noviembre de 2026. Proyecto: `hagamos-un-trato-dev`, `lewlduoqmsdnmxfichus`.

## Resultado observado

Las ocho migraciones originales se aplicaron secuencialmente mediante el MCP directo `supabase`, con respuesta `{"success":true}` para cada una. Antes de aplicarlas se verificaron la URL `https://lewlduoqmsdnmxfichus.supabase.co`, PostgreSQL 17.12, ausencia de tablas de aplicación y de migraciones. No se usó `get_project`, administración de organizaciones, conector Supabase de codex_apps, CLI remota, navegador ni Computer Use.

Se recuperaron los 37 archivos del commit `b266c1c487421ad9d2f9b84c2667fd01fd4c6b6b`. Sus Git blob SHA coinciden con el árbol remoto. Los documentos v0.3 originales y sus copias del repositorio solo difieren en los enlaces relativos entre ellos; se leyeron íntegramente ambos. Las ocho huellas SHA-256 coinciden con el informe previo y con los SQL enviados al MCP, sin modificaciones.

| Comprobación remota | Resultado |
| --- | --- |
| Tablas | 18: 12 en public y 6 en private |
| RLS | Habilitada en las 18 |
| Políticas | 64 |
| Claves primarias | 18 |
| Claves foráneas | 39 |
| CHECK | 113 |
| Restricciones totales, incluyendo UNIQUE | 192, todas validadas |
| Índices | 65, ninguno inválido/no preparado |
| Triggers de aplicación | 50 |
| Funciones | 26: 25 privadas y public.search_directory |
| Funciones SECURITY DEFINER en public | 0 |
| Vista pública | directory_company_offerings, security_invoker=true |
| Datos | PA inactivo; 2 categorías; 10 servicios; 0 empresas/ubicaciones/mercados |
| Personal | 0 usuarios Auth y 0 roles HUT |
| Auditoría inicial | 13 eventos de los datos base; sin contactos ni mensajes copiados |
| Asesor de seguridad | 0 avisos |
| Asesor de salud | 0 avisos |

La RPC `search_directory` y la proyección pública funcionan y devuelven cero empresas en el estado inicial. El listado vacío es correcto: no se ha activado un mercado ni cargado empresas.

## Historial y correspondencia de versiones

MCP generó versiones remotas diferentes de las fechas locales. No se alteró manualmente el historial para fingir coincidencia. [remote-migrations.json](../supabase/remote-migrations.json) registra archivo, versión local, versión remota, SHA-256 y respuesta de cada aplicación.

| Versión local | Nombre | Versión remota |
| --- | --- | --- |
| 20261117171305 | foundation | 20261117185358 |
| 20261117171306 | geography_and_markets | 20261117185407 |
| 20261117171307 | categories_and_services | 20261117185410 |
| 20261117171309 | companies_offerings_and_presence | 20261117185412 |
| 20261117171310 | contacts_pages_and_aliases | 20261117185415 |
| 20261117171311 | evidence_and_editorial_administration | 20261117185418 |
| 20261117171312 | integrity_security_and_publication | 20261117185426 |
| 20261117171313 | initial_taxonomy | 20261117185438 |

Antes de futuras operaciones con CLI, reconciliar formalmente esta correspondencia. No ejecutar `supabase db push` ni reejecutar estos archivos solo porque sus versiones locales no figuren literalmente en el historial remoto.

## Pruebas recuperadas y realizadas

[CI sobre 06b6354d](https://github.com/capr1989/hagamos-un-trato-app/actions/runs/44141888198) comprobada mediante GitHub MCP, incluidos los logs del job PostgreSQL: las ocho migraciones se aplicaron en Supabase local/PostgreSQL 17.12 y pasaron **48/48** pruebas; los fixtures se revirtieron. El job source-and-postgres también terminó correctamente. El commit posterior a esa implementación, hasta el origen revisado, no cambió los SQL probados.

En esta sesión pasó `node scripts/check-repository.mjs`: ocho migraciones, 18 tablas, alcance exclusivo de Fase 1 y sin secretos detectados. La reproducción PGlite en esta computadora no se completó: faltan dependencias en caché (`ENOTCACHED`) y la red aislada devolvió `getaddrinfo ENOTFOUND registry.npmjs.org`; el intento adicional de instalación no produjo una instalación utilizable y fue detenido. No se presenta esta limitación como una prueba ejecutada correctamente.

En PostgreSQL alojado, por MCP:
- Lectura real como anon: 2 categorías y 10 servicios; 0 países habilitados, mercados, empresas y filas de búsqueda/proyección.
- Los grants no permiten INSERT anónimo en empresas/reportes, SELECT de evidencia privada ni EXECUTE del helper interno de evidencias.
- Cinco intentos efectivos de acceso indebido (evidencia, reportes, roles, UPDATE anónimo sin filas y helper interno) rechazados con SQLSTATE `42501`.
- Como authenticated con una identidad sin rol HUT, los metadatos editables con `role=admin` no conceden rol; las consultas privadas retornan cero filas.
- Todas las pruebas de rol se hicieron en transacción y finalizaron con ROLLBACK. No se insertaron empresas, geografía ni cuentas Auth ficticias.
- Se generó [database.types.ts](../supabase/database.types.ts) desde el proyecto real.

La primera consulta de diagnóstico fue rechazada por la revisión automática al conservar la restricción del mensaje inicial. Se obtuvo confirmación explícita del usuario en el chat y la misma consulta funcionó; no se eludió la revisión mediante otro método. La descarga genérica de logs devolvió HTTP 400 por endpoint no admitido; se recuperaron con la herramienta específica de logs de GitHub MCP.

## Recomendaciones de rendimiento

Se recibieron tres grupos de avisos:
- 9 FK sin índice de cobertura completa, mayormente revisores/granted_by y combinaciones de empresa/destino privadas. Revisar con el volumen y las operaciones reales antes de añadir índices en una nueva migración.
- 28 índices aún sin uso, esperable en una base recién creada sin empresas; no se eliminaron por esta estadística inicial.
- 12 avisos de múltiples políticas permisivas SELECT para authenticated: published_read y staff_read se combinan intencionadamente para permitir lectura pública y lectura editorial. Puede optimizarse manteniendo exactamente la misma autorización.

No son hallazgos de fuga de información. Se registran como seguimiento de rendimiento y no se cambiaron las ocho migraciones aprobadas ni se aplicaron migraciones adicionales. Referencias: [FK sin índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), [políticas permisivas](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).

## Límites y siguiente tarea del backend

La estructura y los permisos PostgreSQL están implementados; **el piloto público y la operación editorial con usuarios reales no están habilitados**.

1. La configuración alojada de Auth/Data API no fue observable con las herramientas directas disponibles. Las consultas de pgrst.db_schemas y pg_db_role_setting no proporcionaron la lista de esquemas expuestos. Confirmar que private no se expone, exigir privilegios explícitos para nuevas tablas y deshabilitar autorregistro y Auth anónimo antes de operar. La configuración local no cambia la alojada.
2. Crear un usuario Auth real por el procedimiento autorizado e inicializar su rol admin; después probar sesiones reales de admin/editor. No se asignó un rol a una identidad inventada.
3. Documentar el ámbito de Ciudad de Panamá y cargar geografía revisada/mercado en borrador en una futura migración revisada. v0.3 exige esa documentación antes de cargar la ciudad; no se inventaron límites para completar una fila.
4. Cerrar responsable editorial, retención/revisión y criterio de indexación; implementar recepción limitada de reportes y operaciones editoriales transaccionales, con invalidación de cachés.
5. Revisar recomendaciones de rendimiento con datos y carga reales.

No se detectó una diferencia conceptual que requiera cambiar v0.3. La semilla mantiene Panamá inactivo según los SQL previamente aprobados; no se añadió la ciudad sin respaldo documental. No hay empresas ni funcionalidades de fases 2/3, Storage o despliegue público.

El [contrato de backend](BACKEND-CONTRACT.md) diferencia objetos SQL implementados de integración hospedada y recorridos pendientes.
