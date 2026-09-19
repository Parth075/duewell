# Bill Payment Reminder System — Onboarding & Setup

Goal for tonight: a working local demo — manual bill entry, document upload with Gemini extraction, an agent you can chat with, and at least one reminder actually firing (email or in-app). Skip anything not essential to that.

## 1. Prerequisites (get these first)

- **Node.js** (18+) and **npm**
- **Python** 3.10+
- **Gemini API key** — go to https://aistudio.google.com/ → "Get API key" → create one. Free, no card.
- **Gmail app password** (only if you want real email sending) — Google Account → Security → 2-Step Verification → App passwords. Takes 2 minutes.

## 2. Project structure

```
bill-reminder/
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── agent.py
│   ├── scheduler.py
│   ├── database.py
│   ├── requirements.txt
│   └── .env
└── frontend/
    └── (Vite React app)
```

## 3. Backend setup

```bash
mkdir bill-reminder && cd bill-reminder
mkdir backend && cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install fastapi uvicorn sqlalchemy python-jose[cryptography] passlib[bcrypt] python-multipart apscheduler google-generativeai python-dotenv
pip freeze > requirements.txt
```

Create `backend/.env`:

```
GEMINI_API_KEY=your_key_here
JWT_SECRET=any_random_string
GMAIL_USER=youraddress@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password
```

Run it: `uvicorn main:app --reload --port 8000`
Auto docs at `http://localhost:8000/docs` — use this to test endpoints without waiting on the frontend.

## 4. Frontend setup

```bash
cd .. 
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install axios framer-motion lucide-react react-router-dom
npm run dev
```

Runs at `http://localhost:5173` by default — point `axios` calls at `http://localhost:8000`.

## 5. Tonight's build order (do NOT go out of order — each step should be demoable before you move on)

1. **DB + models** — Users, Bills, Reminders tables in SQLite (`sqlalchemy`, one `bills.db` file, no migrations needed tonight)
2. **Bare auth** — signup/login with JWT. If time is tight, hardcode a single demo user and skip this — a mini-project demo doesn't need multi-user auth to prove the concept
3. **Manual bill CRUD** — `POST /bills`, `GET /bills`, `PATCH /bills/{id}` — get this working and testable in `/docs` before touching the frontend
4. **Gemini agent wiring** — one `agent.py` with the Gemini client, function/tool declarations for `extract_bill`, `decide_reminder_schedule`, `answer_query`. Test each tool call directly from a Python script before wiring it to an endpoint
5. **Document upload → extraction** — `POST /bills/upload`, send the image/PDF bytes to Gemini, return the draft JSON for confirmation
6. **Chat endpoint** — `POST /chat`, agent answers questions about the user's bills
7. **One working reminder** — don't build the full daily scheduler tonight unless you have time left. Instead, build a `POST /bills/{id}/trigger-reminder` endpoint that runs `decide_reminder_schedule` + `send_notification` on demand — this proves the mechanism and is easier to demo live anyway. Add the real APScheduler daily job only if time permits
8. **Frontend last** — once the API works in `/docs`, wire the pages up. Don't build UI against an untested backend.

## 6. Fast troubleshooting

- **Gemini function calling errors** → check you're using a model that supports tools (e.g. `gemini-1.5-flash` or `gemini-2.0-flash`), not an older text-only endpoint
- **CORS errors in the browser** → add `fastapi.middleware.cors.CORSMiddleware` to `main.py`, allow `http://localhost:5173`
- **SQLite locked errors** → you likely have two processes (uvicorn `--reload` restarting) writing at once — restart cleanly
- **Gmail SMTP auth fails** → you need the *app password*, not your normal Gmail password, and 2FA must be on

## 7. If you run out of time

Cut in this order: (1) real email sending — log the reminder message to console/DB instead, (2) the daily scheduler — keep only the on-demand trigger, (3) auth — hardcode a user. Never cut the agent's tool-calling — that's the whole point of the project.
