const express = require('express');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { db, getSiteSettings, setSiteSetting, addAuditLog } = require('./db');
const { verifyPassword, requireAdmin, logAction } = require('./auth');
const { saveUploadedFile } = require('./storage');

const app = express();
const port = process.env.PORT || 4000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Unsupported file type. Use JPG, PNG, WEBP, or PDF'));
  }
});

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'my_life_story_local_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

function parseSettingValue(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function buildPublicSubmission(row) {
  return {
    ...row,
    media: db.prepare('SELECT * FROM media WHERE submission_id = ? ORDER BY created_at DESC').all(row.id),
    category: row.category || 'General'
  };
}

app.get('/api/site-settings', (req, res) => {
  const settings = getSiteSettings();
  const normalized = {};
  for (const [key, value] of Object.entries(settings)) {
    normalized[key] = parseSettingValue(value);
  }
  res.json({ settings: normalized });
});

app.get('/api/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json({ categories });
});

app.get('/api/public/biographies', (req, res) => {
  const search = (req.query.search || '').toString().trim();
  const category = (req.query.category || '').toString().trim();
  const whereClauses = ['publication_status = ?'];
  const params = ['published'];

  if (search) {
    whereClauses.push('(full_name LIKE ? OR title LIKE ? OR profession LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  if (category) {
    whereClauses.push('category = ?');
    params.push(category);
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const rows = db.prepare(
    `SELECT * FROM submissions ${where} ORDER BY published_at DESC, created_at DESC LIMIT 50`
  ).all(...params);

  res.json({ biographies: rows.map(buildPublicSubmission) });
});

app.get('/api/public/biographies/:slug', (req, res) => {
  const slug = req.params.slug;
  const row = db.prepare('SELECT * FROM submissions WHERE public_slug = ? AND publication_status = ?').get(slug, 'published');

  if (!row) {
    return res.status(404).json({ error: 'Biography not found.' });
  }

  res.json({ biography: buildPublicSubmission(row) });
});

app.post('/api/submissions', (req, res) => {
  const data = req.body || {};
  const required = ['fullName', 'title', 'profession', 'shortIntro', 'childhood', 'education', 'careerJourney', 'achievements', 'submitterName', 'submitterEmail'];
  const missing = required.filter((field) => !String(data[field] || '').trim());

  if (missing.length) {
    return res.status(400).json({ error: 'Missing required fields.', missing });
  }

  const submissionId = randomUUID();
  const reference = `MLS-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const publicSlug = (data.title || data.fullName).toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';

  const payload = {
    id: submissionId,
    reference,
    full_name: data.fullName,
    title: data.title,
    profile_photo: data.profilePhoto || '',
    date_of_birth: data.dateOfBirth || '',
    place_of_birth: data.placeOfBirth || '',
    current_location: data.currentLocation || '',
    profession: data.profession,
    short_intro: data.shortIntro,
    childhood: data.childhood,
    family_background: data.familyBackground || '',
    education: data.education,
    career_journey: data.careerJourney,
    achievements: data.achievements,
    business_ventures: data.businessVentures || '',
    hobbies: data.hobbies || '',
    major_experiences: data.majorExperiences || '',
    challenges: data.challenges || '',
    contributions: data.contributions || '',
    future_ambitions: data.futureAmbitions || '',
    message_to_world: data.messageToWorld || '',
    submitter_name: data.submitterName,
    submitter_email: data.submitterEmail,
    submitter_phone: data.submitterPhone || '',
    relationship: data.relationship || '',
    category: data.category || 'General',
    payment_status: 'pending_verification',
    publication_status: 'draft',
    public_slug: `${publicSlug}-${submissionId.slice(0, 6)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO submissions (
      id, reference, full_name, title, profile_photo, date_of_birth, place_of_birth, current_location,
      profession, short_intro, childhood, family_background, education, career_journey, achievements,
      business_ventures, hobbies, major_experiences, challenges, contributions, future_ambitions,
      message_to_world, submitter_name, submitter_email, submitter_phone, relationship, category,
      payment_status, publication_status, public_slug, created_at, updated_at
    ) VALUES (
      @id, @reference, @full_name, @title, @profile_photo, @date_of_birth, @place_of_birth, @current_location,
      @profession, @short_intro, @childhood, @family_background, @education, @career_journey, @achievements,
      @business_ventures, @hobbies, @major_experiences, @challenges, @contributions, @future_ambitions,
      @message_to_world, @submitter_name, @submitter_email, @submitter_phone, @relationship, @category,
      @payment_status, @publication_status, @public_slug, @created_at, @updated_at
    )
  `).run(payload);

  res.status(201).json({
    message: 'Submission created successfully.',
    submission: {
      ...payload,
      paymentStatus: payload.payment_status,
      publicationStatus: payload.publication_status
    }
  });
});

app.post('/api/submissions/:id/media', upload.array('photos', 10), (req, res) => {
  const submission = db.prepare('SELECT id FROM submissions WHERE id = ?').get(req.params.id);
  if (!submission) {
    return res.status(404).json({ error: 'Submission not found.' });
  }

  const files = req.files || [];
  const mediaRecords = files.map((file, index) => {
    const saved = saveUploadedFile(file, `submissions/${submission.id}`);
    const id = randomUUID();
    db.prepare(
      `INSERT INTO media (id, submission_id, original_name, stored_name, mime_type, caption, is_profile, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      id,
      submission.id,
      file.originalname,
      saved.fileName,
      file.mimetype,
      req.body[`caption_${index}`] || '',
      index === 0 ? 1 : 0
    );
    return { id, originalName: file.originalname, fileUrl: saved.publicUrl, caption: req.body[`caption_${index}`] || '' };
  });

  res.json({ message: 'Photos uploaded successfully.', media: mediaRecords });
});

app.post('/api/submissions/:id/payment', (req, res) => {
  const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  if (!submission) {
    return res.status(404).json({ error: 'Submission not found.' });
  }

  const { transferReference } = req.body || {};
  if (!transferReference || !String(transferReference).trim()) {
    return res.status(400).json({ error: 'Transfer reference is required.' });
  }

  db.prepare(
    `UPDATE submissions SET transfer_reference = ?, payment_status = 'pending_verification', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(String(transferReference).trim(), req.params.id);

  res.json({ message: 'Payment claim received. It is now pending verification.' });
});

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(String(email).trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }

  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.name = user.name;
  req.session.isAdmin = true;

  db.prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), user.id);
  addAuditLog({ adminId: user.id, action: 'admin_login', targetType: 'admin', targetId: user.id, details: { email: user.email } });

  res.json({ message: 'Login successful.', admin: { id: user.id, email: user.email, name: user.name } });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out successfully.' });
  });
});

app.get('/api/admin/session', (req, res) => {
  if (!req.session || !req.session.isAdmin || !req.session.userId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }

  const user = db.prepare('SELECT id, email, name FROM admin_users WHERE id = ?').get(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Invalid session.' });
  }

  res.json({ admin: user });
});

app.get('/api/admin/submissions', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM submissions ORDER BY created_at DESC').all();
  res.json({ submissions: rows.map((row) => ({ ...row, media: db.prepare('SELECT * FROM media WHERE submission_id = ? ORDER BY created_at DESC').all(row.id) })) });
});

app.get('/api/admin/submissions/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Submission not found.' });
  }

  const media = db.prepare('SELECT * FROM media WHERE submission_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ submission: { ...row, media } });
});

app.patch('/api/admin/submissions/:id', requireAdmin, (req, res) => {
  const { adminNotes, publicationStatus, paymentStatus } = req.body || {};
  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Submission not found.' });
  }

  const updates = [];
  const params = [];

  if (typeof adminNotes !== 'undefined') {
    updates.push('admin_notes = ?');
    params.push(String(adminNotes));
  }

  if (typeof publicationStatus !== 'undefined') {
    updates.push('publication_status = ?');
    params.push(String(publicationStatus));
  }

  if (typeof paymentStatus !== 'undefined') {
    updates.push('payment_status = ?');
    params.push(String(paymentStatus));
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No changes provided.' });
  }

  params.push(req.params.id);
  db.prepare(`UPDATE submissions SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
  logAction(req, 'update_submission', 'submission', req.params.id, { adminNotes, publicationStatus, paymentStatus });

  res.json({ message: 'Submission updated.' });
});

app.post('/api/admin/submissions/:id/verify-payment', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Submission not found.' });
  }

  if (row.payment_status === 'verified') {
    return res.status(400).json({ error: 'This payment has already been verified.' });
  }

  db.prepare(
    `UPDATE submissions SET payment_status = 'verified', payment_verified_at = ?, verified_by_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(new Date().toISOString(), req.admin.email, req.params.id);

  logAction(req, 'verify_payment', 'submission', req.params.id, { transferReference: row.transfer_reference });
  res.json({ message: 'Payment verified successfully.' });
});

app.post('/api/admin/submissions/:id/approve', requireAdmin, (req, res) => {
  db.prepare(`UPDATE submissions SET publication_status = 'awaiting_approval', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.id);
  logAction(req, 'approve_submission', 'submission', req.params.id, {});
  res.json({ message: 'Submission moved to review queue.' });
});

app.post('/api/admin/submissions/:id/publish', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Submission not found.' });
  }

  const slug = `${(row.title || row.full_name).toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'biography'}-${row.id.slice(0, 6)}`;
  db.prepare(
    `UPDATE submissions SET publication_status = 'published', public_slug = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(slug, new Date().toISOString(), req.params.id);

  logAction(req, 'publish_submission', 'submission', req.params.id, { slug });
  res.json({ message: 'Biography published.' });
});

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const allowed = ['site_name', 'logo_url', 'bank_name', 'account_name', 'account_number', 'contact_email', 'contact_phone', 'homepage_intro', 'fee', 'publishing_instructions'];
  const updates = req.body || {};

  Object.keys(updates).forEach((key) => {
    if (allowed.includes(key)) {
      setSiteSetting(key, updates[key]);
    }
  });

  logAction(req, 'update_settings', 'site', 'settings', updates);
  res.json({ message: 'Settings updated.' });
});

app.get('/api/admin/audit-log', requireAdmin, (req, res) => {
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
  res.json({ logs });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'My Life Story API' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.', message: err.message });
});

app.listen(port, () => {
  console.log(`My Life Story API running on http://localhost:${port}`);
});

module.exports = app;
