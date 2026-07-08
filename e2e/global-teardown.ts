import { closeDb } from './helpers/db'

/**
 * Global E2E teardown. Runs once after the suite.
 *
 * Closes the pg connection pool so the Node process can exit cleanly
 * (without it, the pool's idle client keeps the event loop alive).
 */
async function globalTeardown() {
  await closeDb()
}

export default globalTeardown