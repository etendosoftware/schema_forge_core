#!/usr/bin/env node
/**
 * push-not-posted-documents.js
 *
 * Creates (or idempotently updates) the ETGO_SF_SPEC + ETGO_SF_ENTITY records
 * for the "not-posted-documents" fully-custom window.
 *
 * This window has no AD backing (no AD_Window / AD_Tab), so push-to-neo.js
 * cannot be used. Run this once after smartbuild or after `make regen` fails
 * to locate schema-raw.json (which does not exist for this window).
 *
 * After running: remind the user to run `./gradlew export.database` so the
 * config survives a rebuild.
 *
 * Usage:  node cli/src/push-not-posted-documents.js [--dry-run]
 */

import { createDbPool, closePool } from './db.js';

const SPEC_ID   = '4B056F343EAE4ACCAEB67E1B653CACF3';
const ENTITY_ID = '08E40F2DE08442FABAC3B540DB516036';
const SPEC_NAME = 'not-posted-documents';
const MODULE_ID = '94E1B433CF55451EABB764750AC5902A';  // com.etendoerp.go
const AD_CLIENT = '0';
const AD_ORG    = '0';
const CREATED_BY = '0';

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  const pool = createDbPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── ETGO_SF_SPEC ─────────────────────────────────────────────────────────────
    const specExists = await client.query(
      'SELECT etgo_sf_spec_id FROM etgo_sf_spec WHERE name = $1',
      [SPEC_NAME],
    );
    if (specExists.rows.length === 0) {
      console.log(`Creating ETGO_SF_SPEC: ${SPEC_NAME} (${SPEC_ID})`);
      if (!DRY_RUN) {
        await client.query(`
          INSERT INTO etgo_sf_spec (
            etgo_sf_spec_id, ad_client_id, ad_org_id, isactive,
            created, createdby, updated, updatedby,
            name, spec_type, ad_module_id
          ) VALUES ($1,$2,$3,'Y',NOW(),$4,NOW(),$4,$5,'W',$6)`,
          [SPEC_ID, AD_CLIENT, AD_ORG, CREATED_BY, SPEC_NAME, MODULE_ID],
        );
      }
    } else {
      const existingSpecId = specExists.rows[0].etgo_sf_spec_id;
      console.log(`ETGO_SF_SPEC already exists: ${SPEC_NAME} (${existingSpecId})`);
    }

    const resolvedSpecId = specExists.rows.length > 0
      ? specExists.rows[0].etgo_sf_spec_id
      : SPEC_ID;

    // ── ETGO_SF_ENTITY ────────────────────────────────────────────────────────────
    const entityExists = await client.query(
      'SELECT etgo_sf_entity_id FROM etgo_sf_entity WHERE etgo_sf_spec_id = $1 AND name = $2',
      [resolvedSpecId, 'header'],
    );
    if (entityExists.rows.length === 0) {
      console.log(`Creating ETGO_SF_ENTITY: header (qualifier=not-posted-documents)`);
      if (!DRY_RUN) {
        await client.query(`
          INSERT INTO etgo_sf_entity (
            etgo_sf_entity_id, ad_client_id, ad_org_id, isactive,
            created, createdby, updated, updatedby,
            etgo_sf_spec_id, name, java_qualifier, seqno, ad_module_id
          ) VALUES ($1,$2,$3,'Y',NOW(),$4,NOW(),$4,$5,'header','not-posted-documents',10,$6)`,
          [ENTITY_ID, AD_CLIENT, AD_ORG, CREATED_BY, resolvedSpecId, MODULE_ID],
        );
      }
    } else {
      const existingEntityId = entityExists.rows[0].etgo_sf_entity_id;
      console.log(`ETGO_SF_ENTITY already exists: header (${existingEntityId})`);
      if (!DRY_RUN) {
        await client.query(
          `UPDATE etgo_sf_entity SET java_qualifier = 'not-posted-documents'
           WHERE etgo_sf_entity_id = $1`,
          [existingEntityId],
        );
        console.log(`  → java_qualifier set to 'not-posted-documents'`);
      }
    }

    if (!DRY_RUN) {
      await client.query('COMMIT');
      console.log('Done. Remember to run ./gradlew export.database in the Etendo root.');
    } else {
      await client.query('ROLLBACK');
      console.log('[dry-run] No changes written.');
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await closePool(pool);
  }
}

run();
