# Hagamos un Trato — Arquitectura del MVP v0.3

Fecha: 17 de noviembre de 2026.

Estado: propuesta de diseño actualizada con la adenda del usuario. Las decisiones comerciales de la adenda están confirmadas; los detalles técnicos de este documento siguen sujetos a revisión. Esta revisión sustituye únicamente las reglas incompatibles de v0.2 sobre inclusión territorial y añade controles de calidad editorial. Se conserva el resto del alcance. No contiene autorización para implementar, ejecutar SQL, crear proyectos, aplicar migraciones o desplegar.

Documento complementario: [Diccionario de datos v0.3](data-dictionary-v0.3.md).

## 1. Decisiones incorporadas

| Tema | Decisión confirmada | Consecuencia para el diseño |
| --- | --- | --- |
| Geografía | Lanzamiento limitado a Ciudad de Panamá | El mercado activo se configura expresamente; no se habilita todo el país al dar de alta Panamá |
| Expansión | Arquitectura multipaís y multiciudad | Empresas, taxonomía y ubicaciones conservan identidades independientes del mercado inicial |
| Presencia y cobertura | Una sede local documentada permite considerar la inclusión aunque no consten zonas de atención | La presencia física y la cobertura comercial se registran y comunican por separado; ninguna implica la otra |
| Perfiles | Información pública cuya reutilización esté permitida | Se exige revisión editorial de procedencia y condiciones de uso |
| Verificación | Perfiles no reclamados; reclamación y verificación en una fase posterior | Se retiran de fase 1 las verificaciones manuales de propiedad propuestas en v0.1 |
| Presentación | No presentar empresas como socios ni verificadas | La etiqueta inicial será «Perfil no reclamado», sin distintivos que sugieran afiliación o verificación |
| Taxonomía | Dos categorías y diez servicios iniciales | Los servicios se asignan individualmente con respaldo documental |

La revisión editorial comprueba qué información podemos publicar y qué afirma la fuente. No acredita representación legal, propiedad, calidad técnica, certificaciones, disponibilidad comercial ni participación en HUT.

## 2. Producto de fase 1

El recorrido público será: descubrir una categoría, buscar o filtrar empresas, consultar un perfil y abrir sus contactos públicos. HUT facilita el descubrimiento y el acceso al contacto directo; no promete gestionar comunicaciones, cotizaciones ni ventas.

Se implementarán directorio, perfiles, búsqueda, filtros por servicio y ubicación dentro del mercado de lanzamiento, SEO, administración editorial, diseño responsive y analítica con controles de privacidad. Los perfiles identificarán con claridad su condición de no reclamados. La ausencia de un contacto válido no se sustituirá por un botón o formulario que aparente estar operativo.

Quedan fuera de esta fase las cuentas empresariales, reclamaciones, verificaciones de propiedad, captación de clientes, formularios de cotización, matching comercial, distribución de leads, suscripciones, cobros y comisiones. Tampoco se introducirán reseñas, valoraciones o certificaciones sin un alcance y un proceso específicos posteriores.

## 3. Arquitectura técnica

Una aplicación Next.js con TypeScript contendrá el directorio y la administración. Los módulos iniciales serán catálogo, búsqueda, publicación editorial, SEO y analítica. Supabase PostgreSQL será la fuente de verdad del catálogo; Supabase Auth identificará únicamente al personal de HUT durante esta fase. No se crearán cuentas para visitantes anónimos. Storage se utilizará solo si se incorporan archivos con derechos de uso revisados.

Las páginas públicas se renderizarán desde Next.js. El acceso público al catálogo respetará RLS y permisos explícitos. Las operaciones del personal comprobarán sesión y autorización en el servidor. Las credenciales privilegiadas permanecerán exclusivamente en el servidor y su uso se limitará a operaciones controladas.

El catálogo publicable y los registros privados tendrán separación de permisos y de almacenamiento lógico. Evidencias, notas editoriales, decisiones de reutilización, identidades del personal y auditoría no formarán parte de las respuestas públicas.

El repositorio previsto para la aplicación sigue siendo `hagamos-un-trato-app`. `hagamos-un-trato-brand` conservará la identidad visual. Este documento no crea ni modifica esos repositorios.


## 4. Geografía, presencia física y cobertura comercial

`directory_markets` distingue el mercado habilitado del catálogo geográfico. Ciudad de Panamá sigue siendo el único mercado inicial. No se equiparará automáticamente con distrito, provincia, área metropolitana ni Panamá Oeste. Su referencia y ámbito se documentarán antes de cargar datos; no se inventarán códigos ni límites. Añadir otras ubicaciones no las activa como mercados.

La presencia física y la cobertura son dos ejes independientes. Una empresa puede tener ambos. La cobertura se evalúa por oferta y mercado, nunca como una afirmación global que habilite todos sus servicios.

| Información respaldada | Inclusión propuesta | Comunicación pública |
| --- | --- | --- |
| Sede física documentada en la ciudad, sin cobertura confirmada | Puede aparecer por presencia local si cumple los requisitos editoriales mínimos | «Presencia física documentada en Ciudad de Panamá» y «Cobertura no confirmada. Consulta directamente si atiende tu zona» |
| Cobertura confirmada de una oferta para la ciudad, con o sin sede local | Puede aparecer por esa oferta | «Cobertura confirmada para [servicio] en Ciudad de Panamá, según información pública revisada» |
| Sede documentada y cobertura confirmada | Aparece una sola vez, pudiendo mostrar ambas características | Etiquetas independientes de presencia y cobertura específica |
| Sin sede local documentada ni cobertura confirmada para la ciudad | Permanece en borrador para este mercado | La cobertura desconocida, por sí sola, no acredita relación con el mercado |

La inclusión por dirección exige evidencia de presencia empresarial actual y reutilización permitida, no solo una dirección encontrada en una fuente sin revisar. No exige que la dirección completa sea publicable: puede publicarse únicamente la ciudad cuando eso sea lo permitido y exista otro elemento útil de contacto. La sede no implica atención al público, servicio a domicilio ni disponibilidad.

Una declaración explícita de que un servicio no se presta en la ciudad se registra como `not_served` y no se convierte en «no confirmado». Si hay evidencia contradictoria sin resolver, se registra `disputed` para esa oferta y ámbito: no se mostrará cobertura confirmada y la oferta se suspenderá de los resultados locales hasta revisión. Conservar ese estado impide que una cobertura general o la presencia local lo conviertan por defecto en desconocido. Son excepciones documentadas al recorrido habitual de cobertura confirmada o sin confirmar. Ninguna borra por sí sola la existencia de una sede física documentada.

La ausencia de una declaración vigente para una oferta y mercado se interpreta como `unconfirmed`. No se crearán filas de cobertura afirmativa ni combinaciones empresa/servicio/ciudad para rellenar desconocidos. Una declaración territorial más amplia solo cubrirá la ciudad si su alcance y jerarquía lo respaldan inequívocamente. «Panamá» ambiguo no se interpreta como ciudad ni como cobertura nacional.

Los resultados predeterminados podrán combinar empresas con presencia local y empresas con cobertura confirmada, con etiquetas y conteos distintos. Los filtros «Con presencia física documentada» y «Con cobertura confirmada» serán independientes; el segundo exigirá cobertura del servicio seleccionado o de la categoría, según el contexto. Una cobertura genérica de categoría no confirma automáticamente sus servicios. Los conteos usarán empresas distintas para no duplicar las que cumplen ambos criterios.

Las páginas por servicio podrán incluir empresas locales que documentan ese servicio y cuya cobertura local está sin confirmar, con el aviso junto a la oferta. El título y la descripción de esos listados no prometerán que todas atienden la zona. Las ofertas explícitamente excluidas de la ciudad o en disputa no coincidirán con ese filtro de servicio. No se expondrán mercados futuros ni filtros territoriales sin información suficiente.

## 5. Taxonomía inicial

| Categoría | Código estable propuesto | Servicios confirmados |
| --- | --- | --- |
| Aire acondicionado | `aire_acondicionado` | Instalación; reparación; mantenimiento preventivo; limpieza; venta de equipos |
| Energía solar | `energia_solar` | Instalación; mantenimiento; reparación; diseño y dimensionamiento; venta de equipos |

Cada servicio tendrá identidad propia dentro de su categoría. «Instalación» de aire acondicionado y «Instalación» de energía solar serán registros distintos. «Diseño y dimensionamiento» será inicialmente un único servicio, conforme a la adenda.

Se conserva la jerarquía de categorías mediante `categories.parent_id`, pero los diez servicios no se convertirán en subcategorías ni se crearán subcategorías adicionales sin una decisión posterior.

No habrá atribución por inferencia: venta no implica instalación; reparación no implica mantenimiento preventivo; mantenimiento preventivo no implica limpieza; diseño no implica instalación. Una mención genérica de categoría no habilita filtros de servicios específicos.

## 6. Modelo de catálogo y evidencia

Las relaciones centrales son:

- Una empresa tiene muchas ofertas, contactos y, opcionalmente, sedes.
- Una oferta identifica una categoría y, si consta documentalmente, un servicio concreto.
- Cada oferta tiene su propia cobertura; no se aplica la cobertura de un servicio automáticamente a los demás.
- La categoría de un servicio debe coincidir con la categoría de la oferta.
- Las coberturas apuntan a ubicaciones revisadas; las direcciones físicas se registran por separado.
- Las fuentes y los registros de evidencia respaldan hechos identificables del perfil, sus servicios, contactos o coberturas.

`company_offerings.service_id` será opcional. Su ausencia significa «solo consta la categoría», no «todos los servicios» ni «otro servicio». Una oferta general puede aparecer en la categoría si la empresa tiene presencia local documentada o cobertura compatible respaldada; no coincidirá con filtros de un servicio específico.

Se permite que el respaldo del servicio y el de su cobertura procedan de fuentes diferentes, siempre que la revisión documente que la cobertura aplica a esa oferta. No se extenderá una declaración territorial ambigua a todos los servicios.

Para publicar una empresa se exigirá identidad y categoría respaldadas, permisos de reutilización aplicables, revisión de duplicados resuelta, relación territorial acreditada por presencia física local O cobertura confirmada, y un mínimo de utilidad pública. La presencia física documentada basta como base territorial aunque la cobertura esté sin confirmar. El mínimo útil será al menos un contacto empresarial vigente —incluido sitio web— o una dirección física publicable y suficientemente concreta para localizar la empresa, sin prometer atención presencial. Una categoría específica puede seguir siendo visible por presencia local aunque sus servicios conocidos estén excluidos de cobertura local, pero esos servicios se identificarán como no disponibles y no coincidirán con filtros de servicio.

## 7. Flujo editorial de fase 1

1. Registrar la fuente y revisar sus condiciones de reutilización para los usos previstos.
2. Crear la empresa en borrador y comprobar posibles duplicados.
3. Incorporar únicamente los campos respaldados; guardar referencias y fechas de consulta.
4. Registrar por separado categoría, servicios concretos, cobertura, sedes y contactos.
5. Revisar la evidencia de cada servicio, presencia y declaración de cobertura. Los servicios sin respaldo no se publican; la cobertura desconocida se comunica como desconocida, sin impedir la inclusión por presencia local documentada.
6. Comprobar elegibilidad para el mercado activo y obligaciones de atribución.
7. Publicar el perfil y sus componentes aprobados; registrar la acción en auditoría.
8. Programar revisión de contactos y hechos publicados; atender correcciones o retiradas mediante la bandeja privada descrita a continuación.

Una página accesible públicamente no implica permiso de reutilización. Se guardará la decisión aplicable a los campos usados, incluyendo restricciones de textos, imágenes, contactos y obligaciones de atribución. No se conservarán copias completas de páginas ni documentos innecesarios por defecto.

La etiqueta pública «Perfil no reclamado» podrá acompañarse de una explicación como: «Este perfil contiene información pública revisada por HUT. La empresa no administra este perfil y no se ha verificado su representación». Solo se utilizará si describe correctamente el proceso realizado. No se afirmará que una empresa es socia o está disponible para recibir oportunidades.

### 7.1. Prevención y resolución de duplicados

Antes de publicar, el editor consultará candidatos por nombre normalizado, dominio empresarial, teléfonos, dirección y referencias de origen. Ninguna de estas señales aisladas será una clave única de identidad: empresas distintas pueden compartir teléfonos, dominios, sedes o marca. Sucursales de una misma empresa se modelan como sedes, mientras que franquicias o sociedades diferentes no se fusionan automáticamente.

`company_editorial` guardará el resultado de revisión de duplicados y la decisión de publicación. Las coincidencias dudosas bloquean la publicación del registro nuevo hasta revisión; una coincidencia heurística no retira automáticamente un perfil existente. La misma fuente o registro de origen se comprobará antes de crear otra empresa. En fase 1 este proceso será editorial; un importador masivo futuro requerirá además su propio control transaccional de idempotencia antes de habilitarse.

La fusión será una operación administrativa explícita y transaccional: elegir empresa canónica, trasladar hechos y evidencias válidos conservando su procedencia y fechas, resolver contactos y coberturas incompatibles, archivar el duplicado y registrar la decisión. No se arrastrarán permisos de reutilización ni estados de vigencia de forma indiscriminada. El UUID original se conservará para historia; los slugs antiguos se resolverán mediante `company_url_aliases` hacia la empresa canónica publicable. No habrá cadenas o ciclos de redirección, ni redirecciones de una retirada por privacidad hacia otro perfil.

### 7.2. Contactos desactualizados

`company_contacts` añadirá estado de calidad y fechas de revisión. Un contacto solo genera un botón si está publicado, revisado, vigente y sin incidencia pendiente que comprometa su uso. El formato válido no demuestra que la empresa controle el canal. Una revisión editorial no se presentará como llamada realizada o entrega confirmada si no se hizo tal comprobación.

Se propone un plazo inicial de revisión de 90 días, configurable como política operativa y reducido cuando la fuente imponga una fecha anterior. La fecha efectiva se guardará en cada contacto. Al vencer, el contacto deja de generar botones hasta revisión, incluso si una tarea programada no ha actualizado todavía su estado. Una denuncia creíble de número equivocado o dato personal puede motivar ocultación preventiva por un editor; el envío del reporte no lo modifica automáticamente.

Para un valor nuevo se crea otro contacto con su evidencia y se retira el anterior; no se sobrescribe el valor dejando evidencia del número viejo como respaldo del nuevo. Reconsultar el mismo valor permite renovar su revisión con evidencia reciente. Una fusión de empresas no reinicia estas fechas. Si quedan otros contactos o una dirección útil, el perfil puede permanecer publicado; si pierde el mínimo útil, deja de ser publicable hasta corregirse. No se enviarán mensajes ni llamadas de comprobación automáticamente.

### 7.3. Correcciones y retiradas

Se incorporará una acción real «Reportar información o solicitar retirada», independiente de cotizaciones y reclamaciones de propiedad. Las solicitudes se guardarán en `company_reports`, privada, con empresa afectada, tipo, explicación breve, contacto de respuesta opcional y resolución. No se pedirá cuenta, documento de identidad ni prueba de propiedad por defecto; no habrá archivos adjuntos en el MVP.

El formulario enviará al backend de Next.js con validación, límites de tamaño, protección contra abuso y límites de frecuencia. El navegador no tendrá permisos directos de lectura o escritura sobre la tabla. El reporte será contenido no confiable y no ejecutará cambios, publicaciones, fusiones ni concesiones de acceso. El personal hará triaje, podrá ocultar preventivamente el dato afectado cuando sea necesario, revisará evidencia y registrará corrección, retirada, fusión o rechazo justificado. Para cuestiones sensibles, la gestión se elevará a un administrador; no se prometerán plazos legales que no estén definidos.

Una corrección deberá tener respaldo y permiso de publicación. Identificar al remitente no significa verificar la propiedad del perfil. Una retirada aprobada ocultará los datos afectados, invalidará cachés y eliminará el perfil del sitemap cuando corresponda. Se mantendrá el mínimo registro privado necesario para impedir su republicación automática por una carga posterior. Reactivar una empresa retirada requerirá una decisión administrativa explícita.

Se propone purgar el correo de respuesta y el texto libre 90 días después del cierre, salvo una necesidad documentada de conservación; solo permanecerá el resumen mínimo de resolución que corresponda. La política final y el responsable de atender la bandeja se fijarán antes del lanzamiento. No se crearán clientes, leads ni suscripciones a partir de estos reportes y su contenido no se enviará a GA4.

### 7.4. Perfiles incompletos

| Información ausente o problemática | Tratamiento propuesto |
| --- | --- |
| Cobertura desconocida, con presencia física local documentada | Publicable con aviso; no coincide con «Cobertura confirmada» |
| Servicios específicos desconocidos, categoría respaldada | Publicable en la categoría; no se asignan servicios |
| Logo, razón social, descripción extensa o dirección completa ausentes | No bloquean por sí solos; no se inventan datos |
| Sin contacto digital, pero con dirección útil y publicable | Puede publicarse sin botones; no se promete atención al público |
| Sin contacto vigente ni dirección útil publicable | Borrador u ocultación hasta recuperar utilidad |
| Sin identidad/categoría respaldada, sin relación territorial acreditada o sin permiso de reutilización | No publicable |
| Posible duplicado sin resolver, retirada vigente o conflicto material de identidad | Bloqueo editorial antes de publicar |

## 8. Permisos y seguridad

En fase 1 solo existirán visitantes y personal autorizado. Los visitantes leerán datos publicados y limitados al mercado activo. Los editores y administradores tendrán permisos según sus funciones; editar contenido no permitirá concederse roles.

Las tablas expuestas tendrán RLS y privilegios explícitos. Los datos hijos respetarán la visibilidad de su empresa, su oferta y el mercado. Borradores, contactos ocultos y coberturas pendientes no se filtrarán mediante búsquedas, conteos, vistas o endpoints alternativos. Las vistas públicas respetarán los permisos y políticas del usuario que consulta.

La evidencia, decisiones editoriales, controles de duplicados y solicitudes de corrección estarán en un esquema privado no expuesto. Las tablas públicas solo conservarán los campos y estados necesarios para expresar información publicable; el público no consultará la bandeja privada para determinar visibilidad. Las decisiones internas se reflejarán transaccionalmente en los estados públicos y en la invalidación de cachés. El envío de reportes usará una operación de servidor limitada, sin habilitar INSERT o SELECT anónimo sobre las tablas privadas. Las identidades del personal y notas internas tampoco se publicarán. Las atribuciones requeridas por una fuente se trasladarán a campos públicos aprobados mediante un proceso controlado.

Las pruebas futuras cubrirán lectura anónima, ocultación de borradores, diferenciación presencia/cobertura, contactos vencidos, filtros de servicio, permisos del personal, alcance territorial y ausencia de filtraciones de evidencia o reportes. También se comprobarán fusiones, alias y retiradas en rutas directas y cachés. Las pruebas entre empresas se añadirán cuando se implementen membresías.

## 9. SEO y analítica

Las rutas públicas deben dejar explícita la ciudad. Se propone una base como `/pa/ciudad-de-panama/aire-acondicionado` y `/pa/ciudad-de-panama/energia-solar`, con perfil canónico `/empresas/{slug}`. Son rutas de diseño, todavía no creadas. Las páginas generales de país no insinuarán cobertura de todo Panamá ni contendrán listados nacionales durante el piloto.

Solo las páginas revisadas, con contenido útil y empresas reales, podrán indexarse. Los datos estructurados de dirección describirán presencia física; las afirmaciones de área atendida requerirán cobertura confirmada específica. Los listados mixtos usarán títulos como «Empresas de aire acondicionado con presencia o cobertura en Ciudad de Panamá», evitando promesas de atención local para todas. Los perfiles incompletos podrán mantenerse en noindex hasta satisfacer el criterio editorial de utilidad. Una retirada o fusión actualizará rutas, sitemap y cachés de forma coherente. Los filtros y las búsquedas internas no generarán automáticamente páginas indexables. Si en el futuro una empresa aparece en varios mercados, conservará su identidad y su perfil canónico.

Se mantienen `category_view`, `search_performed`, `company_profile_view`, `contact_click`, `website_outbound_click`, `filter_applied` y `referral_visit`. Los eventos identificarán el mercado mediante un código controlado y podrán distinguir `physical_presence` y `confirmed_coverage` como contexto de resultados, sin incluir evidencia o mensajes de reportes. La ubicación buscada o seleccionada se distinguirá de la ubicación estimada del visitante.

GA4 medirá interacción y adquisición bajo las preferencias de privacidad; Search Console medirá rendimiento en Google. No se creará una tabla de visitantes o sesiones anónimas en Supabase. Las búsquedas libres, teléfonos, correos y URLs sin depurar no se enviarán a analítica. El término «conversión» no se usará para presentar clics como contactos efectivos o ventas.

`referral_visit` podrá medir referencias o campañas aprobadas. No habilita cuentas de afiliados, atribución comercial ni comisiones.

## 10. Tablas por fase

| Fase | Tablas |
| --- | --- |
| 1 — Directorio | `countries`, `locations`, `directory_markets`, `categories`, `services`, `companies`, `company_offerings`, `offering_coverage`, `company_branches`, `company_contacts`, `directory_pages`, `company_url_aliases` |
| 1 — Administración privada | `data_sources`, `company_sources`, `company_editorial`, `company_reports`, `staff_roles`, `audit_log` |
| 1 — Solo si se necesitan archivos | `company_media`, además de políticas de Storage específicas |
| 2 — Empresas | `user_profiles`, `company_members`, `company_invitations`, `company_claims`, `company_change_requests`, `company_verifications` |
| 3 — Clientes y oportunidades | Formularios versionados, clientes, solicitudes, consentimientos, ejecuciones de matching, candidatos y asignaciones de leads |
| 3 — Monetización y afiliados | Planes, suscripciones, cargos, eventos de facturación, afiliados, enlaces, atribuciones y comisiones |

Se elimina `company_verifications` del alcance de tablas de fase 1. Tampoco habrá columnas editables de «socio», «verificado» o «reclamado» en el catálogo inicial. La presentación «no reclamado» será una regla del producto mientras no exista el módulo de reclamación. Las nuevas tablas se incorporarán con migraciones aditivas cuando se apruebe su fase.

## 11. Preparación comercial futura

La fase 2 añadirá usuarios empresariales mediante membresías: varias personas por empresa y varias empresas por persona. Una reclamación aprobada y una comprobación de propiedad tendrán sus propios registros, responsables y vigencias. La revisión de fuentes de fase 1 no se convertirá retroactivamente en verificación de propiedad.

La fase 3 reutilizará las ofertas y coberturas, añadiendo elegibilidad comercial: participación explícita, disponibilidad y capacidad de respuesta. Una solicitud será la necesidad del cliente; cada asignación de lead será una oportunidad entregada a una empresa. Se conservarán versiones de formularios y reglas de matching, autorizaciones de uso de datos y estados diferenciados.

Precios, ventanas de atribución, condiciones de comisión, proveedor de pagos y políticas de distribución se decidirán antes de implementar esa fase. La existencia de un perfil en el directorio no significará aceptación de leads ni de condiciones comerciales.

## 12. Plan de implementación posterior a la aprobación

1. Cerrar el diccionario y la identificación documental de Ciudad de Panamá.
2. Preparar repositorio de aplicación y entornos separados, con versiones fijadas.
3. Crear migraciones versionadas de geografía, mercados y taxonomía; después catálogo y evidencia; después administración y búsqueda. Cada objeto incluirá permisos y RLS desde su introducción.
4. Incorporar el catálogo inicial revisado de categorías, servicios y geografía. Las empresas se cargarán mediante el flujo editorial, sin registros ficticios en producción.
5. Construir administración, directorio responsive, SEO y controles de privacidad.
6. Validar datos, recorridos, autorización y eventos en un entorno de prueba.
7. Presentar el resultado listo para revisión; desplegar producción solo tras autorización.

Este plan describe trabajo futuro. No se ha generado ni ejecutado una migración como parte de la actualización documental.

## 13. Criterios de lanzamiento actualizados

- Ciudad de Panamá es el único mercado activo y su ámbito está documentado.
- No hay páginas, filtros o mensajes que ofrezcan mercados aún no habilitados.
- Cada empresa publicada tiene identidad, categoría, revisión de duplicados y utilidad mínima, con procedencia y reutilización revisadas; su inclusión se respalda por presencia física local O cobertura confirmada.
- Cada servicio visible tiene evidencia específica. Los filtros no amplían servicios por inferencia.
- Todas las empresas aparecen como perfiles no reclamados, sin distintivos de propiedad verificada, asociación o disponibilidad comercial.
- La interfaz distingue presencia física, cobertura confirmada y cobertura no confirmada; las dos primeras pueden coexistir y los filtros no las confunden.
- Los contactos visibles son empresariales, publicables, revisados y no vencidos; no se promete disponibilidad del canal ni seguimiento por HUT.
- Las atribuciones exigidas se muestran y funciona una bandeja atendida de correcciones y retirada, con responsable y retención definidos.
- Duplicados, fusiones y retiradas tienen procedimientos probados; las cargas posteriores no republican perfiles retirados sin revisión administrativa.
- Búsqueda, filtros, estados vacíos, renderizado responsive y SEO funcionan sobre datos reales.
- Las páginas indexables tienen contenido y oferta suficientes según un criterio editorial documentado antes de publicarlas.
- Las pruebas de permisos, privacidad y analítica están completadas; los eventos no se presentan como ventas.
- No existen formularios de cotización, distribución de leads, cobros ni programas comerciales aparentando estar activos.

La siguiente revisión deberá validar los detalles técnicos propuestos y el ámbito geográfico documental. La geografía inicial, la ausencia de reclamación/verificación en fase 1 y los diez servicios de la adenda ya están decididos.


## 14. Recomendación de preparación para migraciones

El modelo lógico de fase 1 está listo para pasar a redacción y revisión de migraciones SQL una vez aprobada esta revisión. Las dos bases de inclusión territorial, los estados de cobertura, los mínimos de publicación y los controles editoriales tienen representación concreta. No hace falta implementar tablas de fases 2 y 3 para resolverlos.

Antes de aplicar una migración, su revisión técnica debe concretar tipos, restricciones de unicidad con valores opcionales, claves que garanticen coherencia de empresa en evidencias, índices, RLS, privilegios y las operaciones transaccionales de publicación y fusión. Es trabajo de implementación del diseño, con pruebas locales desde una base vacía y pruebas de autorización; este documento no declara esas pruebas ejecutadas.

La identificación geográfica documental es requisito para cargar y activar Ciudad de Panamá, pero no impide redactar las tablas geográficas. Los plazos propuestos de revisión de contactos y retención de reportes, el responsable editorial y el umbral de indexación deben cerrarse antes de activar esos procesos y lanzar. No bloquean la estructura propuesta porque se almacenan fechas por registro y se separa publicación de indexación.

Recomendación: aprobar el alcance lógico de fase 1 para preparar migraciones revisables, sin autorizar todavía su aplicación remota, cambios en Supabase o despliegues. Esta actualización solo modifica documentos.
