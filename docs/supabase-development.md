# Proyecto HUT de desarrollo y aplicación de migraciones

## Destino permitido

- Nombre: `hagamos-un-trato-dev`.
- Project ID: `lewlduoqmsdnmxfichus`.
- Organización comunicada: Carlos Pretto.
- Región comunicada: `us-east-1`; PostgreSQL 17; estado comunicado: `ACTIVE_HEALTHY`.
- [Dashboard de referencia](https://supabase.com/dashboard/project/lewlduoqmsdnmxfichus).

Estos datos proceden del usuario. La llamada real `codex_apps/supabase.get_project` con este ID devuelve `-32001: Unknown tool({"name":"supabase.get_project"})` en esta sesión. La identidad remota no se declara verificada por Codex mientras persista el error.

`supabase/project.dev.json` registra la referencia sin secretos. `supabase/config.toml` configura únicamente el stack local. No se ejecutó `supabase link`, no se instaló una integración GitHub–Supabase y no hay despliegue o sincronización automática. No se crearán otros proyectos.

## Procedimiento MCP cuando el conector vuelva a funcionar

1. Consultar `get_project` y confirmar ID, nombre, región, motor y estado; usar exclusivamente el ID indicado.
2. Consultar `list_tables` para `public` y `private`, `list_migrations` y los asesores. No asumir una base vacía porque el proyecto sea nuevo.
3. Comparar las migraciones existentes con estos archivos. Si hay diferencias, detenerse y reconciliarlas sin DROP ni resets remotos.
4. Con validación local satisfactoria, aplicar secuencialmente los ocho SQL mediante `apply_migration`, con `project_id=lewlduoqmsdnmxfichus`. Ante un error no ejecutar las dependientes ni improvisar cambios destructivos.
5. Registrar la versión remota devuelta por cada llamada junto con el nombre local y el SHA-256 del contenido. El API MCP puede generar su propia versión; no modificar manualmente el historial para fingir coincidencia. Antes de futuras migraciones por CLI se tendrá que reconciliar esa relación de versiones por un procedimiento revisado.
6. Consultar de nuevo tablas y migraciones, ejecutar `supabase/verification/inspect.sql` por `execute_sql` y obtener los asesores de seguridad/rendimiento. Registrar resultados reales y resolver avisos pertinentes.
7. Probar anon y personal con transacciones/fixtures de prueba reversibles cuando esté permitido. No subir empresas ficticias como datos iniciales ni habilitar el mercado público.
8. Generar los tipos TypeScript desde el esquema comprobado mediante MCP y versionarlos. No generar tipos fingiendo que una base remota no inspeccionada ya contiene estas tablas.

Si continúa `Unknown tool`, no intentar operar Supabase mediante CLI, REST, conexión PostgreSQL externa, dashboards o navegador. No solicitar credenciales para eludir el conector. GitHub MCP y las pruebas locales pueden completarse independientemente y se reportará el estado remoto como pendiente.

## Configuración del proyecto antes de usarlo

Una vez verificable el entorno, comprobar que la Data API expone `public` y no `private`, que no se otorga acceso automático a nuevas tablas y que los registros administrativos se crean por un operador autorizado. Deshabilitar autorregistro público y Auth anónimo para Fase 1. La cuenta inicial de administrador se vinculará a un usuario Auth real; nunca se sembrará una contraseña ni un usuario ficticio desde las migraciones.

Storage, Realtime y analítica de almacenamiento no son necesarios para estas migraciones. No habilitar servicios o planes adicionales por defecto. El costo del proyecto ya creado no puede verificarse mientras MCP no responda; no se ha contratado nada adicional durante esta preparación. GitHub Actions usa los recursos del plan de la cuenta y puede consumir su cuota; este repositorio no configura pagos ni amplía presupuestos.
