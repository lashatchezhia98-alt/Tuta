# TUTA Health

TUTA is a bilingual Georgian and English cycle-awareness product prototype. It includes a responsive marketing site, private local tracking mode, period and ovulation calculators, doctor consultation UI, insights, reports, and a protected administration area.

## Current status

This repository is an early product prototype intended for design review and usability feedback. It does not yet provide medical diagnosis, production user accounts, payments, or persistent health-data storage.

## Stack

- React 19 and TypeScript
- vinext and Vite
- Tailwind CSS and shadcn/ui
- Drizzle ORM prepared for a future database

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by the development server.

## Admin access

Set these values in `.env.local` locally and in the hosting provider's encrypted environment-variable settings:

```env
ADMIN_EMAIL=your-private-email
ADMIN_PASSWORD=your-long-unique-password
ADMIN_SESSION_SECRET=at-least-32-random-characters
```

The `.env.local` file is ignored by Git and must never be committed. The admin session is stored in a signed, HTTP-only cookie with a 12-hour lifetime.

## Commands

```bash
npm run dev
npm run build
npm run lint
```

## Privacy note

Cycle and symptom data is sensitive health information. Do not use this prototype to store real user data until authentication, authorization, encryption, retention rules, consent, account deletion, backups, and the selected providers' data-processing terms have been reviewed.

## Feedback

Useful review areas include mobile usability, Georgian copy clarity, accessibility, onboarding, trust and privacy messaging, and whether daily logging can be completed quickly.
