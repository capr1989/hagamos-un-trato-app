# Proyecto HUT de desarrollo y migraciones por MCP directo

## Destino y estado verificados

Proyecto permitido: `hagamos-un-trato-dev`, `lewlduoqmsdnmxfichus`. La URL obtenida por `mcp__supabase__get_project_url` es `https://lewlduoqmsdnmxfichus.supabase.co`; SQL confirmó PostgreSQL 17.12. Nombre comercial, organización Carlos Pretto y región us-east-1 proceden del usuario; no se consultaron herramientas de administración de cuentas.

El 17 de noviembre de 2026 se aplicaron las ocho migraciones originales, sin cambios, mediante `mcp__supabase__apply_migration`. Ver [validación alojada](hosted-validation-2026-11-17.md), [contrato](BACKEND-CONTRACT.md) y [correspondencia de versiones](../supabase/remote-migrations.json).

No utilizar el conector Supabase de codex_apps, `get_project` ni herramientas de organización. El servidor directo está vinculado a `project_ref=lewlduoqmsdnmxfichus`; sus herramientas de SQL/migración no reciben project_id. Confirmar el destino real en cada nueva sesión antes de escribir.

## Procedimiento para futuras migraciones

1. Ejecutar `list_tables` para public/private y `list_migrations`, y comprobar `get_project_url`. Detenerse si el ref de la URL no coincide.
2. Leer arquitectura/diccionario aprobados, migraciones y [remote-migrations.json](../supabase/remote-migrations.json). Revisar cambios recientes de GitHub y no sobrescribir frontend ni migraciones aplicadas.
3. Comparar esquema e historial reales. El MCP generó versiones remotas distintas de los prefijos locales; esta diferencia está registrada. No reejecutar las ocho migraciones ni hacer reparación automática del historial.
4. Redactar una nueva migración aditiva y probarla localmente antes de aplicarla. Descubrir comandos CLI con --help; usar CLI únicamente para desarrollo/pruebas locales. Nunca hacer reset remoto.
5. Aplicar SQL revisado por `mcp__supabase__apply_migration({ name, query })`, secuencialmente, dentro del alcance autorizado por el usuario. Ante un error material, detener las dependientes y registrar el error exacto.
6. Guardar archivo, SHA-256, nombre, resultado y versión remota. No alterar manualmente versiones para simular coincidencia.
7. Volver a inspeccionar tablas, constraints, índices, RLS, políticas, grants, triggers y funciones mediante MCP; comprobar asesores y pruebas de acceso. No sembrar empresas ficticias en el entorno alojado.
8. Generar tipos TypeScript desde la base real y actualizar el contrato solo con objetos existentes.

Si MCP falla, informar antes de operaciones dependientes. No recurrir a CLI remota, REST, conexión PostgreSQL externa o dashboard como alternativa.

## Configuración hospedada pendiente

`supabase/config.toml` configura solo el stack local. En el proyecto alojado aún debe confirmarse que la Data API expone public y no private, que nuevas tablas exigen grants explícitos y que Auth tiene autorregistro y acceso anónimo deshabilitados. Las herramientas directas de esta sesión no ofrecen lectura/edición de esos ajustes y SQL no devolvió la lista efectiva de esquemas expuestos.

No hay usuarios Auth ni personal HUT. El primer admin debe vincularse a una cuenta real mediante una operación controlada y auditada; no sembrar contraseñas o identidades ficticias. Después se probarán sesiones reales de admin y editor.

La delimitación documental de Ciudad de Panamá es requisito para cargar su geografía y un mercado en borrador. Panamá permanece inactivo; no hay mercado habilitado ni empresas.

## Separación de responsabilidades

Las operaciones externas usan Supabase MCP directo y GitHub MCP. No se ejecutó supabase link, no hay integración automática GitHub–Supabase ni despliegue público. No se modifican otros proyectos, frontend ni branding. Storage y Realtime no son necesarios para esta entrega.

El contrato público usa el rol anon o la sesión limitada correspondiente. Nunca entregar credenciales privilegiadas al frontend ni persistir datos de reportes en analítica.
