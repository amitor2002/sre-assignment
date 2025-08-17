const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 4000,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  connectTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000
};

const DB_NAME = process.env.DB_NAME || 'sre_app';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const waitForDatabase = async (maxRetries = 30) => {
  console.log('Waiting for database connection...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const connection = await mysql.createConnection(DB_CONFIG);
      await connection.execute('SELECT 1');
      await connection.end();
      console.log('Database connection established!');
      return true;
    } catch (error) {
      console.log(`Database connection attempt ${i + 1}/${maxRetries} failed:`, error.message);
      await sleep(2000);
    }
  }
  
  throw new Error('Could not connect to database after maximum retries');
};

const createDatabase = async () => {
  const connection = await mysql.createConnection(DB_CONFIG);
  
  try {
    console.log(`Creating database: ${DB_NAME}`);
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    console.log(`Database ${DB_NAME} created or already exists`);
  } catch (error) {
    console.error('Error creating database:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
};

const createTables = async () => {
  const connection = await mysql.createConnection({
    ...DB_CONFIG,
    database: DB_NAME
  });

  try {
    console.log('Creating tables...');

    // Users table
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        INDEX idx_email (email),
        INDEX idx_created_at (created_at)
      )
    `;

    await connection.execute(createUsersTable);
    console.log('✅ Users table created');

    // User tokens table
    const createTokensTable = `
      CREATE TABLE IF NOT EXISTS user_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_valid BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_expires_at (expires_at),
        INDEX idx_is_valid (is_valid)
      )
    `;

    await connection.execute(createTokensTable);
    console.log('✅ User tokens table created');

    // Activity logs table (for additional logging if needed)
    const createActivityLogsTable = `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        action VARCHAR(100) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        additional_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at)
      )
    `;

    await connection.execute(createActivityLogsTable);
    console.log('✅ Activity logs table created');

    // System settings table
    const createSystemSettingsTable = `
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_setting_key (setting_key)
      )
    `;

    await connection.execute(createSystemSettingsTable);
    console.log('✅ System settings table created');

    console.log('All tables created successfully!');

  } catch (error) {
    console.error('Error creating tables:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
};

const createDefaultUser = async () => {
  const connection = await mysql.createConnection({
    ...DB_CONFIG,
    database: DB_NAME
  });

  try {
    console.log('Creating default user...');

    // Check if default user already exists
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      ['admin@sre-assignment.local']
    );

    if (existingUsers.length > 0) {
      console.log('Default user already exists, skipping creation');
      return;
    }

    // Create default user
    const defaultPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

    await connection.execute(
      'INSERT INTO users (email, password, first_name, last_name, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      ['admin@sre-assignment.local', hashedPassword, 'Admin', 'User']
    );

    console.log('✅ Default user created:');
    console.log('   Email: admin@sre-assignment.local');
    console.log('   Password: admin123');
    console.log('   ⚠️  Please change this password in production!');

  } catch (error) {
    console.error('Error creating default user:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
};

const insertSystemSettings = async () => {
  const connection = await mysql.createConnection({
    ...DB_CONFIG,
    database: DB_NAME
  });

  try {
    console.log('Inserting system settings...');

    const settings = [
      ['app_version', '1.0.0', 'Application version'],
      ['cdc_enabled', 'true', 'Change Data Capture enabled'],
      ['kafka_enabled', 'true', 'Kafka messaging enabled'],
      ['logging_level', 'info', 'Application logging level'],
      ['max_login_attempts', '5', 'Maximum login attempts before lockout'],
      ['token_expiry_hours', '24', 'JWT token expiry time in hours']
    ];

    for (const [key, value, description] of settings) {
      await connection.execute(
        'INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()',
        [key, value, description]
      );
    }

    console.log('✅ System settings inserted');

  } catch (error) {
    console.error('Error inserting system settings:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
};

const initializeDatabase = async () => {
  console.log('🚀 Starting database initialization...');
  console.log('Database Configuration:', {
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    database: DB_NAME
  });

  try {
    // Wait for database to be available
    await waitForDatabase();

    // Create database
    await createDatabase();

    // Create tables
    await createTables();

    // Create default user
    await createDefaultUser();

    // Insert system settings
    await insertSystemSettings();

    console.log('🎉 Database initialization completed successfully!');
    console.log('');
    console.log('=== IMPORTANT INFORMATION ===');
    console.log('Default user credentials:');
    console.log('  Email: admin@sre-assignment.local');
    console.log('  Password: admin123');
    console.log('');
    console.log('⚠️  SECURITY WARNING: Please change the default password immediately!');
    console.log('=============================');

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

// Start initialization
initializeDatabase();