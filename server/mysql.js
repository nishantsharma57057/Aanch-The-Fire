import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';

// Preserve the existing API's prepared-statement interface while using MySQL.
export function mysqlSql(sql) {
  return sql.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
    .replace(/ON CONFLICT\(`?key`?\) DO UPDATE SET value = excluded\.value/gi,
      'ON DUPLICATE KEY UPDATE value = VALUES(value)');
}
export function wrapMysql(pool) {
  const statement = (sql, args = []) => {
    const query = async (connection = pool) => {
      try { return (await connection.execute(mysqlSql(sql), args))[0]; }
      catch (error) {
        // Ignore duplicate keys only; invalid values and other failures must surface.
        if (/^INSERT OR IGNORE INTO/i.test(sql) && error.code === 'ER_DUP_ENTRY') return {affectedRows: 0};
        throw error;
      }
    };
    return {
      bind(...values) { return statement(sql, values); },
      async first() { return (await query())[0] ?? null; },
      async all() { return {results: await query()}; },
      async run() { return {success: true, meta: {changes: (await query()).affectedRows}}; },
      async _run(connection) { return {success: true, meta: {changes: (await query(connection)).affectedRows}}; }
    };
  };
  return {
    prepare: statement,
    async batch(statements) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const results = [];
        for (const item of statements) results.push(await item._run(connection));
        await connection.commit();
        return results;
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    },
    close: () => pool.end()
  };
}
export async function connectMysql(env) {
  for (const name of ['DB_USER', 'DB_PASSWORD', 'DB_NAME']) if (!env[name]) throw new Error(`${name} is required`);
  const pool = mysql.createPool({
    host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306),
    user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
    connectionLimit: 5, waitForConnections: true, queueLimit: 50,
    charset: 'utf8mb4_bin', flags: ['-FOUND_ROWS'], multipleStatements: false,
    connectTimeout: 10000
  });
  try {
    const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
    // Schema contains only CREATE TABLE statements and no stored procedures.
    for (const sql of schema.split(';').map(s => s.trim()).filter(Boolean)) await pool.query(sql);
    return wrapMysql(pool);
  } catch (error) { await pool.end(); throw error; }
}
