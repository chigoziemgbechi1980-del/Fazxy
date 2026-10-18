# My Life Story

A real biography publishing platform MVP built with React, TypeScript, Express, SQLite, and reusable file storage. This project is organized to support local development and Cloudflare-ready deployment planning.

## Features included

- Premium homepage and browsing UI
- Biography publication form with required fields
- Reference-based submission creation
- Payment verification workflow with pending verification status
- Admin login and dashboard
- Database-backed storage via SQLite for local development
- File upload support for biography imagery
- Website settings management for bank details and contact info
- Audit logs for administrative actions

## Local setup

1. Install dependencies:
   npm install

2. Initialize the database:
   npm run db:init

3. Start the app:
   npm run dev

4. Open the site in your browser:
   http://localhost:5173

## Default admin account

Email: chigoziemgbechi1980@gmail.com
Password: Favour1478

This should be changed after deployment.

## API base

Frontend calls the API at:
http://localhost:4000/api

## Deployment notes

The app is structured to be Cloudflare-friendly. For production deployment, you can move the API layer to Cloudflare Pages Functions and the database to Cloudflare D1, with R2 for media storage. The local SQLite database is used for dev and testing.

## Important files

- `server/index.js` — Express API and admin logic
- `server/db.js` — SQLite schema and default settings
- `src/App.tsx` — website frontend and admin dashboard
- `README.md` — setup and deployment guide

## Security notes

- Admin passwords are hashed with bcrypt.
- Admin sessions are stored in cookies using express-session.
- Bank transfer details are blank by default and only appear once configured by an admin.
- Sensitive admin actions are logged into the audit table.

## Admin password reset helper

A helper script is included in `scripts/set-admin-password.js` for updating the admin password on an existing local database.
