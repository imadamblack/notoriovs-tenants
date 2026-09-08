# Las páginas públicas del Tenant se sirven estáticas y se invalidan al guardar

Landing, quiz, gracias, no elegible y aviso de privacidad se prerrenderizan y
se sirven desde el CDN. Antes cada clic de anuncio abría una consulta a
Postgres y armaba el HTML de cero; con la base fría, el visitante esperaba.

La caché **no** se refresca por tiempo: un hook `afterChange`/`afterDelete` en
`tenants` invalida el sitio de ese tenant al guardarlo. El `revalidate = 3600`
de cada página es solo una red de seguridad por si esa invalidación falla
(un cambio hecho fuera del admin, un deploy a media escritura).

El dashboard de cliente queda fuera: es dinámico y se marca explícitamente
como tal.

## Por qué invalidar y no revalidar por tiempo

Un TTL corto le devuelve el tráfico a la base y aun así deja al cliente
viendo su landing vieja unos minutos después de guardarla. Un TTL largo hace
lo contrario. La invalidación bajo demanda resuelve las dos: el contenido se
refresca en segundos y la base solo se toca cuando algo cambió de verdad.

El hook invalida el **segmento completo** (`revalidatePath(path, 'layout')`),
no una lista de rutas. Una lista se desincroniza en cuanto alguien agrega una
página nueva, y el síntoma sería un cliente jurando que guardó y no pasó nada.

## Por qué el host se resuelve en el middleware y no en la página

Una página que lee el `host` con `headers()` es dinámica por definición: no se
puede prerrenderizar algo que depende de quién lo pide. La landing lo hacía
para decidir a dónde mandar al visitante cuando el tenant no tiene landing
configurada (`/survey` en el host real del tenant, `/tenant-site/{sub}/survey`
en el preview del admin).

Ahora la página redirige **siempre** a la ruta interna absoluta, y el
middleware es quien conoce el host: en el subdominio real del tenant
canonicaliza `/tenant-site/{sub}/x` de vuelta a `/x`, y en el preview del
admin la sirve tal cual. El visitante termina en la misma URL limpia que
antes, pero la página ya no depende del host y se puede cachear.

De paso cierra un hueco viejo: `acme.notoriovs.com/tenant-site/acme/survey`
servía el sitio duplicado en dos URLs.

## Consecuencias

- **Un Tenant nuevo se publica sin desplegar.** No hay `generateStaticParams`
  con la lista de tenants: el sitio se genera en la primera visita. Listarlos
  obligaría a tener la base disponible durante el build y a redesplegar por
  cada alta.
- **Un 404 también se cachea.** Si alguien entra a un subdominio antes de que
  exista el Tenant, ese 404 queda guardado; el hook de `create` lo tira.
- **La primera visita después de guardar paga el render.** Es la misma
  consulta que hoy paga *cada* visita, pero ahora la pagan una vez y el resto
  come del CDN.
- **`revalidate` va como literal en cada página.** Next lo lee con análisis
  estático y rechaza una constante importada. Un test verifica que los cinco
  literales sigan coincidiendo con `TENANT_SITE_REVALIDATE_SECONDS`.
- **Cambiar una Media no invalida nada.** Reemplazar el logo de un Tenant deja
  la página cacheada apuntando al blob anterior hasta que se guarde el Tenant
  o venza el TTL.
- **Esto asume una sola caché compartida (Vercel).** Con varias instancias
  self-hosted, la caché es por instancia y `revalidatePath` solo tocaría la
  que recibió el guardado; haría falta un cache handler compartido.
