# Mapa de implementación de Fase 1

Este documento describe la implementación de la arquitectura v0.3; no crea otra versión de arquitectura.

| Migración | Contenido |
| --- | --- |
| `20261117171305_foundation.sql` | Esquema privado, denegación inicial y privilegios predeterminados |
| `20261117171306_geography_and_markets.sql` | Países, jerarquía de ubicaciones y mercados independientes |
| `20261117171307_categories_and_services.sql` | Categorías configurables y servicios vinculados por FK compuesta |
| `20261117171309_companies_offerings_and_presence.sql` | Empresas, ofertas, declaraciones de cobertura y sedes |
| `20261117171310_contacts_pages_and_aliases.sql` | Contactos vigentes, páginas editoriales y alias canónicos |
| `20261117171311_evidence_and_editorial_administration.sql` | Fuentes, evidencia, personal, decisiones editoriales, reportes y auditoría |
| `20261117171312_integrity_security_and_publication.sql` | Triggers, comprobaciones de publicación, RLS, grants, proyección y búsqueda |
| `20261117171313_initial_taxonomy.sql` | Panamá inactivo, dos categorías y diez servicios; sin empresas ni mercado activo |

Las tablas se crean con RLS y sin privilegios anónimos ni autenticados antes de conceder acceso en la migración de seguridad. Por tanto, ejecutar solo un prefijo de la secuencia no abre tablas incompletas al público.

## Relaciones y tablas incluidas

- `countries` → `locations` → `directory_markets`: país coherente en toda relación territorial, ciclos prohibidos y ninguna ciudad activada por cargarla.
- `categories` → `services`: jerarquía de categorías sin ciclos; identidad de servicio dentro de categoría.
- `companies` → `company_offerings` → `offering_coverage`: cobertura por oferta, no por domicilio ni por una empresa globalmente «verificada».
- `companies` → `company_branches` / `company_contacts`: contacto y sede pertenecen a la misma empresa mediante FK compuesta.
- `directory_pages`: mercado/categoría/servicio/subámbito coherentes y combinación única incluyendo opcionales.
- `company_url_aliases`: slugs antiguos hacia empresas canónicas publicables, sin cadenas ni suplantación de slugs vigentes.
- `private.data_sources` → `private.company_sources`: autorización de reutilización y respaldo de hechos concretos. Los destinos opcionales son excluyentes; una evidencia de cobertura conserva su empresa incluso al reparentar.
- `private.company_editorial`: revisión de duplicados y decisión operativa separadas de propiedad empresarial.
- `private.company_reports`: correcciones/retiradas con respuesta opcional, sin crear clientes o reclamaciones de propiedad.
- `private.staff_roles`: autorización por usuario real de Auth; no por metadatos editables.
- `private.audit_log`: registro de operación e identidad de entidad; no copia números, mensajes ni valores completos.

## Por qué conservar las tablas pequeñas

`directory_markets` evita confundir catálogo geográfico con expansión comercial. `company_editorial` impide exponer motivos, duplicados y supresiones como campos públicos. `company_reports` permite una bandeja real y privada de correcciones; no es captación comercial. `company_url_aliases` conserva rutas después de fusiones o cambios de nombre. `directory_pages` permite decidir qué combinaciones útiles indexar, sin generar un CMS general.

No hay tabla de visitantes, sesiones, eventos analíticos, clientes, membresías empresariales, reclamaciones, verificación de propiedad, leads, matching, planes o pagos. `company_media` y Storage se omiten hasta que haya archivos con derechos de uso revisados.

## Operación editorial

Una empresa se prepara en borrador; se revisan procedencia, hechos y duplicados; se aprueba editorialmente y se publica solo con alguna oferta y base territorial válidas y un contacto vigente o dirección útil. `publication_status='published'` por sí solo no concede lectura: RLS vuelve a comprobar los requisitos efectivos.

Al cambiar un hecho se invalida la evidencia aprobada de ese destino hasta nueva revisión. Cambiar el valor de un contacto exige otro registro; renovar su fecha requiere evidencia al menos tan reciente como esa revisión. Una fuente bloqueada o un respaldo vencido dejan de sostener publicación inmediatamente.

Las retiradas/fusiones y reactivaciones sensibles exigen administrador; la retirada oculta el perfil. Una fusión se realiza como transacción administrativa explícita, conservando evidencia válida y fechas, resolviendo contradicciones y apuntando alias directamente al canónico. No hay una fusión automática por coincidencia de teléfono, dominio o nombre. No se requiere un motor de deduplicación adicional para la carga editorial del MVP.

Los reportes solo son editables por personal. El futuro endpoint de recepción debe validar entradas y limitar abuso; el navegador no tiene INSERT directo sobre la bandeja. Recibir un reporte no cambia automáticamente una empresa. La interfaz de administración, recepción de reportes, invalidación de cachés del directorio y tareas de purga deberán implementarse al construir esos recorridos; esta entrega prepara y prueba su soporte de datos y permisos, sin simular que la interfaz está operativa.

## Geografía y preparación pública

Panamá está inactivo. No se inventa el límite de Ciudad de Panamá ni se confunde con distrito, provincia o área metropolitana. Una vez revisada esa delimitación se cargarán las ubicaciones y un mercado inicialmente en borrador, mediante una migración posterior revisada. No debe activarse al aplicar estas ocho migraciones.

Los plazos recomendados de 90 días de v0.3 no se convierten en automatizaciones prematuras: los contactos y reportes almacenan sus fechas efectivas. Las políticas, responsables y tareas operativas se cerrarán antes del lanzamiento.
