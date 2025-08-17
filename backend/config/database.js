const mysql = require('mysql2/promise');
const logger = require('./logger');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 4000,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sre_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Wrapper for database operations with logging
const db = {
  async execute(sql, params = []) {
    const startTime = Date.now();
    try {
      const [rows, fields] = await pool.execute(sql, params);
      const duration = Date.now() - startTime;
      
      // Log database operation
      logger.logDatabase('execute', 'query', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        paramCount: params.length,
        rowsAffected: rows.affectedRows || rows.length || 0,
        duration: `${duration}ms`
      });
      
      return [rows, fields];
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Database operation failed', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw error;
    }
  },
  
  async query(sql, params = []) {
    return this.execute(sql, params);
  },
  
  async beginTransaction() {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    logger.logDatabase('begin', 'transaction');
    
    return {
      async execute(sql, params = []) {
        const startTime = Date.now();
        try {
          const [rows, fields] = await connection.execute(sql, params);
          const duration = Date.now() - startTime;
          
          logger.logDatabase('execute', 'transaction_query', {
            sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
            paramCount: params.length,
            rowsAffected: rows.affectedRows || rows.length || 0,
            duration: `${duration}ms`
          });
          
          return [rows, fields];
        } catch (error) {
          const duration = Date.now() - startTime;
          
          logger.error('Transaction query failed', {
            sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
            error: error.message,
            duration: `${duration}ms`
          });
          
          throw error;
        }
      },
      
      async commit() {
        await connection.commit();
        connection.release();
        logger.logDatabase('commit', 'transaction');
      },
      
      async rollback() {
        await connection.rollback();
        connection.release();
        logger.logDatabase('rollback', 'transaction');
      }
    };
  },
  
  async end() {
    await pool.end();
    logger.info('Database connection pool closed');
  }
};

// Test connection on startup
const testConnection = async () => {
  try {
    const [rows] = await db.execute('SELECT 1 as test');
    logger.info('Database connection test successful', { result: rows });
    return true;
  } catch (error) {
    logger.error('Database connection test failed', { error: error.message });
    return false;
  }
};

module.exports = db;