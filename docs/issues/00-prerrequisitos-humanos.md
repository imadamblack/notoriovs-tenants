# 00: Prerrequisitos humanos (DNS y correo)

**What to build:** Trabajo de infraestructura que un agente no puede hacer y que
desbloquea el alta automática de Tenants y todo el correo transaccional.

**Blocked by:** None (can start immediately)

**Status:** human-only

- [ ] Exportar la zona DNS completa de `notoriovs.com` desde el proveedor actual
- [ ] Importar esa zona en Cloudflare y **diffear registro por registro**: MX, SPF, DKIM de Google Workspace, DMARC, CNAMEs de SendGrid y n8n, verificación de dominio de Meta, y los subdominios de los 8 Tenants actuales
- [ ] Dejar en DNS-only (sin proxy) todo lo de correo y toda la autenticación de dominio de SendGrid
- [ ] Bajar TTLs a 300s al menos 48h antes de mover los nameservers
- [ ] Delegar nameservers a Cloudflare (el dominio sigue registrado donde está)
- [ ] Confirmar que llega y sale correo de los ~30 buzones corporativos, y que n8n y SendGrid siguen resolviendo
- [ ] Agregar el dominio wildcard en Vercel y verificar que un subdominio nuevo resuelve sin darlo de alta a mano
- [ ] No borrar la zona vieja durante 2-3 semanas
- [ ] Cuenta de SendGrid con el dominio remitente de Notoriovs verificado
