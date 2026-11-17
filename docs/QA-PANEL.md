# Panel temporal HUT de desarrollo / QA

Ruta local: `http://127.0.0.1:3000/internal/qa`. Solo proyecto `lewlduoqmsdnmxfichus`.

## Abrir en Windows

```powershell
cd 'C:\Users\Carlos Pretto\Dev\hagamos-un-trato-app'
npm run qa:dev
```

Las dependencias están instaladas. `.env.local` local contiene URL y clave publishable, `HUT_QA_ENABLED=true` y `HUT_QA_ORIGIN=http://127.0.0.1:3000`. No se versiona. Si se recupera desde GitHub en otra máquina: `npm ci`, copiar `.env.example` a `.env.local`, completar la publishable y habilitar QA. Usar exactamente el origen configurado; `localhost` y `127.0.0.1` son orígenes distintos.

`qa:dev` enlaza únicamente a loopback. Para una compilación local: `npm run build` y `npm run qa:start`. No desplegar este panel públicamente. `HUT_QA_ENABLED=false` devuelve 404.

## Primer administrador real: una sola vez

No se ha creado una cuenta ficticia ni se ha elegido un correo por el usuario. El operador debe proporcionar la identidad real y una clave privilegiada del proyecto, **solo en `.env.local`**:

```dotenv
SUPABASE_SECRET_KEY=TU_CLAVE_SECRET_O_SERVICE_ROLE_DEL_PROYECTO
```

No ponerla en `NEXT_PUBLIC_`, argumentos de terminal, Git, capturas, logs ni chat. El resto del panel no requiere esa clave; únicamente bootstrap y creación de cuentas Auth.

En una terminal local:

```powershell
cd 'C:\Users\Carlos Pretto\Dev\hagamos-un-trato-app'
$env:HUT_QA_BOOTSTRAP = 'I_AUTHORIZE_HUT_DEV_BOOTSTRAP'
npm run qa:bootstrap -- --email 'TU_CORREO_REAL'
Remove-Item Env:HUT_QA_BOOTSTRAP
```

El script pide confirmación `CREAR` y contraseña de 12–128 caracteres con entrada oculta. Crea la cuenta Auth interna confirmada y consume transaccionalmente el bootstrap al asignar `admin`. **No habilita registro público.** Si la cuenta ya existe en Auth, usar en su lugar:

```powershell
$env:HUT_QA_BOOTSTRAP = 'I_AUTHORIZE_HUT_DEV_BOOTSTRAP'
npm run qa:bootstrap -- --user-id 'UUID_REAL_EXISTENTE'
Remove-Item Env:HUT_QA_BOOTSTRAP
```

Una vez que exista cualquier fila de personal, no se permite reutilizar bootstrap, ni siquiera si todos están suspendidos. Un conflicto de creación puede dejar una cuenta Auth sin rol; el error muestra únicamente el UUID y no la contraseña. No repetir operaciones de creación a ciegas.

Entrar al panel con ese email y contraseña. Después puede retirarse `SUPABASE_SECRET_KEY` de `.env.local` y reiniciarse Next si solo se habilitarán cuentas Auth existentes. Para crear cuentas adicionales desde Usuarios, conservarla exclusivamente en el servidor local. Los roles se asignan siempre con la sesión del administrador y las políticas existentes. Nadie puede modificarse su propio rol desde el puente QA.

## Secciones conectadas

- **Usuarios y permisos:** login/logout, cuenta y rol actual, creación Auth interna por admin, habilitación por UUID, `admin`/`editor`, suspensión/reactivación. El usuario Auth sin rol queda denegado; el editor no administra roles.
- **Geografía y mercados:** lectura y edición administrativa; alta de ubicaciones con URL documental; mercados nuevos siempre en borrador. La activación exige admin, revisión expresa, referencia, ciudad y jerarquía activa, país PA y código inicial `pa_ciudad_panama`. No se han inventado ni cargado límites. Solo activar si la referencia respalda realmente el ámbito configurado, incluidos sus descendientes.
- **Catálogo:** categorías/servicios de solo lectura, relación y detección de códigos duplicados dentro de categoría. No duplica semillas.
- **Empresas:** creación en borrador, campos editables, ofertas, sedes, cobertura por oferta/ubicación y contactos con vigencia. Los contactos no permiten sustituir valor/canal: crear otro registro y retirar el anterior.
- **Revisión editorial:** fuentes y reutilización, evidencia de destinos concretos, decisiones, correcciones/reportes, señales de duplicados e historial de operaciones en auditoría. No implica propiedad verificada. Ningún reporte modifica por sí mismo una empresa.
- **Simulador:** RPC `search_directory` y contexto de vista, siempre con un cliente anon nuevo sin sesión de personal. Filtros, texto, límite y offset; lista vacía válida.
- **Diagnóstico:** sesión/rol actuales, taxonomía, consulta RPC anónima y rechazo de acceso privado; PASS/FAIL/NOT TESTED. Infraestructura muestra por separado evidencia fechada del operador, no un resultado actual simulado.

Listas de trabajo limitadas a 200 registros por entidad; auditoría paginada por 100. Es una herramienta mínima de QA, no una consola de administración masiva.

## Recorrido rápido de prueba

1. Iniciar sesión con admin. Crear un editor interno o habilitar su UUID; probar en otra sesión/navegador. Una cuenta Auth sin rol no obtiene acceso por sus metadatos.
2. En Empresas crear con la casilla **Datos ficticios de QA** activada. Se añade prefijo `QA TEST`, slug `qa-test-` y `qa_test_batch` inmutable. La base prohíbe `published` permanentemente para esa empresa, también por actualizaciones directas.
3. Seleccionar la empresa en el filtro. Agregar oferta de categoría o servicio, contacto, sede/cobertura según datos de prueba. Para evidencia elegir un único destino; campos de empresa sin destino. Las fuentes ficticias deben identificarse claramente como pruebas y nunca respaldar perfiles reales.
4. Ejecutar requisitos de publicación: muestra las condiciones pendientes y el bloqueo QA TEST. El botón no publica una prueba aunque se completen las demás condiciones.
5. Admin puede **Limpiar prueba (archivar)**: archiva exclusivamente esa empresa marcada y sus componentes; conserva UUID, fuentes compartidas y auditoría. No es borrado físico ni limpieza masiva; los registros siguen visibles administrativamente como archivados.
6. El simulador público seguirá mostrando cero empresas si no hay mercado/perfiles reales publicables. Para verificar positivamente los casos publicables sin exponer fixtures se usan las pruebas transaccionales automatizadas.

Para un perfil real preparado con evidencia permitida: publicar componentes respaldados, resolver duplicados, registrar decisión `approved`, comprobar requisitos y usar la acción revisada de publicación. Las fechas/revisores editoriales se fijan en la operación según la sesión. Los errores SQL se muestran al personal autorizado; no se guardan contraseñas, tokens ni cargas privadas en logs de aplicación.

## Seguridad y pruebas

El navegador recibe cookies HttpOnly/SameSite Strict; la sesión se verifica con Auth `getUser` y el rol se consulta en cada operación. Las mutaciones exigen origen local exacto. Hay límites de cuerpo e intentos; no hay SQL arbitrario ni DELETE. Los datos privados se acceden mediante funciones públicas `SECURITY INVOKER` que siguen las RLS existentes, sin exponer el esquema privado. El helper privado de requisitos usa `SECURITY DEFINER` deliberadamente, verifica personal activo y no modifica datos.

```powershell
npm run validate
npm run build
# Con el servidor local ya abierto:
npm run qa:smoke-http
npm run qa:smoke-public
```

La suite reconstruye las diez migraciones en PGlite y revierte fixtures; la CI también utiliza Supabase local/PostgreSQL 17. Los datos ficticios de las pruebas positivas no se publican en la base alojada. Los diagnósticos de infraestructura corresponden al archivo fechado `supabase/qa-verification.json` y pueden volver a comprobarse mediante MCP directo. Las pruebas de sesión real con email/contraseña requieren que el operador complete bootstrap.

## Ajustes manuales y límites

Comprobar en el proyecto alojado (no afirmar verificados por este código):

- Data API: `public` expuesto y `private` fuera; privilegios explícitos para nuevas tablas.
- Auth: registro público y cuentas anónimas deshabilitados; URLs locales/redirect autorizados según los flujos usados; política de contraseñas apropiada. El panel usa email/contraseña y no activa signup ni enlaces de invitación.
- SMTP se necesita si posteriormente se usan invitaciones/recuperación; este panel implementa creación administrativa, no un flujo de invitaciones.
- Delimitación documental de Ciudad de Panamá antes de crear/activar su mercado. Retención, revisión y responsabilidades editoriales antes del lanzamiento.

No incluye fusión con traslado automático de hechos, purga física de datos, endpoint público de reportes, administración comercial definitiva, analítica ni despliegue. Los reportes se registran y resuelven internamente; las decisiones no conceden propiedad o membresías. La auditoría conserva operación/actor/entidad y las transiciones controladas de estado editorial, sin copiar motivos libres, mensajes o contactos completos.
