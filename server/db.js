const path = require('path');
const fs = require('fs');
const sqlite = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const dbPath = path.join(__dirname, '..', 'data', 'my-life-story.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = sqlite(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    full_name TEXT,
    title TEXT,
    profile_photo TEXT,
    date_of_birth TEXT,
    place_of_birth TEXT,
    current_location TEXT,
    profession TEXT,
    short_intro TEXT,
    childhood TEXT,
    family_background TEXT,
    education TEXT,
    career_journey TEXT,
    achievements TEXT,
    business_ventures TEXT,
    hobbies TEXT,
    major_experiences TEXT,
    challenges TEXT,
    contributions TEXT,
    future_ambitions TEXT,
    message_to_world TEXT,
    submitter_name TEXT,
    submitter_email TEXT,
    submitter_phone TEXT,
    relationship TEXT,
    category TEXT,
    payment_status TEXT DEFAULT 'pending_verification',
    publication_status TEXT DEFAULT 'draft',
    transfer_reference TEXT,
    payment_evidence TEXT,
    public_slug TEXT,
    admin_notes TEXT,
    is_featured INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    published_at TEXT,
    payment_verified_at TEXT,
    verified_by_admin TEXT
  );

  CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    original_name TEXT,
    stored_name TEXT,
    mime_type TEXT,
    caption TEXT,
    is_profile INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(submission_id) REFERENCES submissions(id)
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    admin_id TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(admin_id) REFERENCES admin_users(id)
  );
`);

function getSiteSettings() {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function setSiteSetting(key, value) {
  db.prepare(
    `INSERT INTO site_settings (key, value) VALUES (@key, @value)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run({ key, value: JSON.stringify(value) });
}

function ensureSeed() {
  const defaultSettings = {
    site_name: 'My Life Story',
    logo_url: '/logo.svg',
    fee: 3000,
    bank_name: 'Bank transfer details will be available soon',
    account_name: 'Bank transfer details will be available soon',
    account_number: 'Bank transfer details will be available soon',
    contact_email: 'hello@mylifestory.example',
    contact_phone: '+234 800 000 0000',
    homepage_intro: 'Every life has a story worth telling. We help people share their experiences, memories, achievements, and legacy with the world in a respectful and professional way.',
    publishing_instructions: 'After submission, complete the required ₦3,000 bank transfer and upload your payment reference for verification before publication.',
    privacy_policy: 'This platform stores personal biography information only for approved publication and administration use.',
    terms: 'By submitting content, you confirm you have permission to publish the information provided and agree to review and approval standards.',
    default_bank_transfer_notice: 'Bank transfer details will be available soon until the administrator configures them.'
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = db.prepare('SELECT 1 FROM site_settings WHERE key = ?').get(key);
    if (!existing) {
      setSiteSetting(key, value);
    }
  }

  const categories = [
    { name: 'Leadership', slug: 'leadership', description: 'Profiles of leaders and change-makers.' },
    { name: 'Business', slug: 'business', description: 'Entrepreneurs and business success stories.' },
    { name: 'Education', slug: 'education', description: 'Scholars and educational journeys.' },
    { name: 'Faith & Purpose', slug: 'faith-purpose', description: 'Inspirational stories rooted in faith and service.' },
    { name: 'Community', slug: 'community', description: 'Stories of service, impact, and giving back.' }
  ];

  for (const category of categories) {
    const existing = db.prepare('SELECT 1 FROM categories WHERE slug = ?').get(category.slug);
    if (!existing) {
      db.prepare(
        `INSERT INTO categories (id, name, slug, description) VALUES (?, ?, ?, ?)`
      ).run(randomUUID(), category.name, category.slug, category.description);
    }
  }
}

function ensureDefaultAdmin() {
  const email = process.env.ADMIN_EMAIL || 'chigoziemgbechi1980@gmail.com';
  const password = process.env.ADMIN_PASSWORD || 'Favour1478';
  const existing = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(email);

  if (!existing) {
    const id = randomUUID();
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(
      'INSERT INTO admin_users (id, email, password_hash, name) VALUES (?, ?, ?, ?)'
    ).run(id, email, hash, 'Admin');
  }
}

function addAuditLog({ adminId, action, targetType, targetId, details }) {
  db.prepare(
    `INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, details)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), adminId || null, action, targetType || null, targetId || null, JSON.stringify(details || {}));
}

ensureSeed();
ensureDefaultAdmin();

module.exports = {
  db,
  getSiteSettings,
  setSiteSetting,
  addAuditLog,
  ensureSeed,
  ensureDefaultAdmin
};


