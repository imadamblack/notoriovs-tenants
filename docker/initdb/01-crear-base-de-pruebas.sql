-- La base de pruebas vive en el mismo servidor que la de desarrollo, pero
-- separada: `npm run test:e2e` borra y crea usuarios, y eso no puede tocar lo
-- que tengas a medias en el admin local.
CREATE DATABASE notoriovs_test OWNER notoriovs;
