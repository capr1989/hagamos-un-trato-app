# HUT — Contrato del backend de Fase 1

Verificado el 17 de noviembre de 2026 en `lewlduoqmsdnmxfichus` (`hagamos-un-trato-dev`), PostgreSQL 17.12. Fuente conceptual: [arquitectura v0.3](architecture-v0.3.md) y [diccionario v0.3](data-dictionary-v0.3.md).

## Estado de integración

**Implementado y comprobado en PostgreSQL alojado:** ocho migraciones, 18 tablas con RLS, 64 políticas, una vista pública y una RPC pública. Datos iniciales: Panamá inactivo, dos categorías activas, diez servicios activos. No existen empresas, ubicaciones, mercados ni usuarios Auth. Por eso los listados de empresas devuelven `[]`.

**Pendiente antes de habilitar la aplicación:** comprobar la configuración alojada de esquemas expuestos de Data API y Auth (registro público y acceso anónimo de Auth deshabilitados), crear por operación controlada al personal real y conceder sus roles, documentar la delimitación de Ciudad de Panamá, cargar geografía revisada y mercado en borrador. La configuración local solo expone `public`; no demuestra la configuración alojada. Las herramientas MCP disponibles no exponen los ajustes hospedados de Auth/Data API. No se afirma una prueba HTTP con clave publishable ni inicio de sesión real de personal.

Este contrato documenta objetos SQL existentes. No hay endpoints propios de Next.js implementados, recepción pública de reportes ni RPC de publicación/fusión. No hay clientes, cuentas empresariales, reclamaciones, leads, pagos ni Storage.

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

No existe RPC pública para insertar reportes. El futuro endpoint de servidor debe validar empresa publicable, tipo, mensaje de 1–4000 caracteres, correo opcional, aviso de privacidad y límites de frecuencia/abuso; no dar INSERT al navegador ni crear cuentas o leads. No está implementado ni se anuncia como operativo. Retención/purga y responsable de bandeja siguen pendientes.

Publicación, fusión y traslado de evidencia requieren operaciones administrativas transaccionales explícitas que aún deben integrarse. Existen restricciones de coherencia y alias y auditoría; no hay un RPC de fusión que mueva automáticamente los hechos. La aplicación debe invalidar cachés y sitemap al cambiar elegibilidad; esta entrega no crea ese mecanismo.

## Errores y ausencia de resultados

| Situación | Tratamiento |
| --- | --- |
| Sin coincidencias, mercado inexistente/inactivo o fila oculta por RLS | Lista vacía; no revelar si existe un borrador |
| UUID inválido (`22P02`) | Validar entrada y mostrar error de filtro |
| Sin permiso (`42501`) | Denegar y revisar sesión/rol; no reintentar con clave privilegiada |
| Referencia incoherente (`23503`) | Corregir relación en administración |
| Duplicado (`23505`) | Revisar conflicto; no fusionar automáticamente |
| CHECK/trigger (`23514`) | Corregir dato/evidencia según regla; sin mostrar detalles privados al visitante |

No asumir un código HTTP de un endpoint propio inexistente. La aplicación debe tratar el `error` devuelto por el cliente y depurar los mensajes antes de mostrarlos. Una actualización que afecta cero filas puede ser una denegación por RLS; no declararla exitosa solo por ausencia de excepción.

## Variables y pendientes de lanzamiento

- `NEXT_PUBLIC_SUPABASE_URL=https://lewlduoqmsdnmxfichus.supabase.co`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: clave publishable real en entorno local/hosting, nunca un secreto. No se incluye su valor en este contrato.
- Nunca exponer `service_role`, claves secretas, contraseñas PostgreSQL ni tokens de MCP al navegador o repositorio.

Antes de la integración operativa: cerrar configuración hospedada de Auth/Data API, bootstrap de personal real, delimitación geográfica y mercado en borrador, flujos editoriales/reportes, invalidación de caché, retención y criterio de indexación. No activar mercado ni cargar empresas hasta cumplir las reglas de evidencia.

Ver [validación alojada](hosted-validation-2026-11-17.md) y [relación de versiones remotas](../supabase/remote-migrations.json). Las versiones del historial remoto fueron generadas por MCP y difieren de los prefijos locales. No usar `supabase db push` ni reejecutar las ocho migraciones por fecha local: reconciliar primero las versiones mediante un procedimiento revisado.
