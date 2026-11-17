# Seguridad de Fase 1

## Matriz de acceso

| Rol | Catálogo | Información privada | Escritura |
| --- | --- | --- | --- |
| `anon` | Solo registros efectivamente publicables | Ninguna tabla privada | Ninguna |
| Usuario `authenticated` sin rol de HUT | Misma lectura pública | Cero filas | No puede modificar ni concederse roles |
| Editor activo | Catálogo incluido borradores | Evidencia, decisiones, reportes y auditoría; no tabla de roles | Preparación/editorial ordinaria; sin roles, alias ni retiradas/fusiones sensibles |
| Administrador activo | Catálogo y borradores | Administración autorizada | Incluye roles, alias y decisiones sensibles |
| `service_role` / propietario PostgreSQL | Operación privilegiada | Privilegiada | Exclusivamente servidor/operador confiable; nunca navegador |

Las políticas de UPDATE tienen `USING` y `WITH CHECK`; hay políticas SELECT para que las operaciones autorizadas funcionen. No se conceden DELETE al personal de aplicación: se oculta/archiva. La auditoría no admite INSERT/UPDATE/DELETE directos del personal. El propietario y el rol privilegiado siguen siendo identidades de confianza, no usuarios limitados por RLS.

## Esquema privado y funciones

`private` queda fuera de la lista de esquemas de la Data API. Se otorga `USAGE` para resolver las funciones concretas de política, pero `anon` no recibe SELECT ni INSERT de sus tablas. Los usuarios autenticados tienen grants sujetos a políticas basadas en `auth.uid()` y `private.staff_roles`. La revocación del rol toma efecto sin depender de refrescar metadatos del JWT.

Los predicados de lectura relacional necesitan inspeccionar datos sin volver a entrar recursivamente en sus propias políticas. Por ello se emplean auxiliares `SECURITY DEFINER` en `private`, con nombres totalmente cualificados, `search_path=''` y EXECUTE revocado de PUBLIC. Solo se conceden los predicados de visibilidad/estado que requiere la lectura pública. Estos predicados permiten lectura anónima por diseño y no exigen un usuario autenticado; no retornan evidencias ni motivos internos. Los helpers internos de evidencia y los triggers no son invocables por visitantes.

La autorización de personal sí exige `auth.uid()` y consulta el registro real de roles, sin confiar en `user_metadata`. No hay funciones `SECURITY DEFINER` en `public`. La búsqueda es `SECURITY INVOKER`; la vista usa `security_invoker=true`. Las funciones de trigger solo se ejecutan por las operaciones que ya pasan permisos y RLS.

## Publicación y vigencia

Se comprueban evidencia aprobada y uso permitido, atribuciones requeridas, categoría/servicio, mercado activo, presencia o cobertura y mínimo útil. La vigencia se evalúa al leer; no depende de que una tarea haya modificado un booleano. Los estados `not_served`/`disputed` tienen precedencia territorial específica y nunca se convierten automáticamente en cobertura confirmada.

## Límites y comprobaciones pendientes del entorno remoto

El conector MCP actualmente falla antes de obtener identidad o esquema. No se ha comprobado en el proyecto real la configuración Data API, Auth, grants heredados, extensiones o asesores de seguridad. Antes de aplicar, verificar estos ajustes y ejecutar las consultas de `supabase/verification/inspect.sql` mediante MCP. La configuración local no cambia por sí sola el proyecto alojado.

La protección contra abuso del futuro endpoint de reportes y los límites de tráfico del directorio pertenecen a sus rutas de aplicación. Esta entrega no expone un formulario ni un endpoint sin esos controles.
