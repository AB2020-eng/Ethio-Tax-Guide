from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
from pypdf import PdfReader

from rag import answer_question, index_pdf
from config import settings
import httpx
import json
import hashlib
import threading


app = FastAPI(title="Ethiopian Tax Consultant API")
DATA_FOLDER = "data"

# Step 2: PDF parsing function
def read_pdf(file_path):
    text = ""
    with open(file_path, "rb") as f:
        reader = PdfReader(f)
        for page in reader.pages:
            text += page.extract_text() or ""
    return text

# Step 2: Endpoint to read PDF content
@app.get("/read-pdf/{filename}")
def read_pdf_endpoint(filename: str):
    file_path = os.path.join(DATA_FOLDER, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    content = read_pdf(file_path)
    return {"filename": filename, "content": content[:1000]}  # preview first 1000 chars


# Allow frontend dev origin; adjust for production
origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _preindex_pdfs() -> None:
    base = os.path.join(os.getcwd(), DATA_FOLDER)
    candidates = []
    for root in [base, os.path.join(base, "pdfs")]:
        if not os.path.isdir(root):
            continue
        for dirpath, _, filenames in os.walk(root):
            for fn in filenames:
                if fn.lower().endswith(".pdf"):
                    candidates.append(os.path.join(dirpath, fn))
    seen = set()
    print(f"Pre-indexing {len(candidates)} PDF(s) from {base}…")
    for path in candidates:
        if path in seen:
            continue
        seen.add(path)
        try:
            index_pdf(path)
            print(f"Indexed: {os.path.basename(path)}")
        except Exception as e:
            print(f"Skip {path}: {e}")

@app.on_event("startup")
async def startup_index():
    threading.Thread(target=_preindex_pdfs, daemon=True).start()


class ChatRequest(BaseModel):
    user_id: str
    message: str


class ChatResponse(BaseModel):
    answer: str
    sources: List[str]


class TaxCalcRequest(BaseModel):
    income: float
    deductions: Optional[float] = 0.0


class TaxCalcResponse(BaseModel):
    estimated_tax: float
    explanation: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Upload Ethiopian tax PDF; it will be indexed for RAG.
    (RAG implementation is wired in rag.py, called from here.)
    """
    upload_dir = os.path.join(os.getcwd(), "data", "pdfs")
    os.makedirs(upload_dir, exist_ok=True)
    dest_path = os.path.join(upload_dir, file.filename)
    contents = await file.read()
    with open(dest_path, "wb") as f:
        f.write(contents)

    # Index into the in-memory RAG pipeline
    index_pdf(dest_path)

    return {"filename": file.filename, "indexed": True}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    """
    Answer user questions strictly based on indexed Ethiopian tax PDFs.
    Always cite Proclamation Article numbers in the answer.
    """
    answer, sources = answer_question(payload.message)
    return ChatResponse(answer=answer, sources=sources)


@app.post("/api/tax-calc", response_model=TaxCalcResponse)
async def tax_calc(payload: TaxCalcRequest):
    """
    Employment tax calculator using 2026 monthly brackets.
    """
    income = float(payload.income or 0.0)
    deductions = float(payload.deductions or 0.0)
    taxable = max(income - deductions, 0.0)

    # Brackets: (upper_bound, rate, deduction)
    brackets = [
        (2000.0, 0.00, 0.0),
        (4000.0, 0.15, 300.0),
        (7000.0, 0.20, 500.0),
        (10000.0, 0.25, 850.0),
        (14000.0, 0.30, 1350.0),
        (float("inf"), 0.35, 2050.0),
    ]
    # Find bracket
    rate = 0.0
    ded = 0.0
    lower = 0.0
    upper = 0.0
    for ub, r, d in brackets:
        upper = ub
        if taxable <= ub:
            rate, ded = r, d
            break
        lower = ub

    estimated_tax = max(taxable * rate - ded, 0.0)
    explanation = (
        "Monthly Employment Tax (2026):\n"
        "| Item | Amount |\n"
        "|---|---|\n"
        f"| Income | {income:.2f} ETB |\n"
        f"| Deductions | {deductions:.2f} ETB |\n"
        f"| Taxable Income | {taxable:.2f} ETB |\n"
        f"| Bracket | up to {upper if upper != float('inf') else '∞'} ETB |\n"
        f"| Rate | {rate*100:.0f}% |\n"
        f"| Deduction | {ded:.2f} ETB |\n"
        f"| Estimated Tax | {estimated_tax:.2f} ETB |\n"
    )
    return TaxCalcResponse(estimated_tax=estimated_tax, explanation=explanation)


class PaymentInitRequest(BaseModel):
    user_id: str
    pdf_id: str
    amount: float


class PaymentInitResponse(BaseModel):
    payment_url: str
    transaction_id: str


@app.post("/api/payment/create", response_model=PaymentInitResponse)
async def create_payment(payload: PaymentInitRequest):
    """
    Create a Telebirr H5 payment session and return payment URL.
    The Telegram MainButton should open this URL inside the mini app.
    NOTE: This is a simplified example based on public Telebirr H5 demos.
    You must adapt `gateway_url` and payload fields to your merchant contract.
    """
    gateway_url = "https://app.ethiotelecom.et:4443/paymentgateway/webpay/getSession"  # example endpoint, verify with Telebirr docs

    out_trade_no = f"{payload.user_id}-{payload.pdf_id}"

    ussd = {
        "outTradeNo": out_trade_no,
        "subject": f"Tax PDF {payload.pdf_id}",
        "totalAmount": f"{payload.amount:.2f}",
        "shortCode": settings.telebirr_short_code,
        "notifyUrl": settings.telebirr_notify_url,
        "returnUrl": settings.telebirr_return_url,
        "receiveName": "Ethiopian Tax Consultant",
        "appId": settings.telebirr_app_id,
        "timeoutExpress": "30",
        "nonce": out_trade_no,
        "timestamp": "20260101T000000",  # ideally: current timestamp in Telebirr format
    }

    # Sort and sign as shown in public PHP demos
    sorted_items = sorted(ussd.items(), key=lambda kv: kv[0])
    sign_str = "&".join(f"{k}={v}" for k, v in sorted_items)
    sha256 = hashlib.sha256(sign_str.encode("utf-8")).hexdigest()

    payload_to_telebirr = {
        "appid": ussd["appId"],
        "sign": sha256,
        "ussd": json.dumps(ussd),
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(gateway_url, json=payload_to_telebirr)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Telebirr gateway error: {resp.status_code}",
            )
        data = resp.json()

    # Many integrations return a `toPayUrl` or similar H5 URL.
    payment_url = data.get("toPayUrl") or data.get("redirectUrl")
    if not payment_url:
        # Fallback: developer can inspect full payload
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected Telebirr response: {data}",
        )

    return PaymentInitResponse(payment_url=payment_url, transaction_id=out_trade_no)


@app.post("/api/payment/webhook")
async def telebirr_webhook(
    outTradeNo: str = Form(...),
    tradeStatus: str = Form(...),
    totalAmount: float = Form(...),
):
    """
    Webhook endpoint Telebirr calls after payment.
    When tradeStatus is 'SUCCESS', unlock the PDF for the user.
    """
    if tradeStatus.upper() != "SUCCESS":
        # Optionally log failure
        return JSONResponse({"ok": True})

    # TODO: persist access: outTradeNo encodes user_id and pdf_id
    # user_id, pdf_id = outTradeNo.split("-", 1)

    return JSONResponse({"ok": True, "outTradeNo": outTradeNo})


@app.get("/api/pdf/{pdf_id}")
async def download_pdf(pdf_id: str, user_id: str):
    """
    Serve a purchased PDF if the user has unlocked it.
    The frontend should call this only after payment success.
    """
    # TODO: check user has access in persistence layer
    pdf_path = os.path.join(os.getcwd(), "data", "pdfs", pdf_id)
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF not found")
    return FileResponse(pdf_path, filename=pdf_id)
