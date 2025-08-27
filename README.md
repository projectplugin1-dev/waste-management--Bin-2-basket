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

Preview
Windows
- Install MySQL (Workbench or WAMP/XAMPP). Start the MySQL service.
- Create .env: PowerShell
```
Copy-Item .env.example .env
```
- If using WAMP/XAMPP (root has no password), set in .env:
```
DB_USER=root
DB_PASSWORD=
```
- If you set a custom root password during MySQL install, put it in `.env`.
- Run the app:
```
npm install
npm start
```
- Open: User http://localhost:3000/ • Admin http://localhost:3000/admin/
- Admin login: admin@bin2basket.com / Admin@123

macOS/Linux
- Ensure MySQL is running (brew services or systemctl).
- Copy env and run:
```
cp .env.example .env
npm install
npm start
```
- Open: User http://localhost:3000/ • Admin http://localhost:3000/admin/

Docker (optional)
```
docker compose up -d mysql adminer
npm start
```
Adminer: http://localhost:8080

Troubleshooting
- ER_ACCESS_DENIED_ERROR: Your MySQL creds in `.env` don’t match. Fix DB_USER/DB_PASSWORD. Test: `mysql -u root -p -h 127.0.0.1 -P 3306`.
- Duplicate keys in .env: Ensure only one set of DB_* and other keys (remove duplicates).
- Port already in use: Change `PORT` in `.env` (e.g., 3001) and restart.
- Can’t connect to MySQL: Use `DB_HOST=127.0.0.1` (not `localhost`), verify service is running, verify `DB_PORT=3306`.

Notes
- On first run, DB schema and sample products are created automatically, and an admin account is seeded using `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- Max discount per order is 20% of subtotal; points redeem convert 1 point = 1 currency unit toward the cap.
- The chatbot is rule-based and only answers about the website features.
