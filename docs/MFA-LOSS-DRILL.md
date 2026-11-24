# Ensayo controlado de pérdida de autenticador — Supabase Dev

**Estado:** procedimiento propuesto; ninguna cuenta, rol o factor se modifica por este documento. No usar la cuenta del administrador actual como sujeto de prueba. La política de cuentas existentes permanece en `mfa_required=false`.

## Preparación y autorización separada

1. Designar un segundo administrador real, distinto del sujeto de prueba, con sesión AAL2 y acceso de recuperación propio ya comprobado. Nombrar además un operador autorizado para la clave secret/service_role de **Dev**. El rol HUT `admin` por sí solo no permite llamar a `auth.admin.mfa.deleteFactor`.
2. Autorizar expresamente la creación de **una** cuenta interna controlada y su rol `editor` o `admin`, la inscripción de sus propios factores por la persona responsable y la eliminación posterior de **un factor de esa cuenta de prueba**. Fijar de antemano el identificador del proyecto, la cuenta y el factor objetivo en un registro privado de cambios. No poner IDs, claves, QR, códigos ni enlaces de recuperación en un PR o chat.
3. Comprobar mediante lectura que la cuenta de prueba es nueva, activa y tiene `mfa_required=true` por defecto. No cambiar el flag de cuentas existentes. Confirmar que el panel QA permanece solo en loopback y que `private` no está expuesto por Data API.

## Prueba de autorización AAL1/AAL2

1. La persona de prueba inicia sesión con contraseña: verificar `currentLevel=aal1`, rol propio y `mfa_required=true`. La pantalla de inscripción debe ser alcanzable, pero `GET /internal/qa/api?action=overview`, RPC `qa_records` y escrituras administrativas deben rechazarse. Comprobar RLS con la sesión AAL1 real: sin lectura privada ni actualización administrativa. No usar un JWT fabricado como sustituto de esta prueba alojada.
2. La persona inscribe TOTP mediante QR en su dispositivo, verifica el código y confirma `currentLevel=aal2`. Repetir las lecturas y una operación administrativa **de solo lectura** permitida para su rol. No crear ni modificar empresas para probar MFA.
3. Cerrar sesión e iniciar una nueva: comprobar AAL1 y rechazo de las mismas operaciones protegidas. Completar el desafío TOTP y confirmar AAL2 y acceso restaurado. Registrar solo estados, horas y códigos de error, nunca tokens ni códigos TOTP.

## Ensayo de pérdida y recuperación

1. Preferir primero un segundo factor TOTP independiente: demostrar que permite alcanzar AAL2 sin el primer dispositivo. Esto no requiere eliminar factores.
2. Para ensayar la pérdida total, el segundo administrador y el operador verifican por un canal acordado la identidad del responsable de la **cuenta de prueba**, revisan que el objetivo corresponde exactamente a esa cuenta y aprueban por separado la intervención. Conservar evidencia mínima de autorización en un registro privado; no copiar secretos.
3. Solo entonces el operador usa la API administrativa de Supabase Auth con una clave server-only de Dev para `deleteFactor({userId,id})` del factor autorizado. La eliminación de un factor verificado cierra sesiones activas. No eliminar factores de cuentas reales, no cambiar `mfa_required`, y no conceder acceso temporal AAL1. Si el resultado es ambiguo, consultar factores y sesiones antes de repetir; no borrar a ciegas.
4. La persona de prueba inicia sesión nuevamente: AAL1 debe seguir sin acceso protegido. Inscribe por sí misma un factor nuevo, verifica AAL2 y recupera el acceso correspondiente a su rol. Registrar que el factor retirado no funciona y que la auditoría Auth incluye el evento de eliminación. El operador no inscribe el dispositivo ni conoce su secreto.

## Criterios de cierre

- El segundo administrador mantiene acceso AAL2 durante todo el ensayo.
- Ninguna cuenta existente cambia su política MFA, rol o factores.
- Se observan denegación AAL1 y autorización AAL2 tanto en servidor como en base de datos.
- La recuperación de la cuenta controlada termina en AAL2 sin bypass y con sesiones anteriores revocadas.
- Si falla alguna comprobación, detenerse y conservar el estado para investigación; no revertir ni eliminar factores adicionales automáticamente.

Solo después de documentar ese resultado y obtener autorización nueva se podrá considerar `mfa_required=true` para cada cuenta existente, una por una.
