# Claude Code

This project uses the Payload CMS skill at `.claude/skills/payload/`.
Start with `.claude/skills/payload/SKILL.md` for a quick reference, then see `.claude/skills/payload/reference/` for detailed docs.

## Pruebas

Esta suite es deliberadamente pequeña. Se prueban solo tres cosas, porque son
las únicas donde un error no se ve a simple vista y cuesta caro:

1. Autorización del dashboard — qué sesión abre los leads de qué cliente.
2. Aislamiento entre tenants — qué datos del Tenant pueden viajar a una página
   pública (tokens, contraseñas) y cuáles no.
3. Ruteo por subdominio en el middleware.

Todo lo demás (cache, formato de periodos, URLs de media, flujos de UI) se
verifica usando la app, no con pruebas. **No agregues pruebas fuera de esas tres
áreas sin que el usuario lo pida**, y no propongas restaurar los e2e: se
quitaron a propósito.

Al terminar un cambio: `npm run lint` siempre; `npm test` solo si tocaste una de
las tres áreas de arriba.
