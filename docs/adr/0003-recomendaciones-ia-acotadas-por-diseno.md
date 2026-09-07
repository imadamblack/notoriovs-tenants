# Las Recomendaciones creativas se publican sin revisión, pero acotadas por diseño

Las Recomendaciones creativas mensuales se generan con un LLM y llegan al
cliente **sin revisión humana previa**. El control de riesgo no es un paso de
aprobación: es el **alcance del output**. Una Recomendación solo puede emitir
hooks, guiones y sugerencias creativas para anuncios. Tiene prohibido por
diseño proponer montos, presupuestos o decisiones de inversión.

Revisar a mano una recomendación por tenant por mes no escala a cientos de
clientes sin contratar gente, y contratar gente es justo lo que el plan base
no paga. La alternativa —publicar sin revisión y sin límites— expone a
Notoriovs a que un modelo le diga a decenas de clientes a la vez que suban
su inversión en una campaña que no funciona. Acotar el *tipo* de output
resuelve el riesgo real a costo cero, y deja la interpretación de inversión
como el valor humano que el plan de agencia sí vende.

## Consecuencias

- La calidad depende de un **Perfil de marca** por tenant (oferta, cliente
  ideal, dolores, objeciones, tono). Sin ese insumo el modelo solo tiene
  métricas y produce texto genérico.
- Ese perfil vive dentro de `tenants`, de modo que el botón Duplicate de
  Payload lo arrastra al clonar un tenant molde por vertical.
- Toda Recomendación se publica con un disclaimer visible de que fue
  generada automáticamente.
