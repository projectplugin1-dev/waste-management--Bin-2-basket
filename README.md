# Bin 2 Basket

Overview
Bin 2 Basket is a full-stack web app where users earn points by submitting waste (recorded by admins) and redeem those points for grocery discounts (capped at 20% per order). Users can browse/purchase groceries, view points and history; admins can manage users, record waste submissions, and accept/decline orders.

Tech Stack
- HTML, CSS, Vanilla JavaScript (frontend)
- Node.js, Express (backend)
- MySQL (mysql2 driver)

Quick Start
1) Prerequisites
- Node.js 18+
- MySQL 8+ (or Docker if available)

2) Install
```
npm install
```

3) Configure environment
Copy `.env.example` to `.env` and adjust if needed (MySQL credentials):
```
cp .env.example .env
```

4) Start MySQL
- If Docker is available:
```
docker compose up -d mysql adminer
```
Adminer at http://localhost:8080

- Or run a local MySQL server and create a user/password matching `.env`.

5) Run the app
```
npm run start
```
Server: http://localhost:3000
User site: http://localhost:3000/
Admin site: http://localhost:3000/admin/

Notes
- On first run, DB schema and sample products are created automatically, and an admin account is seeded using `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- Max discount per order is 20% of subtotal; points redeem convert 1 point = 1 currency unit toward the cap.
- The chatbot is rule-based and only answers about the website features.
