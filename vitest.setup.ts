// Los tests de integración hablan con Postgres, así que lo primero que pasa
// aquí es fijar la base de PRUEBAS. No uses `dotenv/config`: resuelve al `.env`,
// que es el de desarrollo.
import { loadTestEnv } from './tests/loadTestEnv'

loadTestEnv()
