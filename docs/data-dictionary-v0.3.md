# Hagamos un Trato — Diccionario de datos v0.3

Fecha: 17 de noviembre de 2026.

Estado: diseño lógico propuesto para revisión. No es DDL ni una migración ejecutable. Los tipos, restricciones y permisos se concretarán al aprobar el esquema. Se incorporan la adenda y la revisión posterior sobre presencia física, cobertura y calidad editorial. Esta versión sustituye únicamente las reglas incompatibles de v0.2 y conserva la taxonomía y las fases.

Documento complementario: [Arquitectura v0.3](architecture-v0.3.md).

## 1. Convenciones

- `UUID`: identificador estable; no se empleará el nombre o slug como identidad empresarial.
- `TEXT`: texto con longitud y contenido validados según el campo. Los estados se expresan aquí como valores lógicos, sin decidir todavía entre CHECK o tipos enumerados.
- `TIMESTAMPTZ`: instante con zona horaria. El almacenamiento será consistente y la presentación utilizará la zona horaria aplicable.
- `BOOLEAN`, `INTEGER`, `DATE`, `JSONB` y `TEXT[]`: tipos lógicos de PostgreSQL. JSONB no sustituye relaciones del catálogo.
- Salvo claves de relación o indicación distinta, las entidades tendrán `id UUID`, `created_at` y `updated_at`. La auditoría será de inserción, sin actualización ordinaria.
- «Opcional» significa que el valor puede faltar; no se inventará un dato para completar el perfil.
- En entidades publicables, `publication_status` propone `draft`, `published`, `hidden`, `archived`; el valor inicial será `draft`.
- La ubicación física, la cobertura por oferta y el mercado habilitado son conceptos diferentes. Presencia local y cobertura confirmada pueden coexistir; cobertura ausente significa no confirmada, no negativa.
- Se añade `company_editorial` para decisiones internas; `company_reports` para correcciones/retirada; y `company_url_aliases` para conservar rutas tras fusiones o cambios aprobados. No se añade una tabla de clientes ni una de reclamación de propiedad.
- Las entidades publicables podrán incluir `attribution_text` y `attribution_url` opcionales cuando las condiciones de uso lo requieran. Su contenido debe estar aprobado y no revelar evidencias privadas.
- Las identidades de revisores y notas internas se almacenarán en tablas privadas, aunque una entidad tenga un resumen público de fecha de actualización.

## 2. Geografía y mercados — fase 1

### `countries`

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `code` | TEXT, clave primaria | Sí | Código ISO de dos letras, mayúsculas |
| `name` | TEXT | Sí | Nombre público del país |
| `default_locale` | TEXT | Sí | Idioma/región predeterminados de presentación |
| `is_active` | BOOLEAN | Sí | País habilitado en el catálogo; no significa lanzamiento nacional |

Inicialmente solo Panamá se habilitará para la operación del piloto. Activar un país no activa sus ciudades ni permite listar empresas de todo su territorio.

### `locations`

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `id` | UUID, clave primaria | Sí | Identidad territorial estable |
| `country_code` | FK → `countries.code` | Sí | País al que pertenece |
| `parent_id` | FK → `locations.id` | No | Ubicación que la contiene en la jerarquía revisada |
| `kind` | TEXT | Sí | `country`, `administrative_area`, `city` o `locality` |
| `name` | TEXT | Sí | Denominación revisada |
| `slug` | TEXT | Sí | Segmento de URL único dentro del país y del padre |
| `official_code` | TEXT | No | Código oficial, solo cuando esté documentado |
| `reference_url` | TEXT | No | Referencia geográfica publicable y sin secretos |
| `is_active` | BOOLEAN | Sí | Registro válido para uso interno y jerarquía |

Reglas: no puede haber ciclos, un padre debe pertenecer al mismo país y las denominaciones ambiguas no se fusionarán. La raíz territorial del país podrá representar coberturas nacionales explícitas. La jerarquía no obliga a todos los países a tener los mismos niveles administrativos.

El registro de Ciudad de Panamá se identificará documentalmente antes de cargarlo. No se tratará automáticamente como sinónimo de distrito, provincia o área metropolitana. La existencia de una ubicación activa no implica que el directorio opere allí.

### `directory_markets` — nueva tabla respecto de v0.1

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `id` | UUID, clave primaria | Sí | Mercado del directorio |
| `code` | TEXT, único | Sí | Código comercial estable; propuesta: `pa_ciudad_panama` |
| `country_code` | FK → `countries.code` | Sí | País del mercado |
| `location_id` | FK → `locations.id` | Sí | Ubicación que delimita el mercado |
| `display_name` | TEXT | Sí | «Ciudad de Panamá» para el mercado inicial |
| `include_descendants` | BOOLEAN | Sí | Si el ámbito incluye descendientes geográficos revisados; predeterminado `false` hasta validar el perímetro |
| `status` | TEXT | Sí | `draft`, `active`, `paused`; predeterminado `draft` |
| `launched_at` | TIMESTAMPTZ | No | Fecha de activación efectiva |

Reglas: coherencia entre país y ubicación; código único; no duplicar un mismo ámbito de mercado. Solo Ciudad de Panamá podrá activarse para el primer lanzamiento. El código propuesto no es un código geográfico oficial. Activar futuros mercados exigirá una decisión de negocio, no ocurrirá por cargar una nueva ubicación.

## 3. Taxonomía — fase 1

### `categories`

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `id` | UUID, clave primaria | Sí | Identidad de categoría |
| `parent_id` | FK → `categories.id` | No | Soporte de subcategorías futuras |
| `code` | TEXT, único | Sí | Código estable independiente del nombre visible |
| `name` | TEXT | Sí | Nombre público |
| `slug` | TEXT | Sí | Segmento estable, único en su ámbito de jerarquía |
| `description` | TEXT | No | Descripción editorial |
| `sort_order` | INTEGER | Sí | Orden editorial |
| `is_active` | BOOLEAN | Sí | Disponibilidad en el catálogo |

Las categorías son compartidas entre mercados. No se duplican por ciudad o país. Los registros iniciales serán Aire acondicionado y Energía solar, ambos sin categoría superior. No se añaden subcategorías en esta actualización.

### `services`

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `id` | UUID, clave primaria | Sí | Identidad del servicio |
| `category_id` | FK → `categories.id` | Sí | Categoría a la que pertenece |
| `code` | TEXT, único dentro de categoría | Sí | Código estable del servicio |
| `name` | TEXT | Sí | Nombre público |
| `slug` | TEXT, único dentro de categoría | Sí | Segmento utilizable en filtros o URLs |
| `description` | TEXT | No | Alcance editorial del servicio |
| `sort_order` | INTEGER | Sí | Orden de presentación |
| `is_active` | BOOLEAN | Sí | Disponibilidad del servicio en el catálogo |

Identidades iniciales propuestas; no son registros insertados:

| Categoría / código | Servicio | Código de servicio | Slug propuesto |
| --- | --- | --- | --- |
| Aire acondicionado / `aire_acondicionado` | Instalación | `instalacion` | `instalacion` |
| Aire acondicionado / `aire_acondicionado` | Reparación | `reparacion` | `reparacion` |
| Aire acondicionado / `aire_acondicionado` | Mantenimiento preventivo | `mantenimiento_preventivo` | `mantenimiento-preventivo` |
| Aire acondicionado / `aire_acondicionado` | Limpieza | `limpieza` | `limpieza` |
| Aire acondicionado / `aire_acondicionado` | Venta de equipos | `venta_equipos` | `venta-de-equipos` |
| Energía solar / `energia_solar` | Instalación | `instalacion` | `instalacion` |
| Energía solar / `energia_solar` | Mantenimiento | `mantenimiento` | `mantenimiento` |
| Energía solar / `energia_solar` | Reparación | `reparacion` | `reparacion` |
| Energía solar / `energia_solar` | Diseño y dimensionamiento | `diseno_dimensionamiento` | `diseno-y-dimensionamiento` |
| Energía solar / `energia_solar` | Venta de equipos | `venta_equipos` | `venta-de-equipos` |

Un código de servicio se interpreta junto con su categoría o mediante su UUID. La incorporación de esta taxonomía no asigna servicios automáticamente a ninguna empresa.

## 4. Empresas, ofertas y cobertura — fase 1

### `companies`

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `id` | UUID, clave primaria | Sí | Empresa, independiente de usuarios, mercados y categorías |
| `trade_name` | TEXT | Sí | Nombre comercial respaldado |
| `name_normalized` | TEXT | Sí | Nombre normalizado para búsqueda de posibles duplicados; derivado del nombre, no único |
| `legal_name` | TEXT | No | Razón social, solo si es necesaria, respaldada y publicable |
| `slug` | TEXT, único | Sí | Ruta canónica del perfil |
| `description` | TEXT | No | Texto original de HUT o reutilizado con permiso |
| `publication_status` | TEXT | Sí | Visibilidad editorial del perfil; inicialmente `draft` |
| `published_at` | TIMESTAMPTZ | No | Primera publicación |
| `information_reviewed_at` | TIMESTAMPTZ | No | Fecha pública de revisión de información, si se decide mostrarla |

No habrá `owner_user_id`, `is_partner`, `is_verified`, `claimed_by`, calificaciones, certificaciones ni disponibilidad para leads en esta tabla inicial. La ausencia de estos campos no impide añadir posteriormente membresías y verificaciones mediante tablas relacionadas.

La interfaz mostrará «Perfil no reclamado» para todos los perfiles iniciales. Es una regla de la fase 1, no un atributo que un editor pueda cambiar a «verificado». El estado de publicación no acredita propiedad. Para publicar se requiere además decisión editorial aprobada, duplicados revisados, identidad/categoría respaldadas, reutilización permitida, presencia local documentada O cobertura confirmada, y un contacto vigente o una dirección concreta publicable. La cobertura no confirmada no impide publicar por presencia física local. No se exige logo, descripción extensa, razón social o listado completo de servicios.

### `company_offerings`

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `id` | UUID, clave primaria | Sí | Oferta empresarial identificable |
| `company_id` | FK → `companies.id` | Sí | Empresa que ofrece la categoría o servicio |
| `category_id` | FK → `categories.id` | Sí | Categoría respaldada |
| `service_id` | FK → `services.id` | No | Servicio específico respaldado |
| `publication_status` | TEXT | Sí | Visibilidad de esta oferta; inicialmente `draft` |

Reglas: servicio y categoría deben coincidir; no duplicar una misma combinación empresa/categoría/servicio, incluyendo el caso de servicio ausente. Toda oferta publicada debe tener respaldo aprobado en `company_sources`.

`service_id` vacío permite representar conocimiento parcial de una categoría. Nunca significa que la empresa presta todos sus servicios. No se heredarán servicios de otras empresas, sedes o categorías. Un servicio documentado puede mostrarse para una empresa con presencia local indicando cobertura no confirmada. No coincidirá con el filtro de cobertura confirmada ni se presentará como atención garantizada en la ciudad. Una oferta con exclusión local explícita o conflicto de cobertura pendiente no coincidirá con el filtro local de ese servicio.

### `offering_coverage`

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `id` | UUID, clave primaria | Sí | Declaración de cobertura de una oferta |
| `offering_id` | FK → `company_offerings.id` | Sí | Oferta a la que se aplica |
| `location_id` | FK → `locations.id` | Sí | Zona a la que se refiere la declaración respaldada |
| `coverage_status` | TEXT | Sí | `confirmed`, `not_served` o `disputed`; no tiene valor afirmativo predeterminado |
| `include_descendants` | BOOLEAN | Sí | Si la declaración aplica a ubicaciones contenidas; predeterminado `false` hasta revisión |
| `publication_status` | TEXT | Sí | Visibilidad editorial; inicialmente `draft` |

Reglas: no duplicar el mismo alcance dentro de una oferta; respaldo específico de cobertura; la ubicación y el significado de la declaración deben ser inequívocos. Una cobertura general de la empresa solo se trasladará a una oferta cuando la evidencia permita esa interpretación.

Una declaración `confirmed` vigente podrá justificar la inclusión en Ciudad de Panamá mediante la jerarquía revisada y el alcance aprobado. `not_served` requiere evidencia explícita de no atención y nunca acredita inclusión. Ninguna activa otros mercados.

`unconfirmed` se calcula cuando no existe una declaración aplicable, vigente y respaldada para la oferta y el mercado; no se almacena como fila de cobertura afirmativa. Publicación en borrador u ocultación no transforma una declaración en confirmada. Un dato vencido o retirado deja de respaldar la afirmación.

Para resolver alcance: una declaración específica válida prevalece sobre una general. Si existen afirmaciones incompatibles de igual especificidad, se registra `disputed` en esa oferta/ubicación y se suspende la oferta en resultados locales hasta revisión. Ese registro bloquea la sustitución por una cobertura general y la conversión del conflicto en `unconfirmed`; no hace falta ocultar servicios ajenos al conflicto. Las evidencias y motivos permanecen privados. El estado público puede expresarse como «Cobertura en revisión», sin afirmar atención ni negativa. La resolución cambia el estado, revisa las evidencias correspondientes y conserva auditoría, sin mantener dos conclusiones publicadas incompatibles. No se publicará `not_served` por ausencia de datos. Una negativa explícita sobre un servicio no elimina una sede real, pero impide presentarlo como atendido o sin confirmar en ese mercado.

### `company_branches`

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `id` | UUID, clave primaria | Sí | Sede física |
| `company_id` | FK → `companies.id` | Sí | Empresa correspondiente |
| `name` | TEXT | No | Nombre de la sede |
| `location_id` | FK → `locations.id` | Sí | Ubicación física revisada |
| `public_address` | TEXT | No | Dirección empresarial permitida para publicación |
| `presence_status` | TEXT | Sí | `unconfirmed`, `documented`, `closed`; inicialmente `unconfirmed` |
| `publication_status` | TEXT | Sí | Visibilidad; inicialmente `draft` |

No se exigirá dirección pública para empresas móviles o sin oficina de atención. No se publicarán domicilios personales por defecto. Crear una sede no creará filas de cobertura. Una sede publicada con `presence_status = documented`, ubicación dentro del mercado y evidencia vigente/reutilizable permite inclusión territorial aunque la cobertura comercial esté sin confirmar. `unconfirmed` y `closed` no acreditan presencia actual; una sede cerrada no se presenta como operativa. La dirección completa puede omitirse si solo es publicable la ciudad, pero el perfil necesitará otro contacto útil para satisfacer el mínimo de publicación. Una dirección física no promete recepción de visitantes. Las coordenadas y mapas quedan fuera del diccionario inicial.

### `company_contacts`

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `id` | UUID, clave primaria | Sí | Contacto empresarial |
| `company_id` | FK → `companies.id` | Sí | Empresa correspondiente |
| `branch_id` | FK → `company_branches.id` | No | Sede específica, si existe |
| `channel` | TEXT | Sí | `phone`, `whatsapp`, `email`, `website` |
| `value` | TEXT | Sí | Valor normalizado y validado según canal |
| `label` | TEXT | No | Etiqueta pública, sin promesas no respaldadas |
| `contact_status` | TEXT | Sí | `needs_review`, `active`, `invalid`, `disputed`, `retired`; inicialmente `needs_review` |
| `last_reviewed_at` | TIMESTAMPTZ | No | Última revisión editorial válida del valor actual |
| `review_due_at` | TIMESTAMPTZ | No | Próxima revisión; obligatoria para mostrar un botón de contacto |
| `retired_at` | TIMESTAMPTZ | No | Fecha de retirada del valor anterior |
| `sort_order` | INTEGER | Sí | Orden de presentación |
| `publication_status` | TEXT | Sí | Visibilidad; inicialmente `draft` |

Reglas: la sede debe pertenecer a la empresa; protocolo y formato válidos; prevención de enlaces inseguros; contacto publicado solo con respaldo y reutilización permitida. El destino no se enviará a analítica: los eventos usarán empresa, canal y posición del botón.

Solo se muestran contactos publicados, `active`, con revisión válida, `review_due_at` futura y empresa publicable. Se comprobará la fecha en lectura aunque todavía no haya corrido un proceso de mantenimiento. Se propone revisión cada 90 días, o antes si lo exige la fuente; se guarda la fecha efectiva por contacto. `active` significa revisado editorialmente, no comunicación efectivamente entregada o propiedad comprobada del canal.

Se impedirá repetir la misma combinación empresa/sede/canal/valor normalizado entre contactos activos; la sede ausente se tratará de forma coherente en esa unicidad. El mismo número puede ser teléfono y WhatsApp. Ningún teléfono, correo o dominio será único entre empresas, porque pueden compartirse legítimamente. Un valor distinto crea un contacto nuevo y nueva evidencia; el anterior pasa a `retired`. Renovar revisión del mismo valor requiere evidencia reciente. Se aplicará retención mínima a valores retirados; la auditoría no copiará innecesariamente teléfonos o correos antiguos.

Al perder todos los contactos vigentes, el perfil puede seguir publicado si conserva una dirección útil publicable. Si pierde ambos, se oculta hasta corrección; las lecturas públicas aplicarán el mínimo útil incluso si una tarea aún no ha cambiado el estado persistido.

## 5. Páginas del directorio — fase 1

### `directory_pages`

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `id` | UUID, clave primaria | Sí | Página editorial del directorio |
| `market_id` | FK → `directory_markets.id` | Sí | Mercado habilitado al que pertenece |
| `category_id` | FK → `categories.id` | Sí | Categoría de la página |
| `service_id` | FK → `services.id` | No | Página específica de servicio, solo si se aprueba editorialmente |
| `location_id` | FK → `locations.id` | No | Subámbito opcional dentro del mercado; vacío representa todo su ámbito |
| `path` | TEXT, único | Sí | Ruta canónica sin parámetros de búsqueda |
| `title` | TEXT | Sí | Título editorial |
| `meta_description` | TEXT | No | Metadescripción original y fiel al contenido |
| `introduction` | TEXT | No | Contenido útil de la página |
| `publication_status` | TEXT | Sí | Visibilidad editorial; inicialmente `draft` |
| `indexation_status` | TEXT | Sí | `noindex` o `indexable`; inicialmente `noindex` |
| `published_at` | TIMESTAMPTZ | No | Fecha de publicación |

Reglas: servicio coherente con categoría; ubicación dentro del ámbito aprobado; mercado activo para publicar; combinación de mercado/categoría/servicio/subámbito no duplicada. El alta de un servicio o ubicación no crea páginas indexables automáticamente.

La tabla sustituye los campos de país aislados propuestos en v0.1 por una referencia explícita al mercado. Esto impide interpretar una página de la ciudad como una oferta nacional. Los títulos y metadatos de listados mixtos distinguirán presencia de cobertura. La dirección no se transformará en una afirmación estructurada de área atendida.

### `company_url_aliases` — nueva, pública solo como resolución de ruta

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `alias_slug` | TEXT, clave primaria | Sí | Slug anterior reservado |
| `target_company_id` | FK → `companies.id` | Sí | Empresa canónica de destino |
| `created_at` | TIMESTAMPTZ | Sí | Fecha de creación del alias aprobado |

La resolución solo redirige si el destino es publicable en un mercado activo. El alias no puede suplantar el slug de otra empresa vigente. Puede conservar el slug de un perfil fusionado ya oculto; ese nombre no se reasigna a otra empresa. Los alias apuntan directamente a la empresa canónica y se actualizan al fusionar destinos para evitar cadenas o ciclos. Un perfil retirado no se convierte automáticamente en alias. Una retirada posterior del destino elimina la redirección pública y deja la ruta no disponible, sin exponer el motivo privado. El mantenimiento de alias está reservado a administración y se audita.

## 6. Procedencia, personal y auditoría — fase 1, privados

### `data_sources`

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `id` | UUID, clave primaria | Sí | Fuente identificada |
| `name` | TEXT | Sí | Nombre de la fuente |
| `source_type` | TEXT | Sí | Tipo, por ejemplo sitio empresarial o conjunto de datos licenciado |
| `base_url` | TEXT | No | Referencia sin credenciales ni parámetros sensibles |
| `terms_url` | TEXT | No | Condiciones consultadas |
| `license_name` | TEXT | No | Licencia o permiso aplicable documentado |
| `reuse_status` | TEXT | Sí | `pending`, `permitted`, `restricted`, `blocked`; inicialmente `pending` |
| `permitted_uses` | TEXT | No | Alcance revisado del permiso |
| `restrictions` | TEXT | No | Límites, prohibiciones o condiciones |
| `attribution_required` | BOOLEAN | Sí | Si exige atribución, según revisión |
| `reviewed_at` | TIMESTAMPTZ | No | Última revisión de condiciones |
| `reviewed_by` | FK → `auth.users.id` | No | Personal responsable |

`restricted` no equivale a prohibición total ni aprobación general: cada uso deberá encajar en lo permitido. La aprobación de una fuente no aprueba automáticamente todos sus textos, imágenes y contactos. Sin una decisión aplicable documentada no se publicarán los campos obtenidos de ella.

### `company_sources`

Registra evidencia de hechos concretos, no una comprobación de propiedad. Una fuente podrá generar varios registros para distintos servicios, coberturas o campos.

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `id` | UUID, clave primaria | Sí | Referencia de evidencia |
| `company_id` | FK → `companies.id` | Sí | Empresa a la que se refiere |
| `source_id` | FK → `data_sources.id` | Sí | Fuente y sus condiciones |
| `source_url` | TEXT | No | Página concreta sin secretos; puede faltar para permisos o material no publicado en web |
| `external_record_id` | TEXT | No | Identificador del registro de origen, cuando exista |
| `offering_id` | FK → `company_offerings.id` | No | Oferta respaldada |
| `coverage_id` | FK → `offering_coverage.id` | No | Cobertura respaldada |
| `branch_id` | FK → `company_branches.id` | No | Sede respaldada |
| `contact_id` | FK → `company_contacts.id` | No | Contacto respaldado |
| `field_keys` | TEXT[] | Sí | Campos o hechos específicos respaldados |
| `evidence_note` | TEXT | Sí | Resumen propio y mínimo de qué sostiene la fuente |
| `obtained_at` | TIMESTAMPTZ | Sí | Fecha de consulta o recepción |
| `review_status` | TEXT | Sí | `pending`, `approved`, `rejected`, `stale`; inicialmente `pending` |
| `reuse_decision` | TEXT | Sí | `pending`, `allowed`, `denied`; inicialmente `pending` |
| `reuse_notes` | TEXT | No | Justificación y límites del uso concreto |
| `attribution_text` | TEXT | No | Atribución aprobada que deba trasladarse a la entidad pública |
| `attribution_url` | TEXT | No | Enlace de atribución aprobado |
| `reviewed_at` | TIMESTAMPTZ | No | Fecha de revisión de este hecho |
| `reviewed_by` | FK → `auth.users.id` | No | Responsable editorial |
| `review_due_at` | TIMESTAMPTZ | No | Próxima revisión prevista, si corresponde |

Reglas de destino: como máximo uno de `offering_id`, `coverage_id`, `branch_id` y `contact_id` tendrá valor. Si todos están vacíos, la evidencia respalda campos de `companies`. El destino, incluido el propietario de una oferta de cobertura, debe corresponder a `company_id`; se diseñarán las claves y comprobaciones necesarias para garantizarlo. Para respaldar dos hechos en destinos distintos se crearán dos referencias, evitando una relación ambigua.

Para publicar un hecho deberán coincidir evidencia aprobada, uso concreto permitido y condiciones vigentes compatibles de la fuente. Si se pierde el permiso o el respaldo, el hecho se ocultará o sustituirá por evidencia válida en una operación controlada. Se reevaluarán también sus consecuencias: retirar evidencia de cobertura puede cambiarla a no confirmada sin ocultar un perfil con presencia local válida; retirar la única evidencia de presencia puede excluirlo si tampoco tiene cobertura confirmada. Una fuente para presencia o contacto no respalda automáticamente servicios o cobertura. La evidencia por sí sola no cambia el estado de una empresa a «verificada».

### `company_editorial` — nueva, privada

Mantiene las decisiones operativas sin mezclarlas con campos del perfil público. No duplica la evidencia de hechos ni actúa como estado de verificación de propiedad.

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `company_id` | FK → `companies.id`, clave primaria | Sí | Una ficha editorial por empresa |
| `duplicate_review_status` | TEXT | Sí | `pending`, `clear`, `possible_duplicate`; inicialmente `pending` |
| `duplicate_reviewed_at` | TIMESTAMPTZ | No | Fecha de revisión de coincidencias |
| `duplicate_reviewed_by` | FK → `auth.users.id` | No | Editor responsable |
| `publication_decision` | TEXT | Sí | `pending`, `approved`, `hold`, `withdrawn`, `merged`; inicialmente `pending` |
| `decision_reason` | TEXT | No | Motivo interno, sin datos personales innecesarios |
| `decided_at` | TIMESTAMPTZ | No | Instante de la decisión vigente |
| `decided_by` | FK → `auth.users.id` | No | Personal que la tomó |
| `canonical_company_id` | FK → `companies.id` | No | Destino de una fusión aprobada |

Reglas: `approved` exige revisión de duplicados `clear` y cumplimiento de mínimos de publicación. `merged` exige destino diferente, canónico y sin ciclos; fuera de ese estado no se utiliza `canonical_company_id`. Una coincidencia heurística solo detiene el registro nuevo, no retira automáticamente el existente. Cambios sensibles de decisión y fusiones quedan en auditoría y sincronizan `companies.publication_status` en una transacción. Los procesos de importación no pueden sobreescribir `withdrawn`, `hold` o `merged` ni reactivar la empresa sin decisión administrativa. Los procesos públicos no leen esta tabla ni exponen sus motivos.

La detección consulta nombre normalizado, dominios, teléfonos, dirección y procedencia. Esas señales no son claves únicas entre empresas. Las sedes se vinculan a la empresa existente cuando corresponde; no se fusionan automáticamente franquicias o sociedades distintas. Antes de reutilizar un registro externo conocido, se comprueba su empresa canónica. El importador masivo y su mapeo único de claves externas se diseñarán si se incorpora esa capacidad; no se presume una garantía automática de deduplicación de personas jurídicas.

### `company_reports` — nueva, privada

Es una bandeja de calidad del directorio. No es una solicitud de servicio, una reclamación de propiedad ni una tabla de clientes.

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `id` | UUID, clave primaria | Sí | Solicitud recibida |
| `company_id` | FK → `companies.id` | Sí | Empresa afectada |
| `contact_id` | FK → `company_contacts.id` | No | Contacto afectado, perteneciente a la empresa |
| `duplicate_of_company_id` | FK → `companies.id` | No | Otro perfil señalado como posible duplicado |
| `report_type` | TEXT | Sí | `correction`, `outdated_contact`, `closure`, `removal`, `duplicate` |
| `message` | TEXT limitado | Sí al recibir | Explicación breve; se recomienda máximo de 4.000 caracteres |
| `reply_email` | TEXT | No | Contacto de respuesta voluntario; no se usa para marketing ni como prueba de propiedad |
| `privacy_notice_version` | TEXT | Sí | Versión del aviso informado en el formulario |
| `status` | TEXT | Sí | `new`, `in_review`, `awaiting_info`, `resolved`, `dismissed`; inicialmente `new` |
| `assigned_to` | FK → `auth.users.id` | No | Personal encargado |
| `resolution_action` | TEXT | No | `corrected`, `partially_corrected`, `hidden`, `withdrawn`, `merged`, `no_change` |
| `resolution_summary` | TEXT | No | Motivo mínimo de resolución, sin copiar el mensaje completo |
| `resolved_at` | TIMESTAMPTZ | No | Cierre del caso |
| `personal_data_delete_after` | TIMESTAMPTZ | No | Fecha prevista para depurar texto libre y correo tras el cierre |
| `personal_data_purged_at` | TIMESTAMPTZ | No | Ejecución de esa depuración |

Reglas: no se requiere cuenta ni nombre de persona; no se reciben documentos de identidad ni adjuntos. El segundo perfil no puede ser el mismo; el contacto debe pertenecer a la empresa. Los campos de resolución solo los modifica personal autorizado. El correo es opcional y su ausencia no rechaza un reporte suficiente. Tras purga, `message` y `reply_email` pueden quedar vacíos; se conserva únicamente el resumen mínimo procedente. Se propone depuración 90 días después del cierre, salvo necesidad documentada y revisada, como política pendiente de aprobación antes del lanzamiento.

El formulario invoca una operación limitada del backend que valida empresa publicable, tamaño, contenido y frecuencia, y solo crea el reporte. No se otorgan permisos anónimos directos sobre la tabla. La recepción no modifica el perfil, no concede membresías ni verifica propiedad. Un editor o administrador revisa evidencia; una incidencia creíble puede motivar ocultación preventiva del campo afectado. Correcciones y retiradas se ejecutan con auditoría y actualización de cachés. El público no puede consultar reportes por identificador, y no se publican mensajes ni correos en analítica.

### `staff_roles`

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `user_id` | FK → `auth.users.id`, clave primaria | Sí | Cuenta del personal |
| `role` | TEXT | Sí | `editor` o `admin` |
| `status` | TEXT | Sí | `active` o `suspended` |
| `granted_by` | FK → `auth.users.id` | No | Responsable de la concesión; excepción de arranque controlada |

No habrá autorregistro de personal ni asignación de roles desde metadatos editables por el usuario. La gestión de roles estará reservada a administradores y conservará auditoría.

### `audit_log`

| Campo | Tipo lógico | Obligatorio | Significado |
| --- | --- | --- | --- |
| `id` | UUID, clave primaria | Sí | Evento administrativo |
| `actor_user_id` | FK → `auth.users.id` | No | Actor humano; puede faltar para procesos autorizados |
| `actor_kind` | TEXT | Sí | `staff` o `system` |
| `action` | TEXT | Sí | Acción controlada |
| `entity_type` | TEXT | Sí | Tipo de entidad afectada |
| `entity_id` | TEXT | Sí | Identificador de la entidad; admite códigos de país además de UUID |
| `occurred_at` | TIMESTAMPTZ | Sí | Instante del evento |
| `change_summary` | JSONB | No | Campos y cambios relevantes depurados |

Este registro es histórico y deliberadamente admite referencias genéricas; no sustituye las claves foráneas de las relaciones operativas. No guardará tokens, contraseñas, respuestas privadas completas ni eventos de navegación anónima. Su acceso, retención y purga se definirán expresamente.

## 7. Archivos — solo si se requieren en fase 1

`company_media` se incorporará únicamente si se necesitan logos o fotografías gestionados por HUT. Su diseño mínimo incluirá empresa, ruta de objeto de Storage, tipo, texto alternativo, orden, publicación y procedencia. Si se incorpora, se ampliarán las referencias de evidencia y las políticas de Storage en la misma entrega. No se descargarán o copiarán imágenes por el mero hecho de estar visibles en una web.

## 8. Cambios de fase y calidad editorial

| Elemento | Decisión v0.3 |
| --- | --- |
| `company_verifications` | Se traslada completamente a fase 2; no se crea inicialmente |
| Reclamación y membresías | Continúan en fase 2 |
| Resumen público de propiedad verificada | Se elimina del esquema inicial |
| Estado de reclamación editable | No existe en fase 1; todos los perfiles se presentan como no reclamados |
| Ciudad de lanzamiento | Se configura mediante `directory_markets` |
| Servicios y declaraciones de presencia/cobertura | Requieren evidencia identificable; cobertura desconocida se comunica sin atribuir atención |
| Inclusión territorial | Presencia física local documentada O cobertura confirmada de una oferta |
| Calidad editorial | Se añaden decisiones de duplicados/publicación, reportes privados, vigencia de contactos y alias canónicos |
| Solicitudes, matching, leads y cobros | Continúan reservados para fase 3 |

### Fase 2: entidades reservadas

| Tabla | Campos y relaciones previstos |
| --- | --- |
| `user_profiles` | Usuario de Auth, nombre de presentación y preferencias mínimas |
| `company_members` | Empresa, usuario, rol, estado; unicidad empresa/usuario |
| `company_invitations` | Empresa, destinatario, rol, token protegido, vencimiento y estado |
| `company_claims` | Empresa, solicitante, método, estado, resolución y fechas |
| `company_change_requests` | Empresa, autor, cambios propuestos y decisión editorial |
| `company_verifications` | Empresa, reclamación relacionada cuando aplique, método, evidencia privada, resultado, responsable, vigencia y revocación |

El procedimiento de verificación y sus criterios se diseñarán antes de activar la fase. Las evidencias editoriales de fase 1 podrán ser referencias contextuales, pero no acreditarán control de una empresa.

### Fase 3: entidades reservadas

| Grupo | Relaciones y datos mínimos que deberán diseñarse |
| --- | --- |
| `service_forms`, `form_versions` | Vinculación a categoría/servicio, versión inmutable de preguntas, validaciones y condiciones permitidas |
| `customers` | Identidad y contactos mínimos; vínculo opcional con una cuenta |
| `service_requests`, `request_consents` | Cliente, versión del formulario, servicio, ubicación, respuestas, estado y autorizaciones |
| `matching_runs`, `match_candidates` | Solicitud, versión de reglas, empresas candidatas, elegibilidad y motivos |
| `lead_assignments`, `lead_status_events` | Solicitud, empresa, entrega y estados; unicidad solicitud/empresa para evitar duplicados |
| Planes, suscripciones, cargos y facturación | Precio aplicado, moneda, estado e identificadores idempotentes del proveedor de pagos |
| Afiliados, enlaces, atribuciones y comisiones | Participante, código, modelo y ventana de atribución, hecho comercial respaldado y estado de comisión |

No se fijan todavía campos personales obligatorios, precios, reparto de oportunidades, proveedor de pagos o ventanas de atribución. No se crearán estas tablas ni se captarán sus datos durante el piloto.


## 9. Contrato de lectura pública

Para una empresa y mercado `M`, la elegibilidad propuesta requiere:

1. Empresa publicada, identidad/categoría con evidencia y reutilización permitidas, y decisión editorial aprobada sincronizada con los estados públicos.
2. Mercado activo y al menos una oferta publicada de una categoría activa.
3. Presencia física documentada y vigente dentro de `M` O una oferta con cobertura `confirmed` aplicable a `M`.
4. Al menos un contacto vigente publicable O una dirección física concreta, actual y permitida que aporte utilidad para localizar la empresa. Una ciudad sin dirección ni contacto no satisface este mínimo útil.

Las lecturas públicas no reciben datos de `company_editorial` o `company_reports`. Las operaciones de personal sincronizan transaccionalmente decisiones privadas, estados públicos y retirada de datos sin permiso. RLS, vistas, endpoints, conteos y cachés aplicarán un mismo contrato; el acceso directo no podrá saltarse ocultación, vigencia de contactos o mercado activo.

La proyección pública calculará estos campos, sin hacerlos editables ni crear una clasificación única de empresa:

| Campo calculado | Ámbito | Regla |
| --- | --- | --- |
| `has_documented_presence` | Empresa + mercado | Existe sede actual documentada, publicable y dentro del ámbito |
| `coverage_status` | Oferta + mercado | `confirmed`, `not_served`, `disputed` o `unconfirmed`; las excepciones requieren una declaración o decisión editorial documentada |
| `has_confirmed_coverage` | Empresa + mercado + contexto de búsqueda | Existe oferta confirmada para el servicio/categoría consultados; no se traslada a otros servicios |

Para listar una oferta local: cobertura `confirmed`, o presencia física local con servicio/categoría documentados y cobertura `unconfirmed`. `not_served` o un conflicto material pendiente excluyen esa oferta de filtros de servicio locales. Una empresa con presencia física puede seguir apareciendo por su categoría con aclaración de las exclusiones documentadas, sin presentar esos servicios como atendidos en la ciudad. Una empresa externa que solo tiene cobertura confirmada para instalación no se incorpora al filtro de reparación local por tener reparación documentada en otro territorio.

El filtro «Con cobertura confirmada» excluye ofertas sin confirmar aun cuando haya sede local. Una confirmación de categoría sin servicio no acredita servicios específicos. La lista general puede mostrar ambas bases de inclusión, con etiquetas precisas y sin duplicar empresas. Ninguna etiqueta es verificación de propiedad, disponibilidad o garantía de respuesta.

Los contactos y sedes necesitan aprobación propia; los contactos vencidos no generan botones. Los campos ausentes se omiten y no se rellenan con afirmaciones inventadas. Las evidencias, reportes, correos de remitentes y motivos internos quedan privados. Solo se publica la atribución aprobada necesaria. Los cambios que afecten elegibilidad invalidarán resultados y cachés; los alias solo resuelven destinos todavía publicables.

## 10. Contrato analítico y datos que no se almacenan

Los eventos conservarán códigos controlados de mercado, categoría, servicio y empresa cuando correspondan. Podrán identificar la base de inclusión del resultado (presencia física y/o cobertura confirmada) y la cobertura en el contexto del servicio, sin datos de reportes o notas editoriales. Los clics de contacto enviarán canal y posición, no teléfono, correo ni URL completa. Las búsquedas se analizarán mediante temas reconocidos, filtros y cantidad de resultados; el texto libre se procesará transitoriamente para buscar y no se persistirá como analítica ni en registros de aplicación deliberados.

No se crearán tablas de visitantes anónimos, huellas de dispositivo, sesiones de navegación, contactos supuestamente efectivos o ventas deducidas de clics. Los registros de infraestructura deberán revisarse para evitar captura innecesaria de consultas y establecer retención apropiada.

## 11. Casos de aceptación del diseño

| Caso | Resultado esperado |
| --- | --- |
| Empresa con presencia física documentada en la ciudad, sin cobertura confirmada | Puede publicarse con los mínimos editoriales y aviso de cobertura no confirmada; no se infiere atención |
| Empresa fuera de la ciudad con instalación documentada y cobertura explícita en la ciudad | Puede incluirse tras revisión; no se exige sede dentro del mercado |
| Empresa vende equipos de aire acondicionado | Solo coincide con venta de equipos, salvo evidencia adicional |
| Fuente menciona aire acondicionado sin detallar servicios | Puede respaldar la categoría; no asigna los cinco servicios |
| Fuente solo dice «Panamá» y no aclara el alcance | No se interpreta automáticamente como Ciudad de Panamá o cobertura nacional |
| Empresa externa con instalación confirmada localmente y reparación documentada solo en otra ciudad | Coincide con instalación, no con reparación local; su inclusión por un servicio no confirma los demás |
| Fuente permitida con atribución obligatoria | Se publica el hecho solo con la atribución requerida y revisada |
| Fuente o uso con reutilización pendiente | Sus hechos no se publican |
| Perfil editorialmente revisado | Continúa mostrándose como perfil no reclamado; no obtiene verificación de propiedad |
| Se añade otra ciudad al catálogo geográfico | No se activa un nuevo mercado ni se crean páginas indexables |
| Visitante abre WhatsApp | Se mide intención de contacto si corresponde según consentimiento; no se crea cliente o lead |
| Empresa tiene sede local y cobertura confirmada | Se muestra una sola vez con ambos indicadores |
| Empresa local documenta reparación, sin zona de atención publicada | Puede aparecer en reparación con cobertura no confirmada; no aparece en el filtro de cobertura confirmada |
| Empresa local declara que no presta un servicio en la ciudad | Ese servicio no coincide con el filtro local; no se transforma la negativa en desconocimiento |
| Solo se conoce la categoría y existe presencia local documentada | Puede aparecer en categoría; ningún servicio se asigna automáticamente |
| Dos sociedades comparten teléfono o dominio | Se revisan; no se fusionan ni se rechazan por una unicidad global del contacto |
| Dos registros representan la misma empresa | Revisión administrativa, fusión auditada y alias hacia perfil canónico publicable |
| Contacto vence y el proceso programado no se ejecutó | La lectura pública igualmente deja de mostrar el botón |
| Cambia el número empresarial | Nuevo contacto con evidencia propia; el anterior se retira sin renovar indebidamente su respaldo |
| Perfil sin contactos digitales con dirección empresarial útil y permitida | Puede publicarse sin botones ni promesa de atención presencial |
| Perfil sin contacto vigente ni dirección útil | No publicable hasta corrección |
| Un visitante reporta un error | Se crea caso privado; no se cambia el perfil ni se concede acceso automáticamente |
| Retirada aprobada | Datos afectados ocultos, cachés y sitemap actualizados, prevención de republicación automática |
| Se pierde la evidencia de cobertura pero subsiste presencia local válida | El perfil puede permanecer con cobertura no confirmada |
| Fuente autoriza publicar la ciudad pero no la dirección completa | Solo se muestra presencia a nivel de ciudad; se exige otro contacto útil para publicar |


## 12. Preparación para migraciones y pendientes de lanzamiento

El diseño lógico de fase 1 puede pasar a redacción de migraciones revisables una vez aprobada v0.3. Se mantienen fuera las tablas empresariales y comerciales futuras. No se ha generado o aplicado SQL.

En la revisión de esas migraciones se concretarán tipos/longitudes, claves de coherencia entre empresa y evidencias, restricciones de opcionales, estados válidos, índices, privilegios, RLS y transacciones de publicación/fusión. En particular se probarán alias sin ciclos, coherencia de `canonical_company_id`, unicidad de ofertas con servicio ausente y de contactos activos con sede ausente. Ninguna similitud de nombre, teléfono o dominio será una restricción de identidad global.

Las pruebas locales deberán cubrir ambos motivos de inclusión, ofertas sin cobertura confirmada, exclusiones explícitas, contactos vencidos, borradores, reportes privados, fusiones y retiradas. La revisión documental no equivale a esas pruebas ejecutadas.

Antes de cargar/activar el mercado se necesita la identificación documental de Ciudad de Panamá. Antes de lanzar se cerrarán el responsable de la bandeja editorial, la retención operativa y el criterio de indexación. Los valores de revisión de contactos a 90 días y depuración de reportes a 90 días del cierre son recomendaciones iniciales, no decisiones comerciales ya aprobadas; la estructura guarda fechas efectivas por registro para permitir ajustarlas sin rediseño.

Estos aspectos no requieren ampliar el modelo a leads o reclamaciones de propiedad ni impiden redactar el DDL. Aplicar migraciones en Supabase y desplegar seguirán requiriendo autorización del usuario.

Las decisiones confirmadas de mercado, taxonomía y fases se mantienen. La inclusión por presencia física documentada corrige expresamente la restricción de v0.2. Esta actualización solo modifica documentos.
