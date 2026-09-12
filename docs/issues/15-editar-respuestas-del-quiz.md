# 15: Editar las respuestas del quiz

**What to build:** Las respuestas del quiz son campos del Lead como cualquier
otro. Si el lead se equivocó al contestar ("dijo 3 recámaras, por teléfono
aclaró que 2"), quien lo atiende lo edita en el panel de edición del lead y ya:
lo editado es lo que vale para mostrar, exportar y medir.

> Decisión del 11/09/2026 (cambia el planteamiento original, que guardaba la
> respuesta cruda intacta y medía sobre ella): si el lead se equivocó y el
> vendedor lo corrige, la medición mejora usando lo corregido. Sin historial,
> sin marca de "corregido" y sin deshacer — es una edición, no una anotación.

**Blocked by:** None (can start immediately)

**Status:** IMPLEMENTADO en `dev` (commit 2a40214, 2026-09-11), sin desplegar.

- [x] Las respuestas se editan en el panel de edición del lead, junto al resto
      de sus campos, y se guardan con el mismo botón
- [x] Una pregunta de opciones se edita con un select de esas mismas opciones:
      editar no puede inventar categorías que ningún reporte sabe contar
- [x] Se puede llenar una pregunta que el lead dejó en blanco, y vaciar una
      que sí contestó
- [x] Guardar una respuesta no borra las demás, ni toca los datos de contacto
      (esos se editan en sus propios campos)
