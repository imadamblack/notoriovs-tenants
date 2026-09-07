# El modelo de subdominio por tenant obliga a mover el DNS de notoriovs.com

Cada Tenant vive en `{subdomain}.notoriovs.com`, así que dar de alta un
cliente no puede depender de que alguien cree un registro DNS a mano. Eso
exige un **wildcard** `*.notoriovs.com`, y Vercel solo emite certificados
wildcard si los **nameservers del dominio apuntan a Vercel o a un proveedor
que resuelva el reto DNS-01** (Cloudflare). Por eso los nameservers de
`notoriovs.com` se delegan a Cloudflare, aunque el dominio siga registrado
en GoDaddy.

Se descartó cambiar de dominio (que también resolvía el wildcard) porque los
8 tenants en producción tienen campañas pagadas activas: un dominio nuevo
obliga a re-verificarlo en Meta, a reconfigurar Aggregated Event Measurement
para tráfico iOS, y a editar anuncios activos con riesgo de reiniciar la fase
de aprendizaje. Mover nameservers no cambia ni una URL.

## Consecuencias

- La zona de `notoriovs.com` no es solo del sitio: lleva el correo
  corporativo de ~30 personas y los CNAME de n8n, SendGrid y otras
  plataformas. La migración se hace replicando **todos** los registros en
  Cloudflare y verificándolos contra un export de Bluehost **antes** de tocar
  los NS, no confiando en el escaneo automático.
- En Cloudflare, los registros de correo y los de autenticación de dominio de
  SendGrid van en **DNS-only** (sin proxy). Proxearlos los rompe.
