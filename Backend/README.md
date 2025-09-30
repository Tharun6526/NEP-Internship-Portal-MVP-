# NEP-Internship-Portal-MVP


A minimal full-stack MVP (single Node.js app serving static frontend) implementing core features:
- Student register/login
- Internship listing & creation (industry)
- Apply to internship
- Simple logbook entries
- Faculty review endpoints (approve/reject)


## Prerequisites
- Node.js 18+ and npm installed


## How to run locally
1. Save the project files in a folder `NEP-Internship-Portal-MVP` (use the structure above).
2. In terminal, `cd NEP-Internship-Portal-MVP`
3. `npm install`
4. `npm start`
5. Open http://localhost:3000 in your browser


## Deployment
This is a single Node.js app — recommended hosts:
- Render.com (free tier available)
- Railway.app
- Fly.io
- DigitalOcean App Platform


For Render/Railway: connect your GitHub repo and set `PORT` environment variable (Render sets it automatically). Also set `JWT_SECRET` env var for production.


## Notes
- This is an MVP: authentication is intentionally simplified (JWT with no refresh token) and there is no email verification.
- For production, switch to PostgreSQL, add HTTPS, secure headers, rate limiting and proper CORS configuration, and a proper file store for uploaded files.