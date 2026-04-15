# LifeBridge Church — Renovation Tracker

A password-protected renovation budget and volunteer tracking app for LifeBridge Church.

## Railway Deployment

### Required Environment Variables (set in Railway dashboard):
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Auto-set by Railway Postgres plugin | (automatic) |
| `SESSION_SECRET` | Random secret for sessions | `any-long-random-string` |
| `APP_PASSWORD` | Team login password | `YourSecurePassword!` |
| `NODE_ENV` | Environment | `production` |

### Setup Steps:
1. Create a new Railway project
2. Add a **PostgreSQL** database plugin
3. Connect this GitHub repo
4. Set the environment variables above
5. Deploy — Railway auto-builds and serves the app

## Default Password
`LifeBridge2026!` (change via `APP_PASSWORD` env var)

## Features
- Password-protected team access
- Budget tracking with 3-level hierarchy (Phase → Project → Cost Type)
- Volunteer hour tracking with value savings calculator
- Data stored in PostgreSQL — shared across all team members
- Auto-saves every change to the database
- PDF report generation
