# 17: Tenants molde clonables

**What to build:** Dar de alta un cliente deja de ser capturar todo a mano: se
clona un Tenant molde de su vertical y se ajustan marca y textos. Se aprovecha el
duplicado que el panel ya ofrece; lo único que hay que resolver es que el
subdominio no choque al clonar.

**Blocked by:** 07 (extraer configuración de Tenants)

**Status:** ready-for-agent

- [ ] Un Tenant se puede marcar como molde
- [ ] Los moldes no se sirven como sitio público ni aparecen donde se listan Tenants reales
- [ ] Duplicar un molde produce un Tenant completo con landing, quiz y Pipeline, y un subdominio que no colisiona
- [ ] Existen moldes para inmobiliarias, seguros y autos
- [ ] Dar de alta un cliente nuevo a partir de un molde toma minutos, no una sesión de captura
