# Reportes privados — operación y verificación

Entrega de código del 19/11/2026. Migración alojada **pendiente**: tras reautenticar no se exponen herramientas `mcp__supabase__*` en el chat. No se aplicó SQL ni se escribieron datos alojados en esta ampliación. La validación de CI usa PostgreSQL 17 aislado, no el proyecto alojado. Ver contrato exacto en [BACKEND-CONTRACT.md](BACKEND-CONTRACT.md).

## Requisitos para habilitar recepción

1. Recuperar el MCP directo y verificar `lewlduoqmsdnmxfichus`, main y su historial real de migraciones. Comparar la tabla/restricciones/funciones con las diez migraciones previas; preservar cambios concurrentes. Aplicar solo `20261119210627_company_report_ingress.sql` mediante `mcp__supabase__apply_migration`. Registrar versión remota real (puede diferir del prefijo local); no usar db push ni reejecutar las diez anteriores. Verificar RLS en 19 tablas (18 de negocio+contador), 64 políticas y permisos/RPC nuevas; regenerar tipos por MCP. No declarar esto ejecutado sin su respuesta.
2. Aprobar aviso de privacidad, responsable y política de retención; decidir fechas por caso. La propuesta de 90 días no está aprobada automáticamente.
3. Configurar en el **servidor**, fuera de Git: `SUPABASE_SECRET_KEY` del proyecto, `TURNSTILE_SECRET_KEY`, `HUT_REPORTS_ORIGIN_SECRET` aleatorio de al menos 32 caracteres y `HUT_REPORTS_PRIVACY_NOTICE_VERSION` aprobada. Nunca NEXT_PUBLIC para estos secretos.
4. Configurar `HUT_REPORTS_ALLOWED_ORIGINS` como lista de orígenes exactos sin barra final/ruta, y `HUT_REPORTS_ALLOWED_HOSTNAMES` con hostname exacto que Turnstile validará. Preparar widget con acción `company_report`; su site key pública y formulario corresponden al futuro frontend. No usar tokens de prueba para afirmar una verificación real.
5. Para el hosting futuro Vercel: `HUT_REPORTS_IP_SOURCE=vercel`, cabecera sobrescrita por la plataforma y VERCEL=1 real. Revisar proxy directo, WAF, protección de cuerpo/tiempos, secretos y logs. No desplegado por esta entrega.
6. Preparar mantenimiento horario de `maintain_company_report_ingress` mediante operador seguro, con vigilancia y drenaje de lotes vencidos. No hay tarea externa configurada. La recepción ejecuta limpieza parcial, que no asegura eliminación puntual cuando no hay tráfico.
7. Solo tras verificar estos puntos, `HUT_REPORTS_ENABLED=true`. Por defecto y sin configuración responde 503, sin tocar DB ni CAPTCHA. No se modifica `.env.local` ni se inventa una clave de operador para habilitarlo.

## Prueba manual sin exponer fixtures

Con la configuración actual cerrada, ejecutar `npm run qa:dev` desde `C:\Users\Carlos Pretto\Dev\hagamos-un-trato-app`. Desde otra consola:

```powershell
$headers = @{ Origin = 'http://127.0.0.1:3000' }
Invoke-WebRequest -Method Post -Uri 'http://127.0.0.1:3000/api/company-reports' -Headers $headers -ContentType 'application/json' -Body '{}'
# Esperado: 503 mientras HUT_REPORTS_ENABLED/configuración no estén completos.
```

Para probar positivamente **después** de aplicar la migración y cerrar dependencias:

1. Usar `npm run qa:dev` (desarrollo). Para ensayo local configurar IP source `loopback`, QA habilitado, origen `http://127.0.0.1:3000`, hostname Turnstile correspondiente y el resto de secretos/aviso. Esto mantiene CAPTCHA real; no hay bypass. No usar npm build/start de producción con loopback: se rechaza deliberadamente.
2. Obtener un token real fresco con el widget/origen permitido y acción company_report. No pegarlo en Git, logs o este documento. Obtener UUID de una empresa **real ya publicable**, sin cambiar sus estados ni crear una ficticia pública. Si no existe ninguna, el positivo alojado queda NOT TESTED: ejecutar las suites aisladas en su lugar.
3. En PowerShell reemplazar valores en memoria, sin guardar cargas privadas en archivos de diagnóstico:

```powershell
$report = @{
  company_id = '<UUID_PUBLICO_REAL>'
  report_type = 'no_response'
  message = 'Descripción mínima autorizada para una prueba de recepción.'
  turnstile_token = '<TOKEN_REAL_FRESCO>'
} | ConvertTo-Json
Invoke-WebRequest -Method Post -Uri 'http://127.0.0.1:3000/api/company-reports' -Headers $headers -ContentType 'application/json' -Body $report
Remove-Variable report
# Esperado: 202, confirmación genérica sin UUID, email ni texto privado.
```

4. Con token **nuevo** repetir empresa/tipo/mismo texto antes de 15 min: mismo 202, una fila con contador incrementado. Reutilizar token consumido debe recibir 403. Intento cuarto del mismo origen/empresa en la hora recibe 429; otros límites: cinco/10 min y veinte/día. No hacer un ataque o carga masiva al proyecto real.
5. Iniciar sesión personalmente en `/internal/qa`. Revisión editorial → Correcciones y solicitudes de retirada: filtrar tipo, estado y empresa; activar repetidos. Editar new→in_review→dismissed o resolved con acción y resumen mínimo, sin sanción automática. Comprobar auditoría y que el catálogo siga igual; las decisiones de ocultación/retirada son operaciones humanas separadas. No copiar acusaciones sin verificar en campos públicos.
6. Admin puede ejecutar **Depurar datos personales vencidos** solo tras aprobar fecha de un caso cerrado. Verificar mensaje/email nulos y resumen/auditoría mínimos. No adelantar fechas ni purgar datos reales solo para demostrar la prueba; probar ese caso en suites aisladas.
7. No intentar publicar QA TEST. La suite crea casos positivos solo dentro de una transacción local que revierte. No hay fixtures publicados en el proyecto remoto.

## Pruebas automatizadas y alcance de evidencia

`npm run validate`: comprobación de repositorio, TypeScript, 14 QA, 13 HTTP/antibot y 79 casos PGlite (64 anteriores+15 nuevos). Las pruebas de HTTP invocan Request/Response sin sesión, una de ellas inserta mediante SQL real en PGlite; CAPTCHA está simulado deliberadamente en fixtures y su validador se prueba con respuestas controladas. No equivale a Siteverify alojado real.

`npm run build`: compilación Next de producción. `npm run test:db:supabase-local`: mismos 79 casos en PostgreSQL local 17 y prueba extra con doce conexiones independientes (cinco aceptaciones, siete límites), elimina sus contadores al acabar; las empresas/demás fixtures se revierten. Solo permite loopback:54322/postgres, jamás un URL alojado. En este equipo el daemon Docker no estaba iniciado; esa suite se ejecuta en CI aislada y su resultado se informa por separado.

`npm run reports:smoke-http`, después del build, inicia un Next de producción en un puerto loopback libre, fuerza la recepción deshabilitada y verifica el 503 genérico sin acceder a Supabase ni necesitar credenciales. También se ejecuta en CI. La evidencia inicial está en `supabase/report-verification.json`; no convierte un resultado de CI pendiente en PASS.

Pendientes alojados: conexión MCP, aplicación/inspección remota y tipos, recepción positiva real con Turnstile/empresa publicable, cabeceras del hosting, tarea de mantenimiento y decisiones de privacidad. No se ha desplegado ni habilitado recepción pública.
