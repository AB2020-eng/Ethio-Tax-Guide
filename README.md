## Ethiopian Tax Consultant Telegram Mini App

This project is a **Telegram Mini App** for an Ethiopian tax consultant, built with:

- **Frontend**: Next.js (App Router, TypeScript, Tailwind) in `frontend`
- **Backend**: FastAPI with a simple **RAG pipeline** over Ethiopian tax PDFs in `backend`

The Mini App provides:

- **Chat Assistant tab** – answers questions **only** from uploaded Ethiopian tax PDFs and always cites **Proclamation Article numbers** when present.
- **Tax Calculator tab** – mobile-first income + deductions estimator with 🇪🇹 theme (green / yellow / red accents).
- **Telebirr H5 payment flow** – triggered via Telegram `MainButton`; on success, the backend can unlock PDF downloads for the user.

---

### 1. Local Development

#### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # on Windows
pip install -r requirements.txt

uvicorn main:app --reload --port 8000
```

Environment variables (create a `.env` file in `backend`):

```bash
TELEBIRR_APP_ID=your_app_id
TELEBIRR_SHORT_CODE=your_short_code
TELEBIRR_PUBLIC_KEY=your_telebirr_public_key
TELEBIRR_NOTIFY_URL=https://your-backend-domain.com/api/payment/webhook
TELEBIRR_RETURN_URL=https://your-frontend-domain.com/telebirr/return
RAG_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2  # optional override
```

Key endpoints:

- `POST /api/upload` – upload an Ethiopian tax PDF; it is parsed and **indexed into the RAG pipeline**.
- `POST /api/chat` – body: `{ user_id, message }`, returns `{ answer, sources[] }`. Answers are built only from indexed PDF text and will mention **Articles** where detected.
- `POST /api/tax-calc` – simple placeholder tax calculation based on income and deductions.
- `POST /api/payment/create` – prepares a **Telebirr H5** session and returns a `payment_url` for the Telegram app to open.
- `POST /api/payment/webhook` – Telebirr callback; when `tradeStatus == "SUCCESS"` you can mark the PDF as unlocked for the user.
- `GET /api/pdf/{pdf_id}?user_id=...` – serve a purchased PDF (you should plug in real access checks).

> **Important**: The Telebirr integration is based on public H5 demo code and **must be aligned with your official Telebirr merchant documentation** (gateway URL, fields, and signature rules).

#### Frontend (Next.js Mini App UI)

```bash
cd frontend
npm install
npm run dev
```

The main Mini App screen is `src/app/page.tsx` and is designed **mobile-first** (Telegram in-app webview):

- Integrates the official Telegram script:
  - See `src/app/layout.tsx` – uses `next/script` to load `https://telegram.org/js/telegram-web-app.js`.
- Uses Ethiopian colors in `globals.css` (variables `--ethi-green`, `--ethi-yellow`, `--ethi-red`).
- Two tabs:
  - **Chat Assistant** – chat-style UI, calls `http://localhost:8000/api/chat`.
  - **Tax Calculator** – calls `http://localhost:8000/api/tax-calc`, and on success sets a flag that shows the Telegram `MainButton` for payment.
- The Telegram `MainButton` is configured in `page.tsx` and calls the backend `POST /api/payment/create`, then opens the Telebirr H5 `payment_url` in the same webview.

For production you should:

- Replace `http://localhost:8000` with your deployed backend URL.
- Use HTTPS for both frontend and backend.

---

### 2. RAG Pipeline Overview

Backend RAG-related files:

- `rag.py` –
  - Uses `pypdf` to extract text from uploaded PDFs.
  - Chunks by page and embeds with `sentence-transformers` (`all-MiniLM-L6-v2` by default).
  - Stores a simple **FAISS** in-memory index.
  - Heuristically extracts **Proclamation Article numbers** from each chunk (regex like `Article 5` or `Art. 5`).
  - `answer_question(question)` searches the index, returns a stitched answer that is made only of PDF snippets plus a line listing referenced **Articles** and sources.

Flow:

1. Upload PDFs via `/api/upload` (e.g. admin panel or script).
2. PDFs are stored in `data/pdfs/` and indexed immediately.
3. Chat requests `/api/chat` call `answer_question`, which searches the vector index first and never answers from outside sources.

---

### 3. Telegram Mini App Setup

1. Create a Telegram Bot via `@BotFather` and configure a **Web App** for one of your commands.
2. Set the Mini App URL to your deployed Next.js app (e.g. `https://your-domain.com/telegram`).
3. Ensure:
   - The HTML includes `<script src="https://telegram.org/js/telegram-web-app.js"></script>` (already handled in `layout.tsx`).
   - Your backend CORS allows the deployed frontend origin.
4. In the Mini App, the Telegram object is available as `window.Telegram.WebApp`:
   - `MainButton` is configured and shown after a tax calculation result to trigger payment.

---

### 4. Where to Plug In Business Logic

- **Real Ethiopian tax brackets** – replace the placeholder flat-rate logic in `backend/main.py` (`/api/tax-calc`) with actual bracket rules and Proclamation references.
- **Access control for PDFs** – in `backend/main.py`:
  - Enhance `/api/payment/webhook` to parse `outTradeNo` into `user_id` and `pdf_id` and store permissions (e.g. database).
  - Update `/api/pdf/{pdf_id}` to check if the given `user_id` has unlocked that PDF.
- **Admin upload UI** – optionally add a protected Next.js route or separate tool that POSTs to `/api/upload`.

This gives you an end-to-end starting point; you can now wire in your real tax knowledge, Telebirr credentials, and Telegram bot configuration.

