# MongoDB Atlas Setup — Step by Step

Use this to get a free MongoDB database in the cloud and connect it to the Player Valuation API.

---

## Step 1: Sign up for MongoDB Atlas

1. Open: **https://www.mongodb.com/cloud/atlas**
2. Click **"Try Free"** or **"Start Free"**.
3. Sign up with:
   - **Google** (easiest), or
   - **Email** (they’ll send a verification link).
4. Fill in:
   - **First name / Last name**
   - **Email**
   - **Password** (if using email).
5. Accept terms and create account. You’ll land in the Atlas dashboard.

---

## Step 2: Create a free cluster

1. You should see **"Create a deployment"** or **"Build a database"**.
2. Choose **"M0 FREE"** (Free tier).
   - If you see M2/M5, stay on **M0** or the **FREE** option.
3. **Cloud provider & region**
   - Pick one close to you (e.g. **AWS** → **N. Virginia** or **Ohio**).
   - Free tier is only on certain regions; if one is grayed out, pick another that says "FREE".
4. **Cluster name**
   - Default is fine (e.g. `Cluster0`) or use `draft-kit-mvp`.
5. Click **"Create Deployment"** (or **"Create"**).
6. Wait 1–3 minutes until the cluster status is **Active** (green).

---

## Step 3: Create a database user (so the API can log in)

1. A popup may say **"Security Quickstart"** or **"Create database user"**.
   - If you see it, use that. Otherwise go to **Security** → **Database Access** → **Add New Database User**.
2. **Authentication method:** **Password**.
3. **Username:** e.g. `draftkit` (or anything you’ll remember).
4. **Password:** click **"Autogenerate Secure Password"** and **copy it somewhere safe** (you’ll need it for the connection string).
   - Or choose your own strong password.
5. **Database User Privileges:** leave **"Read and write to any database"** (or "Atlas admin").
6. Click **"Create User"**.

---

## Step 4: Allow access from your computer (and later Render)

1. You may see **"Where would you like to connect from?"**.
   - Click **"Add My Current IP Address"** (so your laptop can connect).
   - Then click **"Add Entry"** or **"Finish and Close"**.
2. **For the MVP you also need to allow Render to connect:**
   - Go to **Security** → **Network Access** (left sidebar).
   - Click **"Add IP Address"**.
   - Click **"Allow Access from Anywhere"**.
     - This sets `0.0.0.0/0` (any IP). OK for a class project; for real apps you’d restrict later.
   - Confirm with **"Add Entry"** or **"Confirm"**.

---

## Step 5: Get the connection string

1. Go back to the **Atlas dashboard** (click the **"Atlas"** logo or **"Database"** in the left menu).
2. On your cluster, click **"Connect"**.
3. Choose **"Drivers"** (or "Connect your application").
4. **Driver:** Node.js. **Version:** 5.5 or later (or whatever is shown).
5. Copy the connection string. It looks like:
   ```text
   mongodb+srv://draftkit:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. **Replace `<password>`** with the **database user password** from Step 3.
   - If the password has special characters (e.g. `#`, `@`, `%`), replace them with URL-encoded versions:
     - `#` → `%23`
     - `@` → `%40`
     - `%` → `%25`
7. **Optional but good:** add a database name so all data goes in one place. Change the part before `?` to include the DB name:
   ```text
   mongodb+srv://draftkit:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/draft_kit?retryWrites=true&w=majority
   ```
   So: `....mongodb.net/draft_kit?retry...` — that’s your **MONGODB_URI**.

---

## Step 6: Put the URI in your API project

1. Open the API folder and create `.env` from the example:
   ```bash
   cd /Users/yusuffakhriddin/Desktop/CSE416/CSE-416-MVP-Team-Teal/player-valuation-api
   cp .env.example .env
   ```
2. Open `.env` in your editor. It should look like:
   ```env
   PORT=4000
   MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/draft_kit?retryWrites=true&w=majority
   API_KEY=your-secret-api-key-change-in-production
   NODE_ENV=development
   ```
3. **Replace the whole `MONGODB_URI` line** with your real URI (the one from Step 5, with password and optional `draft_kit` database).
4. **Set `API_KEY`** to any secret string, e.g. `mvp-teal-secret-key` (the Draft Kit will use this same value later).
5. Save the file. **Never commit `.env` to Git** (it’s already in `.gitignore`).

---

## Step 7: Seed the database and start the API

1. Install and build (if you haven’t):
   ```bash
   npm install
   npm run build
   ```
2. Seed the database (creates players and transactions):
   ```bash
   npm run seed
   ```
   You should see: `Connected to MongoDB.` → `Inserted 45 players.` → `Inserted 8 transactions.` → `Seed done.`
3. Start the API:
   ```bash
   npm start
   ```
   You should see: `MongoDB connected.` and `Player Valuation API listening on port 4000`.
4. Test (use the same value you put in `API_KEY`):
   ```bash
   curl -H "x-api-key: mvp-teal-secret-key" "http://localhost:4000/players?limit=2"
   ```
   You should get JSON with a `players` array.

---

## Troubleshooting

### "bad auth : authentication failed" (MongoServerError)

This means Atlas is rejecting the **username** or **password** in your connection string.

**Fix 1 — Use a simple password (easiest):**

1. In Atlas go to **Security** → **Database Access**.
2. Click your database user (e.g. `draftkit`) → **Edit**.
3. Click **Edit Password** → choose **Autogenerate Secure Password** and **copy it**, or set a **new password that has only letters and numbers** (no `#`, `@`, `%`, `&`, etc.).
4. Save.
5. In your `.env`, set `MONGODB_URI` to the connection string again and **replace `<password>` (or the old password) with this new password**. No encoding needed if it’s only letters/numbers.

**Fix 2 — Keep your current password but encode special characters:**

If the password contains special characters, they must be **URL-encoded** in the URI:

| Character | Replace with |
|-----------|----------------|
| `#`       | `%23`         |
| `@`       | `%40`         |
| `%`       | `%25`         |
| `&`       | `%26`         |
| `:`       | `%3A`         |
| `/`       | `%2F`         |
| `?`       | `%3F`         |
| `+`       | `%2B`         |
| `=`       | `%3D`         |

Example: password `ab#c@12` → in the URI use `ab%23c%4012`.

**Also check:** the username in the URI (e.g. `draftkit` in `mongodb+srv://draftkit:...`) must match the database user name in Atlas exactly (case-sensitive).

---

| Problem | What to do |
|--------|------------|
| "Could not connect to any servers" | Network Access: add your IP and/or "Allow from anywhere" (Step 4). Wait 1–2 minutes after adding. |
| "MONGODB_URI not set" | Make sure `.env` is in `player-valuation-api/` and has `MONGODB_URI=...` with no spaces around `=`. |

---

## When you deploy to Render

- In Render, add **Environment Variables**:
  - **MONGODB_URI** = same connection string (with password and `/draft_kit` if you use it).
  - **API_KEY** = same key (e.g. `mvp-teal-secret-key`).
- You only need to run the seed **once** for that database (e.g. run `npm run seed` locally with that same `MONGODB_URI`, or run it once after deploy). After that, the API will read/write that same MongoDB.

You’re done with MongoDB when: seed runs without errors and `curl` returns player JSON.
