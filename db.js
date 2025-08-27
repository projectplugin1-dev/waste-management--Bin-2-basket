import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const WASTE_RATES = {
  'plastic': 5,
  'metal': 10,
  'paper': 3,
  'glass': 6,
  'e-waste': 15,
  'organic': 2,
  'other': 1
};

export const MAX_DISCOUNT_PERCENT = 20; // per order
export const POINT_VALUE = 1; // 1 point = 1 currency unit

let pool;

export async function getServerConnection() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'example',
    multipleStatements: true
  });
  return connection;
}

export async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'example',
      database: process.env.DB_NAME || 'bin2basket',
      connectionLimit: 10,
      namedPlaceholders: true
    });
  }
  return pool;
}

export async function ensureDatabaseExists() {
  const dbName = process.env.DB_NAME || 'bin2basket';
  const conn = await getServerConnection();
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  } finally {
    await conn.end();
  }
}

export async function initSchemaAndSeed() {
  await ensureDatabaseExists();
  const pool = await getPool();
  // Create tables if not exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_uid VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(160) NOT NULL UNIQUE,
      phone VARCHAR(30) NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('user','admin') NOT NULL DEFAULT 'user',
      points_balance INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS waste_submissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      user_uid VARCHAR(20) NOT NULL,
      waste_type ENUM('plastic','metal','paper','glass','e-waste','organic','other') NOT NULL,
      weight_kg DECIMAL(10,2) NOT NULL,
      points_awarded INT NOT NULL,
      submitted_by_admin_id BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX (user_id),
      CONSTRAINT fk_ws_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS points_ledger (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      change_amount INT NOT NULL,
      reason ENUM('waste_submission','order_redeem','order_refund','manual_adjustment') NOT NULL,
      reference_id BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX (user_id),
      CONSTRAINT fk_pl_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(160) NOT NULL,
      description TEXT NULL,
      price DECIMAL(10,2) NOT NULL,
      image_url VARCHAR(500) NULL,
      stock INT NOT NULL DEFAULT 100,
      is_active TINYINT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      status ENUM('PENDING','ACCEPTED','DECLINED','CANCELLED','FULFILLED') NOT NULL DEFAULT 'PENDING',
      subtotal DECIMAL(10,2) NOT NULL,
      discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      points_redeemed INT NOT NULL DEFAULT 0,
      total DECIMAL(10,2) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX (user_id),
      CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      line_total DECIMAL(10,2) NOT NULL,
      PRIMARY KEY (id),
      INDEX (order_id),
      INDEX (product_id),
      CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_actions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      admin_id BIGINT UNSIGNED NOT NULL,
      order_id BIGINT UNSIGNED NOT NULL,
      action ENUM('ACCEPT','DECLINE') NOT NULL,
      reason VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX (admin_id),
      INDEX (order_id)
    );
  `);

  // Seed admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@bin2basket.com';
  const [[existingAdmin]] = await pool.query(`SELECT id FROM users WHERE email = ?`, [adminEmail]);
  if (!existingAdmin) {
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10);
    const userUid = 'B2B-ADMIN';
    await pool.query(
      `INSERT INTO users (user_uid, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, 'admin')`,
      [userUid, 'Administrator', adminEmail, null, passwordHash]
    );
  }

  // Seed products if empty
  const [countRows] = await pool.query(`SELECT COUNT(*) AS cnt FROM products`);
  const cnt = countRows[0]?.cnt || 0;
  if (cnt === 0) {
    await pool.query(
      `INSERT INTO products (name, description, price, image_url, stock) VALUES 
      ('Rice 5kg', 'Premium basmati rice 5kg', 599.00, 'https://picsum.photos/seed/rice/400/300', 100),
      ('Wheat Flour 10kg', 'Whole wheat atta 10kg', 749.00, 'https://picsum.photos/seed/wheat/400/300', 120),
      ('Cooking Oil 1L', 'Refined sunflower oil 1L', 169.00, 'https://picsum.photos/seed/oil/400/300', 200),
      ('Sugar 1kg', 'Refined sugar 1kg', 55.00, 'https://picsum.photos/seed/sugar/400/300', 200),
      ('Tea 500g', 'Assam tea 500g', 229.00, 'https://picsum.photos/seed/tea/400/300', 150)
    `
    );
  }
}

export function calculatePointsForWaste(wasteType, weightKg) {
  const rate = WASTE_RATES[wasteType] ?? WASTE_RATES['other'];
  return Math.max(0, Math.round(rate * Number(weightKg)));
}

export function calculateDiscountFromPoints(points) {
  return Math.max(0, Number(points) * POINT_VALUE);
}
