-- Descripción canónica del esquema: tablas, columnas, índices y llaves.
-- Solo lectura. Sirve para comparar dos bases sin depender de la versión de
-- pg_dump ni del servidor.
\pset format unaligned
\pset tuples_only on
\pset footer off

SELECT 'SERVIDOR ' || current_setting('server_version');

SELECT texto FROM (
  SELECT 1 AS orden, 'COLUMNA ' || table_name || '.' || column_name || ' :: ' ||
         data_type || ' null=' || is_nullable || ' default=' || coalesce(column_default, '-') AS texto
  FROM information_schema.columns
  WHERE table_schema = 'public'
  UNION ALL
  SELECT 2, 'INDICE ' || indexname || ' :: ' || regexp_replace(indexdef, '^.*USING ', '')
  FROM pg_indexes WHERE schemaname = 'public'
  UNION ALL
  -- contype 'n' = restricciones NOT NULL catalogadas. Se excluyen a propósito:
  -- solo las versiones nuevas de Postgres las guardan aquí, así que compararlas
  -- entre un servidor viejo y uno nuevo inventa diferencias que no existen. La
  -- nulabilidad real ya viaja en cada renglón COLUMNA (null=YES/NO).
  SELECT 3, 'LLAVE ' || conrelid::regclass || ' ' || conname || ' :: ' || pg_get_constraintdef(oid)
  FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND contype <> 'n'
  UNION ALL
  SELECT 4, 'ENUM ' || t.typname || ' :: ' || string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typnamespace = 'public'::regnamespace GROUP BY t.typname
) x ORDER BY orden, texto;
