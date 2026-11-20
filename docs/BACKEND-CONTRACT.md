# HUT — Contrato del backend de Fase 1

Verificado el 17 de noviembre de 2026 en `lewlduoqmsdnmxfichus` (`hagamos-un-trato-dev`), PostgreSQL 17.12. Fuente conceptual: [arquitectura v0.3](architecture-v0.3.md) y [diccionario v0.3](data-dictionary-v0.3.md).

## Estado de integración

**Instantánea alojada histórica del 17/11, anterior al aprovisionamiento del administrador:** diez migraciones (ocho basales y dos de QA), 18 tablas con RLS, 64 políticas, una vista pública, la RPC pública search_directory y diez funciones QA restringidas a personal u operador. Datos iniciales: Panamá inactivo, dos categorías activas, diez servicios activos. No existen empresas, ubicaciones, mercados ni usuarios Auth. Por eso los listados de empresas devuelven `[]`.

**Pendiente antes de habilitar la aplicación:** comprobar la configuración alojada de esquemas expuestos de Data API y Auth (registro público y acceso anónimo de Auth deshabilitados), crear por operación controlada al personal real y conceder sus roles, documentar la delimitación de Ciudad de Panamá, cargar geografía revisada y mercado en borrador. La configuración local solo expone `public`; no demuestra la configuración alojada. Las herramientas MCP disponibles no exponen los ajustes hospedados de Auth/Data API. No se afirma una prueba HTTP con clave publishable ni inicio de sesión real de personal.

Este contrato documenta objetos SQL existentes. Hay un panel interno temporal en /internal/qa y una ruta de servidor protegida /internal/qa/api; ver [QA-PANEL.md](QA-PANEL.md). La publicación revisada dispone de qa_publication_check y qa_publish_company para personal activo. La ampliación de reportes del 19/11 implementa recepción pública en código; su migración se aplicó al proyecto Dev el 20/11/2026, pero el endpoint continúa deshabilitado. No hay RPC de fusión con traslado automático de hechos. No hay clientes, cuentas empresariales, reclamaciones, leads, pagos ni Storage.

## Acceso y autenticación

| Identidad | Lectura | Escritura |
| --- | --- | --- |
| `anon` | Taxonomía activa y catálogo efectivamente publicable por RLS | Ninguna |
| `authenticated` sin rol HUT | La misma lectura pública; cero filas privadas | Rechazada por RLS |
| Editor HUT activo | Catálogo y borradores; fuentes, evidencia, decisiones, reportes y auditoría | Inserción/actualización editorial ordinaria; sin DELETE, roles ni alias |
| Administrador HUT activo | Lectura editorial; gestión de roles | Incluye roles, alias, retiradas/fusiones/reactivaciones sensibles |
| Operador PostgreSQL / `service_role` | Privilegiada | Solo operación de servidor autorizada; nunca cliente público |

La autorización consulta `private.staff_roles` con `auth.uid()`; no consulta `user_metadata`. La suspensión de personal se comprueba en cada acceso. Los permisos SQL no hacen que `private` esté expuesto por Data API. La administración privada necesita una vía de servidor expresamente implementada; no se debe resolver exponiendo el esquema privado ni entregando una clave privilegiada al frontend.

RLS se aplica también a tablas hijas y a la vista `security_invoker`. No usar `service_role` para servir el directorio público: omitiría las restricciones de publicación. Un listado vacío es una respuesta válida y no autoriza reintentar con una clave privilegiada.

## Búsqueda pública implementada

`public.search_directory` es una función SQL `STABLE SECURITY INVOKER`, con `search_path=''` y EXECUTE concedido a `anon` y `authenticated`.

| Parámetro | Tipo PostgreSQL | Predeterminado | Uso |
| --- | --- | --- | --- |
| `p_market_code` | text | Obligatorio | Código del mercado activo |
| `p_category_id` | uuid | NULL | Filtro exacto de categoría |
| `p_service_id` | uuid | NULL | Servicio exacto; no incluye ofertas sin servicio ni cobertura `not_served`/`disputed` |
| `p_query` | text | NULL | Búsqueda de nombre/descripción mediante texto completo español; hasta 200 caracteres usados |
| `p_confirmed_only` | boolean | false | Solo cobertura confirmada para las ofertas que cumplen los demás filtros |
| `p_presence_only` | boolean | false | Solo presencia física documentada |
| `p_limit` | integer | 20 | Se limita a 1–100; NULL usa 20 |
| `p_offset` | integer | 0 | Se limita a 0–10000; NULL usa 0 |

Si se usan filtros UUID, resolverlos desde taxonomía activa. Un servicio pertenece a una categoría; sus códigos solo son únicos dentro de ella. Filtros de categoría/servicio incompatibles o un mercado inexistente/inactivo producen cero filas. Usar booleanos concretos, no NULL.

Resultado: `company_id uuid`, `trade_name text`, `company_slug text`, `has_documented_presence boolean`, `has_confirmed_coverage boolean`. Una fila por empresa; orden por nombre comercial en minúsculas e ID. La RPC no devuelve total, siguiente cursor ni ranking. No inventar esos campos.

```sql
-- La respuesta actual es cero filas porque aún no existe un mercado habilitado.
select * from public.search_directory(
  p_market_code => 'pa_ciudad_panama',
  p_confirmed_only => false,
  p_presence_only => false,
  p_limit => 20,
  p_offset => 0
);
```

La forma de consumo con el cliente Supabase, una vez validada la Data API hospedada y configurada su clave publishable, es:

```ts
const { data, error } = await supabase.rpc('search_directory', {
  p_market_code: 'pa_ciudad_panama',
  p_category_id: categoryId, // UUID de categories; omitir si no se filtra
  p_service_id: serviceId,   // UUID de services; omitir si no se filtra
  p_confirmed_only: false,
  p_presence_only: false,
  p_limit: 20,
  p_offset: 0,
});
if (error) throw error;
// data === [] en el estado inicial actual.
```

No persistir búsquedas libres, teléfonos, correos, URLs completas o reportes en analítica. Si se muestra atribución aprobada, obtenerla de los campos públicos correspondientes.

## Vista y lectura de perfiles

`public.directory_company_offerings` usa `security_invoker=true` y respeta RLS. Sus campos son:

| Campo | Tipo SQL | Significado |
| --- | --- | --- |
| `company_id` | uuid | Empresa |
| `trade_name` | text | Nombre comercial |
| `company_slug` | text | Slug canónico |
| `offering_id` | uuid | Oferta |
| `category_id` | uuid | Categoría |
| `service_id` | uuid, nullable | Servicio específico, si consta |
| `market_id` | uuid | Mercado |
| `market_code` | text | Código de mercado |
| `has_documented_presence` | boolean | Presencia documentada en ese mercado |
| `coverage_status` | text | `confirmed`, `not_served`, `disputed` o `unconfirmed` |
| `has_confirmed_coverage` | boolean | Cobertura confirmada de esta oferta y mercado |

La vista contiene una fila por oferta/mercado, no por empresa. No usar su número de filas como conteo de empresas. Para filtros de servicio excluir expresamente `not_served` y `disputed`, o utilizar la RPC que ya lo hace. En categoría puede conservarse una empresa con presencia física documentada aunque algún servicio esté excluido; mostrar el estado y no prometer atención.

```sql
select * from public.directory_company_offerings
where market_code = 'pa_ciudad_panama'
order by trade_name, company_id, offering_id;
```

Resolver un perfil por `public.companies.slug` con el rol público; consultar contactos y sedes publicables por `company_id`. Si se entra desde un mercado concreto, comprobar también su relación con ese mercado mediante la proyección/RPC. La visibilidad global de una empresa en otro mercado futuro no acredita atención en el mercado seleccionado.

Los alias se consultan en `public.company_url_aliases` por `alias_slug` y conducen a `target_company_id`; resolver luego su slug canónico publicable. No hay RPC de resolución ni redirección HTTP creada. Si no hay fila visible, responder según el comportamiento de ruta de la aplicación sin revelar motivos editoriales. No redirigir en base a registros privados ni inventar un destino para una retirada.

## Reglas que el consumidor debe conservar

- Todas las empresas son perfiles no reclamados. Revisión editorial no significa propiedad verificada, certificación, sociedad ni disponibilidad.
- Publicación exige identidad/categoría/evidencia/reutilización válidas, decisión aprobada, duplicados revisados, mercado activo, presencia local O cobertura confirmada y contacto vigente O dirección concreta útil publicable. `publication_status='published'` por sí solo no basta.
- Presencia física y cobertura son indicadores independientes. Una sede local no confirma servicios ni atención al público.
- `company_offerings.service_id=NULL` significa solo categoría; no todos los servicios.
- `unconfirmed` se calcula; no se persiste como declaración positiva. La ausencia de cobertura no significa `not_served`.
- La cobertura específica prevalece sobre la general aplicable. `not_served` y `disputed` no coinciden con filtros locales de servicio.
- Contactos operativos: publicados, `active`, revisión vigente, `review_due_at > now()`, evidencia válida y empresa visible. Al vencer desaparecen en lectura incluso sin tarea programada.
- Un valor nuevo de contacto requiere registro y evidencia nuevos. El valor y canal son inmutables. Los 90 días son recomendación pendiente, no un cron implementado.
- Una ubicación no activa un mercado. No equiparar Ciudad de Panamá con distrito, provincia, área metropolitana o Panamá Oeste.
- La publicación de una página no crea por sí misma indexación; `indexation_status` predetermina `noindex`. Umbral editorial y caché/sitemap son responsabilidades pendientes del recorrido de aplicación.

## Entidades públicas y tipos comprobados

Estos son nombres y tipos del catálogo real inspeccionado; nullable se refiere al almacenamiento. SQL `uuid`, `text` y `timestamptz` se reciben como strings; `integer` como number y `boolean` como boolean. Las fechas son instantes ISO con zona. El cliente no debe escribir campos generados ni fechas de sistema.

Los tipos generados desde el proyecto están en [supabase/database.types.ts](../supabase/database.types.ts). CHECK expresa estados de negocio como text en PostgreSQL; no asumir que el generador los transforma en uniones TypeScript.

### `public.countries`

Clave primaria: `code`.

| Campo | Tipo SQL | Nullable | Valor predeterminado |
| --- | --- | --- | --- |
| `code` | text | No | — |
| `name` | text | No | — |
| `default_locale` | text | No | — |
| `is_active` | boolean | No | `false` |
| `created_at` | timestamp with time zone | No | `now()` |
| `updated_at` | timestamp with time zone | No | `now()` |

### `public.locations`

Clave primaria: `id`.

| Campo | Tipo SQL | Nullable | Valor predeterminado |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `country_code` | text | No | — |
| `parent_id` | uuid | Sí | — |
| `kind` | text | No | — |
| `name` | text | No | — |
| `slug` | text | No | — |
| `official_code` | text | Sí | — |
| `reference_url` | text | Sí | — |
| `is_active` | boolean | No | `false` |
| `created_at` | timestamp with time zone | No | `now()` |
| `updated_at` | timestamp with time zone | No | `now()` |

### `public.directory_markets`

Clave primaria: `id`.

| Campo | Tipo SQL | Nullable | Valor predeterminado |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `code` | text | No | — |
| `country_code` | text | No | — |
| `location_id` | uuid | No | — |
| `display_name` | text | No | — |
| `include_descendants` | boolean | No | `false` |
| `status` | text | No | `'draft'::text` |
| `launched_at` | timestamp with time zone | Sí | — |
| `created_at` | timestamp with time zone | No | `now()` |
| `updated_at` | timestamp with time zone | No | `now()` |

### `public.categories`

Clave primaria: `id`.

| Campo | Tipo SQL | Nullable | Valor predeterminado |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `parent_id` | uuid | Sí | — |
| `code` | text | No | — |
| `name` | text | No | — |
| `slug` | text | No | — |
| `description` | text | Sí | — |
| `sort_order` | integer | No | `0` |
| `is_active` | boolean | No | `false` |
| `created_at` | timestamp with time zone | No | `now()` |
| `updated_at` | timestamp with time zone | No | `now()` |

### `public.services`

Clave primaria: `id`.

| Campo | Tipo SQL | Nullable | Valor predeterminado |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `category_id` | uuid | No | — |
| `code` | text | No | — |
| `name` | text | No | — |
| `slug` | text | No | — |
| `description` | text | Sí | — |
| `sort_order` | integer | No | `0` |
| `is_active` | boolean | No | `false` |
| `created_at` | timestamp with time zone | No | `now()` |
| `updated_at` | timestamp with time zone | No | `now()` |

### `public.companies`

Clave primaria: `id`.

| Campo | Tipo SQL | Nullable | Valor predeterminado |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `trade_name` | text | No | — |
| `name_normalized` | text | Sí | `lower(regexp_replace(TRIM(BOTH FROM trade_name), '\s+'::text, ' '::text, 'g'::text))` |
| `legal_name` | text | Sí | — |
| `slug` | text | No | — |
| `description` | text | Sí | — |
| `publication_status` | text | No | `'draft'::text` |
| `published_at` | timestamp with time zone | Sí | — |
| `information_reviewed_at` | timestamp with time zone | Sí | — |
| `attribution_text` | text | Sí | — |
| `attribution_url` | text | Sí | — |
| `created_at` | timestamp with time zone | No | `now()` |
| `updated_at` | timestamp with time zone | No | `now()` |

### `public.company_offerings`

Clave primaria: `id`.

| Campo | Tipo SQL | Nullable | Valor predeterminado |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `company_id` | uuid | No | — |
| `category_id` | uuid | No | — |
| `service_id` | uuid | Sí | — |
| `publication_status` | text | No | `'draft'::text` |
| `attribution_text` | text | Sí | — |
| `attribution_url` | text | Sí | — |
| `created_at` | timestamp with time zone | No | `now()` |
| `updated_at` | timestamp with time zone | No | `now()` |

### `public.offering_coverage`

Clave primaria: `id`.

| Campo | Tipo SQL | Nullable | Valor predeterminado |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `offering_id` | uuid | No | — |
| `location_id` | uuid | No | — |
| `coverage_status` | text | No | — |
| `include_descendants` | boolean | No | `false` |
| `publication_status` | text | No | `'draft'::text` |
| `attribution_text` | text | Sí | — |
| `attribution_url` | text | Sí | — |
| `created_at` | timestamp with time zone | No | `now()` |
| `updated_at` | timestamp with time zone | No | `now()` |

### `public.company_branches`

Clave primaria: `id`.

| Campo | Tipo SQL | Nullable | Valor predeterminado |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `company_id` | uuid | No | — |
| `name` | text | Sí | — |
| `location_id` | uuid | No | — |
| `public_address` | text | Sí | — |
| `presence_status` | text | No | `'unconfirmed'::text` |
| `publication_status` | text | No | `'draft'::text` |
| `attribution_text` | text | Sí | — |
| `attribution_url` | text | Sí | — |
| `created_at` | timestamp with time zone | No | `now()` |
| `updated_at` | timestamp with time zone | No | `now()` |

### `public.company_contacts`

Clave primaria: `id`.

| Campo | Tipo SQL | Nullable | Valor predeterminado |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `company_id` | uuid | No | — |
| `branch_id` | uuid | Sí | — |
| `channel` | text | No | — |
| `value` | text | No | — |
| `label` | text | Sí | — |
| `sort_order` | integer | No | `0` |
| `contact_status` | text | No | `'needs_review'::text` |
| `last_reviewed_at` | timestamp with time zone | Sí | — |
| `review_due_at` | timestamp with time zone | Sí | — |
| `retired_at` | timestamp with time zone | Sí | — |
| `publication_status` | text | No | `'draft'::text` |
| `attribution_text` | text | Sí | — |
| `attribution_url` | text | Sí | — |
| `created_at` | timestamp with time zone | No | `now()` |
| `updated_at` | timestamp with time zone | No | `now()` |

### `public.directory_pages`

Clave primaria: `id`.

| Campo | Tipo SQL | Nullable | Valor predeterminado |
| --- | --- | --- | --- |
| `id` | uuid | No | `gen_random_uuid()` |
| `market_id` | uuid | No | — |
| `category_id` | uuid | No | — |
| `service_id` | uuid | Sí | — |
| `location_id` | uuid | Sí | — |
| `path` | text | No | — |
| `title` | text | No | — |
| `meta_description` | text | Sí | — |
| `introduction` | text | Sí | — |
| `publication_status` | text | No | `'draft'::text` |
| `indexation_status` | text | No | `'noindex'::text` |
| `published_at` | timestamp with time zone | Sí | — |
| `created_at` | timestamp with time zone | No | `now()` |
| `updated_at` | timestamp with time zone | No | `now()` |

### `public.company_url_aliases`

Clave primaria: `alias_slug`.

| Campo | Tipo SQL | Nullable | Valor predeterminado |
| --- | --- | --- | --- |
| `alias_slug` | text | No | — |
| `target_company_id` | uuid | No | — |
| `created_at` | timestamp with time zone | No | `now()` |

## Relaciones y estados

Relaciones principales: `countries.code → locations.country_code`; `locations.id → locations.parent_id/directory_markets.location_id/company_branches.location_id/offering_coverage.location_id`; `categories.id → services.category_id/company_offerings.category_id`; `companies.id → company_offerings.company_id/company_branches.company_id/company_contacts.company_id`; `company_offerings.id → offering_coverage.offering_id`; `directory_markets.id → directory_pages.market_id`; `companies.id → company_url_aliases.target_company_id`.

Hay FK compuestas para coherencia de país/padre, categoría/servicio y empresa/sede/contacto/evidencias. Unicidades con NULL impiden duplicar ofertas generales y contactos activos sin sede. Nombre normalizado, dominio y teléfono son señales de revisión; no claves únicas globales.

| Campo | Valores |
| --- | --- |
| `publication_status` | `draft`, `published`, `hidden`, `archived` |
| `directory_markets.status` | `draft`, `active`, `paused` |
| `offering_coverage.coverage_status` | Persistidos: `confirmed`, `not_served`, `disputed`; calculado: `unconfirmed` |
| `company_branches.presence_status` | `unconfirmed`, `documented`, `closed` |
| `company_contacts.contact_status` | `needs_review`, `active`, `invalid`, `disputed`, `retired` |
| `directory_pages.indexation_status` | `noindex`, `indexable` |

## Administración y reportes privados

Las seis tablas privadas son `data_sources`, `company_sources`, `company_editorial`, `company_reports`, `staff_roles` y `audit_log`. Su diccionario detallado está en v0.3; su DDL concreto en las migraciones. No son entidades consumibles por el frontend público. Las 25 funciones auxiliares privadas implementan políticas, integridad y auditoría; no son una API editorial.

El navegador no recibe EXECUTE sobre la nueva RPC de ingreso ni privilegios privados. La recepción se implementa en el endpoint Next.js descrito abajo y la moderación conserva qa_save con sesión/RLS. La migración nueva está aplicada en Dev bajo la versión remota `20261120200552`. El aviso final, la retención de negocio y el responsable de bandeja siguen pendientes.

La publicación revisada y su comprobación están integradas en QA mediante qa_publish_company y qa_publication_check. La fusión y el traslado de evidencia requieren operaciones administrativas transaccionales explícitas aún no automatizadas. Existen restricciones de coherencia y alias y auditoría; no hay un RPC de fusión que mueva automáticamente los hechos. La aplicación debe invalidar cachés y sitemap al cambiar elegibilidad; esta entrega no crea ese mecanismo.

## Errores y ausencia de resultados

| Situación | Tratamiento |
| --- | --- |
| Sin coincidencias, mercado inexistente/inactivo o fila oculta por RLS | Lista vacía; no revelar si existe un borrador |
| UUID inválido (`22P02`) | Validar entrada y mostrar error de filtro |
| Sin permiso (`42501`) | Denegar y revisar sesión/rol; no reintentar con clave privilegiada |
| Referencia incoherente (`23503`) | Corregir relación en administración |
| Duplicado (`23505`) | Revisar conflicto; no fusionar automáticamente |
| CHECK/trigger (`23514`) | Corregir dato/evidencia según regla; sin mostrar detalles privados al visitante |

Los códigos SQL de esta sección corresponden al cliente Supabase; los HTTP del nuevo endpoint se detallan abajo. La aplicación debe tratar el `error` devuelto por el cliente y depurar los mensajes antes de mostrarlos. Una actualización que afecta cero filas puede ser una denegación por RLS; no declararla exitosa solo por ausencia de excepción.

## Variables y pendientes de lanzamiento

- `NEXT_PUBLIC_SUPABASE_URL=https://lewlduoqmsdnmxfichus.supabase.co`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: clave publishable real en entorno local/hosting, nunca un secreto. No se incluye su valor en este contrato.
- Nunca exponer `service_role`, claves secretas, contraseñas PostgreSQL ni tokens de MCP al navegador o repositorio.

Antes de la integración operativa: cerrar configuración hospedada de Auth/Data API, bootstrap de personal real, delimitación geográfica y mercado en borrador, flujos editoriales/reportes, invalidación de caché, retención y criterio de indexación. No activar mercado ni cargar empresas hasta cumplir las reglas de evidencia.

Ver [validación alojada](hosted-validation-2026-11-17.md) y [relación de versiones remotas](../supabase/remote-migrations.json). Las versiones del historial remoto fueron generadas por MCP y difieren de los prefijos locales. No usar `supabase db push` ni reejecutar las ocho migraciones por fecha local: reconciliar primero las versiones mediante un procedimiento revisado.

## Extensión temporal de QA

companies.qa_test_batch UUID nullable identifica fixtures de desarrollo, es inmutable y prohíbe publicar la empresa marcada. Los nombres QA TEST exigen marcador. No cambia las reglas del directorio real. La limpieza del panel es archivado de una sola empresa marcada, sin DELETE ni pérdida de auditoría.

RPC en public, todas SECURITY INVOKER: qa_staff_context, qa_records, qa_save, qa_publication_check, qa_publish_company, qa_duplicate_candidates, qa_archive_test_company y qa_set_market_status para authenticated, con rol HUT comprobado y RLS. qa_bootstrap_status y qa_bootstrap_admin son solo de operador/service_role, de un solo uso mientras no exista personal. No reciben SQL arbitrario ni permiten autoasignación de roles. El esquema private sigue fuera de la API pública. Los cambios editoriales registran estados anterior/nuevo y revisión de duplicados en auditoría sin copiar motivos libres.

## Ampliación de reportes privados — 19/11/2026

Código implementado; migración alojada **aplicada solo en Dev** el 20/11/2026 con `mcp__codex_apps__supabase_apply_migration` (`success: true`). Su nombre remoto es `company_report_ingress` y su versión remota real `20261120200552`; el archivo local conserva `20261119210627_company_report_ingress.sql`. Las diez migraciones previas siguen intactas. El esquema resultante tiene 19 tablas con RLS y 64 políticas preservadas. Se comprobaron por lectura columnas, tabla, restricciones, índices, funciones y ACL: `anon` no tiene EXECUTE sobre las nuevas funciones ni acceso a las tablas privadas; ingreso y mantenimiento son solo de `service_role`, y las dos funciones QA nuevas requieren `authenticated` con controles internos de personal. Los tipos `database.types.ts` se regeneraron desde Supabase Dev mediante el conector. La configuración alojada de esquemas expuestos por Data API no pudo verificarse mediante estas consultas; no hay despliegue público ni prueba HTTP alojada o Turnstile real.

Migración local nueva: `20261119210627_company_report_ingress.sql`. Conserva las diez anteriores sin editar y amplía `private.company_reports`. Añade `submission_origin_hash`, `content_fingerprint`, `abuse_data_expires_at`, `duplicate_submission_count` (0), `last_repeated_at`, `similar_report_id` (FK a otro reporte). Solo se guardan hashes HMAC, nunca IP ni token sin transformar. Las 18 tablas de negocio se conservan; se añade únicamente `private.company_report_rate_limits` para cuotas/proof replay entre instancias, con RLS y acceso solo de operador/service_role. No es otra bandeja de denuncias. Las 64 políticas previas se conservan.

### Contrato público HTTP

`POST /api/company-reports`, runtime Node.js, sin sesión ni cuenta. `Content-Type: application/json`; cuerpo UTF-8 máximo **32768 bytes reales**, incluso sin Content-Length. Requiere Origin permitido y Host coincidente; no permite CORS a otros orígenes. No enviar JWT ni clave Supabase en el navegador para esta operación.

| Campo JSON | Requerido | Validación |
| --- | --- | --- |
| `company_id` | Sí | UUID público canónico, variantes RFC válidas, versión 1–8; la empresa debe seguir siendo publicable según el predicado editorial completo |
| `report_type` | Sí | Uno de los nueve tipos siguientes, exacto |
| `message` | Sí | String, trim, 10–4000 unidades UTF-16; sin controles C0/C1 excepto tabulador y saltos de línea |
| `reply_email` | No | String, null, vacío u omitido; trim y minúsculas; máximo 254 caracteres; estructura local@dominio.sufijo, sin espacios/controles; no acredita identidad ni entrega |
| `turnstile_token` | Sí | String no vacío, sin espacios/controles, máximo 2048 caracteres; token fresco de Turnstile para esta acción/origen |
| `website` | No | Honeypot, string máximo 200; dejar vacío u omitir. Si contiene texto se confirma genéricamente y se descarta sin almacenar |

Se rechazan campos desconocidos, incluidos estado, rol, asignación, decisiones, versión de aviso y hashes. La versión de aviso procede de configuración aprobada del servidor, nunca del visitante.

Tipos existentes: `correction`, `outdated_contact`, `closure`, `removal`, `duplicate`. Nuevos: `bad_service` (experiencia de servicio), `no_response` (falta de respuesta), `suspected_fraud` (**sospecha sin verificar**), `other_problem`. No estrellas, rankings, calificaciones o denuncias públicas.

```json
{
  "company_id": "UUID_PUBLICO_REAL",
  "report_type": "no_response",
  "message": "Descripción breve de lo ocurrido, sin documentos ni datos innecesarios.",
  "reply_email": null,
  "turnstile_token": "TOKEN_FRESCO_DE_LA_ACCION_company_report"
}
```

| HTTP | JSON exacto / interpretación |
| --- | --- |
| 202 | `{"accepted":true,"message":"Solicitud recibida para revisión."}`. Igual para creación, duplicado suprimido y honeypot. No promete investigación favorable, sanción ni respuesta por email |
| 400 | `{"error":"No se pudo recibir la solicitud."}`; formato/campos inválidos |
| 403 | Mismo JSON genérico; origen o prueba antiautomatización rechazada/reutilizada |
| 404 | Mismo JSON genérico para empresa inexistente o no publicable; no distingue borradores |
| 413 | Mismo JSON genérico; cuerpo excesivo |
| 415 | Mismo JSON genérico; tipo de contenido incorrecto |
| 429 | `{"error":"Inténtalo de nuevo más tarde."}`, `Retry-After: 600`; puede seguir limitado por la ventana horaria/diaria, no reintentar en bucle |
| 503 | JSON genérico; deshabilitado/configuración incompleta, proveedor, base de datos o IP de proxy no confiable |

Todos llevan `Cache-Control: no-store, private`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`. No se devuelven UUID de reporte, estado privado, mensaje, email, notas, coincidencias, SQL ni respuesta del proveedor. No hay lectura pública por ID. Next aplica su respuesta de método no permitido a otros métodos. Los errores previos a este handler pueden seguir el formato de plataforma; el frontend debe tolerarlos sin volcar contenido privado a analítica.

### Abuso, confidencialidad y limitaciones

Turnstile se verifica **en servidor** con Siteverify (timeout 5 s), `success`, acción exacta `company_report`, hostname en lista y challenge de hasta 300 s (máximo 30 s de desfase futuro). Fallos de proveedor cierran el ingreso. No se envía remoteip a Siteverify ni se registra token. La base consume además un hash del proof una sola vez, atómicamente entre instancias; caduca a los 10 minutos. El frontend futuro obtendrá tokens con su site key pública y renovará el desafío para otro intento. No se ha construido el formulario ni configurado un widget externo. Ver [validación oficial de Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

El adaptador de producción inicial exige Vercel (`VERCEL=1` y `HUT_REPORTS_IP_SOURCE=vercel`) y usa exclusivamente `x-vercel-forwarded-for` validado/canonizado. No acepta X-Forwarded-For arbitrario, listas de IP ni proxies sin adaptar y revisar. Vercel debe ser el proxy público directo; una capa intermedia puede agrupar visitantes. Otro hosting queda cerrado hasta disponer de un adaptador confiable. Ver [cabeceras de Vercel](https://vercel.com/docs/headers/request-headers). Loopback solo funciona fuera de producción, con QA habilitado, Origin local exacto e IP fija; ignora cabeceras aportadas por el cliente y conserva CAPTCHA real.

La IP solo vive durante la petición; se deriva un HMAC-SHA256 con secreto de servidor y día UTC. El presupuesto se comparte en PostgreSQL, con upsert atómico, por origen derivado: **5 aceptaciones/10 min, 20/día UTC, 3/hora/empresa**, ventanas fijas. Cuenta también repeticiones válidas con token nuevo; no cuenta peticiones fallidas que revierten. Una IP compartida comparte presupuesto; los límites no prueban identidad y se reinician en fronteras de ventana/día. No hay identificador público permanente ni contador en memoria para este endpoint.

Una huella HMAC de empresa+tipo+texto normalizado (NFKC, minúsculas, espacios colapsados; no incluye email) detecta repetición: mismo origen/contenido dentro de 15 min incrementa contador en el primer reporte, sin volver a guardar ni sustituir su email/texto. Otro origen/contenido igual en 24 h crea un caso vinculado mediante `similar_report_id`. Esto es una señal técnica, no corroboración. No cambia publicación, calidad, roles o propiedad y no genera sanciones por umbral.

Los hashes de reportes dejan de utilizarse al expirar y se limpian a las 48 h mediante mantenimiento; contadores duran hasta fin de ventana+24 h (máximo 48 h), proof hashes 10 min. `maintain_company_report_ingress(p_limit=200)` elimina por lote (máximo 500 de cada clase), solo operador/service_role. También se llama con 100 al aceptar ingresos. **Antes de exposición pública falta configurar una tarea horaria segura y vigilancia del atraso**, repitiendo lotes hasta vaciar vencidos: sin ella y sin tráfico no se garantiza borrado físico al vencer. No se afirma un scheduler desplegado.

Faltan además reglas de plataforma/WAF para tráfico masivo y cuerpos lentos/voluminosos antes de Node, configuración Turnstile real, protección de logs del hosting sin cuerpos/correos/tokens/IP innecesaria y verificación de cabeceras en hosting real. CAPTCHA y cuotas no sustituyen protección de infraestructura. El endpoint se entrega deshabilitado por defecto y **no está listo para exposición pública**.

### Contrato administrativo privado

Se conservan sesión Auth comprobada en servidor, `private.staff_roles` activo y las RLS existentes. Ninguna cuenta visitante. El futuro panel deberá implementar su propio puente de servidor autenticado; el puente QA es temporal, limitado a loopback y no debe convertirse en API comercial pública.

| Operación | Contrato / autorización |
| --- | --- |
| Listar historial/cola | `qa_company_reports(p_company_id uuid=NULL,p_type text=NULL,p_status text=NULL,p_repeated_only boolean=false,p_limit integer=50,p_offset integer=0)`; `authenticated` con personal activo; máximo 100, offset 0–10000. Devuelve `{rows,limit,offset}`, sin total, orden created_at DESC,id; omite ambos hashes |
| Filtros QA | `GET /internal/qa/api?action=company-reports&company=UUID&type=bad_service&status=new&repeated=true&offset=0`; todos los filtros son opcionales, página fija 50. Empresa vacía=todas, tipo/estado vacío=todos. `repeated` solo true/false. Registro genérico de reportes también usa la proyección sin hashes |
| Revisar/resolver | `POST /internal/qa/api` con `{action:"save",entity:"company_reports",id:UUID,data:{status:"in_review",assigned_to:UUID}}`, o status cerrado con resolution_action y resolution_summary. Internamente `qa_save`, RLS y validación de campos existente |
| Depurar | Admin, `{action:"purge-reports",confirm:true}`; llama `qa_purge_due_company_reports(p_limit=100)` y devuelve `{result:{purged_reports:N}}`. Solo casos cerrados y fecha de eliminación vencida aprobada; operación irreversible de PII, no borra fila/auditoría |
| Decisión sobre empresa | Operación humana separada en los flujos editoriales existentes (`qa_save` de company_editorial/entidad afectada, publicación revisada); permisos sensibles de admin vigentes. Resolver un reporte no ejecuta la decisión automáticamente |

Estados conservados: `new`, `in_review`, `awaiting_info`, `resolved`, `dismissed`. Cierre exige `resolution_action` (`corrected`, `partially_corrected`, `hidden`, `withdrawn`, `merged`, `no_change`), resumen mínimo y fecha de cierre fijada por servidor. Marcar merged no fusiona registros. `assigned_to` referencia Auth existente; el operador debe asignar solo personal autorizado. Los reportes purgados mantienen texto/email nulos, bloqueados por CHECK; el panel no permite volver a introducirlos. La tabla conserva referencias, tipo, resolución mínima y fechas. No repetir PII ni acusaciones completas en resolution_summary.

La fecha `personal_data_delete_after` se aprueba por caso después del cierre. v0.3 propone 90 días, pero la política final y el responsable siguen pendientes: **no se programa ese plazo por defecto**. La operación de depuración elimina message, reply_email y hashes; audit_log sigue guardando actor/operación/entidad sin sus valores. Nunca enviar reportes a GA4, usarlos como leads, revelar remitente a la empresa automáticamente, ejecutar HTML/Markdown recibido ni incluir cargas en logs. El panel usa texto escapado por React, sin HTML inyectado. No se envían emails de seguimiento automáticamente.

Configuración y recorrido manual: [REPORTS.md](REPORTS.md). La aplicación remota quedó verificada por historial y catálogos; esto no demuestra la configuración hospedada de Data API/Auth, la disponibilidad real de Turnstile ni el funcionamiento HTTP alojado.
