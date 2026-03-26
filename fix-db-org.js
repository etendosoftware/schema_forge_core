import { createDbPool } from './cli/src/db.js';

async function run() {
  const pool = createDbPool();
  try {
    let res = await pool.query(`SELECT etgo_sf_entity_id, name, ad_client_id, ad_org_id, ad_module_id FROM etgo_sf_entity WHERE etgo_sf_spec_id = '9674B1E8EF214C97AE5CE0AEC40670DE' AND name = 'bpartnerDocType'`);
    const entity = res.rows[0];
    const entityId = entity.etgo_sf_entity_id;
    const clientId = entity.ad_client_id;
    const orgId = entity.ad_org_id;
    const moduleId = entity.ad_module_id;

    res = await pool.query(`
      SELECT c.ad_column_id
      FROM ad_column c
      JOIN ad_table t ON c.ad_table_id = t.ad_table_id
      WHERE t.tablename = 'C_BPartner_DocType' AND c.columnname = 'AD_Org_ID'
    `);
    const columnId = res.rows[0].ad_column_id;

    res = await pool.query(`SELECT 1 FROM etgo_sf_field WHERE etgo_sf_entity_id = $1 AND ad_column_id = $2`, [entityId, columnId]);
    if (res.rows.length === 0) {
      await pool.query(`
        INSERT INTO etgo_sf_field (
          etgo_sf_field_id, ad_client_id, ad_org_id, isactive, createdby, updatedby,
          etgo_sf_entity_id, ad_column_id, ad_module_id, isincluded, isreadonly
        ) VALUES (
          REPLACE(gen_random_uuid()::text, '-', ''), $1, $2, 'Y', '100', '100',
          $3, $4, $5, 'Y', 'Y'
        )
      `, [clientId, orgId, entityId, columnId, moduleId]);
      console.log('Successfully inserted AD_Org_ID.');
    } else {
      console.log('AD_Org_ID already exists for bpartnerDocType.');
    }
  } catch (err) {
    console.error('DB Error:', err);
  } finally {
    await pool.end();
  }
}
run();
