# MFA del personal interno de HUT

## Estado y alcance

La migración local `20261120204226_staff_mfa_policy.sql` fue aplicada a Supabase Dev el 20/11/2026 con versión remota **`20261120212506`**. La estructura y los permisos se verificaron mediante el conector Supabase. **El flujo TOTP con una cuenta real y la recuperación no se han probado todavía.** No activar la exigencia para el personal existente antes de esas pruebas. El panel sigue limitado a loopback y no se publica. Véase [mfa-verification.json](../supabase/mfa-verification.json).

Esta política corresponde solo a filas activas de `private.staff_roles` (`admin` y `editor`). No crea cuentas de visitantes, empresas ni clientes. La columna `mfa_required` vale `false` para las filas presentes al aplicar la migración y `true` por defecto para las filas nuevas. Así se conserva el acceso del personal actual mientras se inscribe. La activación posterior de cada cuenta existente requiere una operación separada y autorizada, tras comprobar su inscripción y la recuperación.

## Inscripción y acceso

1. Cada integrante entra con su propia cuenta y contraseña en `/internal/qa`. El servidor verifica el usuario con Supabase Auth y consulta el rol activo en la base.
2. Si aún no tiene TOTP, elige **Configurar autenticador**. El servidor solicita `mfa.enroll`, muestra el QR y, como alternativa, el secreto solamente en esa pantalla. La persona lo registra en Google Authenticator u otra aplicación TOTP y escribe el código de seis dígitos. `challengeAndVerify` verifica el factor y Supabase emite una sesión AAL2.
3. Si una sesión nueva está en AAL1 y ya tiene un factor, el panel pide un código. Con dos factores puede elegir cuál usar. Al alcanzar AAL2, las cookies HttpOnly/SameSite Strict conservan la sesión durante la navegación y el refresco normal de tokens; no se solicita un código en cada página.
4. Una persona en AAL2 puede inscribir un segundo autenticador de respaldo desde el panel. Debe estar bajo su control y en un dispositivo independiente. El panel admite dos factores verificados. No genera códigos de recuperación ni guarda secretos TOTP.

El servidor deniega las acciones protegidas cuando `mfa_required=true` y la sesión no es AAL2. La base repite la condición dentro de `private.has_staff_role`, que alimenta RLS y las RPC administrativas. `public.qa_staff_context` solo revela al usuario autenticado su propio rol y si debe completar MFA, para que la pantalla de inscripción sea alcanzable en AAL1. Ni `user_metadata` ni comprobaciones del navegador conceden autorización.

## Recuperación

**Con factor de respaldo:** entrar con contraseña, usar el segundo factor para alcanzar AAL2 y avisar al operador del factor perdido. Tras validar la identidad y el factor que permanece, un operador autorizado retira el factor perdido mediante la API administrativa de Supabase Auth. La persona inscribe un nuevo respaldo. No compartir QR, secreto, código ni token con el operador.

**Sin ningún factor disponible:** el personal no recibe acceso administrativo en AAL1. Un operador con acceso privilegiado y otro responsable verifican la identidad por un canal previamente acordado, registran la solicitud y los IDs de cuenta/factor sin copiar secretos, y autorizan explícitamente retirar el factor perdido mediante `auth.admin.mfa.deleteFactor({userId,id})`. Esta API cierra las sesiones activas si el factor estaba verificado. El operador no cambia `mfa_required`, no crea un factor y no conoce el nuevo secreto. La persona vuelve a iniciar sesión y se inscribe por sí misma; solo tras alcanzar AAL2 recupera sus permisos. Si no se puede validar la identidad, suspender el rol y escalar; no omitir MFA.

La operación privilegiada de recuperación **no está automatizada ni probada contra el proyecto alojado**. Antes de activar obligatoriedad para las cuentas actuales, el equipo debe ensayarla con una cuenta de prueba interna autorizada y documentar doble aprobación, acceso a la clave privilegiada, auditoría y revocación de sesiones. Supabase Auth MFA para usuarios de aplicación no ofrece códigos de recuperación; el MFA de la cuenta del Dashboard de Supabase es otro producto.

## Activación controlada pendiente

1. **Completado:** aplicar y verificar la migración en Dev. Las dos filas existentes conservaron `mfa_required=false`, el valor predeterminado nuevo es `true`, las 64 políticas y 19 tablas con RLS permanecen. La configuración alojada de exposición de esquemas de Data API no se verificó en esta revisión.
2. Probar con cuentas internas reales o de prueba autorizadas: QR, código incorrecto, AAL2, sesión nueva AAL1, respaldo, salida/entrada, expiración/refresco, editor/admin, usuario sin rol y cuenta suspendida. Probar llamadas directas a RPC y RLS con JWT AAL1 y AAL2. Registrar resultados sin códigos ni tokens.
3. Probar el procedimiento de pérdida del autenticador en Dev y confirmar que el usuario recupera AAL2. Preparar un operador de respaldo antes de exigir MFA al único administrador.
4. Cada administrador/editor actual configura y verifica su factor. Tras comprobar la recuperación y obtener autorización específica, actualizar `mfa_required=true` por cuenta; no hacerlo en lote a ciegas. Verificar una sesión nueva para cada usuario.

La autorización se define por rol y una exigencia de AAL en `private.staff_roles`. Esto permite reglas diferentes para futuros tipos de usuario sin crear hoy sus tablas ni exigir MFA a visitantes. Cualquier futura ruta administrativa deberá usar la misma comprobación de servidor y RLS/RPC.

Referencias: [TOTP de Supabase](https://supabase.com/docs/guides/auth/auth-mfa/totp), [niveles AAL y políticas](https://supabase.com/docs/guides/auth/auth-mfa), [API de recuperación administrativa](https://supabase.com/docs/reference/javascript/auth-admin-deletefactor).
