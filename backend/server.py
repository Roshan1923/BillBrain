from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, json, io, csv, tempfile, base64
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import bcrypt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============= DEFAULT CATEGORIES =============
DEFAULT_CATEGORIES = [
    "Food & Dining", "Transportation", "Entertainment", "Shopping",
    "Health & Medical", "Utilities & Bills", "Education", "Travel",
    "Home & Rent", "Office Supplies", "Subscriptions & Memberships",
    "Gifts & Donations", "Insurance", "Miscellaneous"
]

# ============= PYDANTIC MODELS =============
class UserRegister(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class GoogleAuthRequest(BaseModel):
    session_id: str

class CategoryCreate(BaseModel):
    name: str
    section: str

class CategoryUpdate(BaseModel):
    name: str

class ReceiptCreate(BaseModel):
    merchant_name: str
    date: str
    total: float
    tax: float = 0
    items: List[dict] = []
    payment_method: str = ""
    section: str
    category_id: str
    notes: str = ""
    image_base64: str = ""

class ReceiptUpdate(BaseModel):
    merchant_name: Optional[str] = None
    date: Optional[str] = None
    total: Optional[float] = None
    tax: Optional[float] = None
    items: Optional[List[dict]] = None
    payment_method: Optional[str] = None
    section: Optional[str] = None
    category_id: Optional[str] = None
    notes: Optional[str] = None

class OCRRequest(BaseModel):
    image_base64: str

class UserSettingsUpdate(BaseModel):
    currency: Optional[str] = None
    theme: Optional[str] = None

# ============= AUTH HELPERS =============
async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split("Bearer ")[1]
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    safe_user = {k: v for k, v in user.items() if k != "password_hash"}
    return safe_user


async def create_session(user_id: str):
    token = f"sess_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    return token


async def seed_default_categories(user_id: str):
    categories = []
    for section in ["personal", "business"]:
        for name in DEFAULT_CATEGORIES:
            categories.append({
                "category_id": f"cat_{uuid.uuid4().hex[:12]}",
                "user_id": user_id,
                "name": name,
                "section": section,
                "is_default": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    if categories:
        await db.categories.insert_many(categories)


# ============= AUTH ROUTES =============
@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    user_id = f"user_{uuid.uuid4().hex[:12]}"

    user = {
        "user_id": user_id,
        "email": data.email.lower(),
        "name": data.name,
        "password_hash": hashed,
        "auth_provider": "email",
        "picture": "",
        "currency": "CAD",
        "theme": "dark",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    await seed_default_categories(user_id)

    token = await create_session(user_id)
    return {
        "token": token,
        "user": {
            "user_id": user_id, "email": user["email"], "name": data.name,
            "picture": "", "currency": "CAD", "theme": "dark"
        }
    }


@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Please use Google Sign-In for this account")

    if not bcrypt.checkpw(data.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = await create_session(user["user_id"])
    return {
        "token": token,
        "user": {
            "user_id": user["user_id"], "email": user["email"], "name": user["name"],
            "picture": user.get("picture", ""), "currency": user.get("currency", "CAD"),
            "theme": user.get("theme", "dark")
        }
    }


@api_router.post("/auth/google-session")
async def google_session(data: GoogleAuthRequest):
    try:
        async with httpx.AsyncClient() as http_client:
            resp = await http_client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": data.session_id}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Google session")
            google_data = resp.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=500, detail="Failed to verify Google session")

    email = google_data["email"].lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})

    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {
            "name": google_data.get("name", existing.get("name", "")),
            "picture": google_data.get("picture", existing.get("picture", "")),
        }})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": google_data.get("name", ""),
            "password_hash": "",
            "auth_provider": "google",
            "picture": google_data.get("picture", ""),
            "currency": "CAD",
            "theme": "dark",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)
        await seed_default_categories(user_id)

    token = await create_session(user_id)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"token": token, "user": user_doc}


@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user


@api_router.post("/auth/logout")
async def logout(request: Request):
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split("Bearer ")[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"message": "Logged out"}


# ============= CATEGORY ROUTES =============
@api_router.get("/categories")
async def get_categories(request: Request):
    user = await get_current_user(request)
    cats = await db.categories.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).to_list(500)
    return cats


@api_router.post("/categories")
async def create_category(data: CategoryCreate, request: Request):
    user = await get_current_user(request)
    cat = {
        "category_id": f"cat_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": data.name,
        "section": data.section,
        "is_default": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.categories.insert_one(cat)
    return {k: v for k, v in cat.items() if k != "_id"}


@api_router.put("/categories/{category_id}")
async def update_category(category_id: str, data: CategoryUpdate, request: Request):
    user = await get_current_user(request)
    result = await db.categories.update_one(
        {"category_id": category_id, "user_id": user["user_id"]},
        {"$set": {"name": data.name}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category updated"}


@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, request: Request):
    user = await get_current_user(request)
    receipt_count = await db.receipts.count_documents(
        {"category_id": category_id, "user_id": user["user_id"]}
    )
    if receipt_count > 0:
        return {"message": f"Warning: {receipt_count} receipts use this category", "receipt_count": receipt_count, "deleted": False}

    result = await db.categories.delete_one(
        {"category_id": category_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted", "deleted": True}


# ============= RECEIPT ROUTES =============
@api_router.get("/receipts")
async def get_receipts(
    request: Request,
    section: Optional[str] = None,
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    amount_min: Optional[float] = None,
    amount_max: Optional[float] = None,
    skip: int = 0,
    limit: int = 50
):
    user = await get_current_user(request)
    query = {"user_id": user["user_id"]}

    if section:
        query["section"] = section
    if category_id:
        query["category_id"] = category_id
    if search:
        query["merchant_name"] = {"$regex": search, "$options": "i"}
    if date_from:
        query.setdefault("date", {})["$gte"] = date_from
    if date_to:
        query.setdefault("date", {})["$lte"] = date_to
    if amount_min is not None:
        query.setdefault("total", {})["$gte"] = amount_min
    if amount_max is not None:
        query.setdefault("total", {})["$lte"] = amount_max

    # Exclude image_base64 from list view for performance
    receipts = await db.receipts.find(
        query, {"_id": 0, "image_base64": 0}
    ).sort("date", -1).skip(skip).limit(limit).to_list(limit)

    total_count = await db.receipts.count_documents(query)
    return {"receipts": receipts, "total": total_count}


@api_router.post("/receipts")
async def create_receipt(data: ReceiptCreate, request: Request):
    user = await get_current_user(request)
    receipt = {
        "receipt_id": f"rcpt_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "merchant_name": data.merchant_name,
        "date": data.date,
        "total": data.total,
        "tax": data.tax,
        "items": data.items,
        "payment_method": data.payment_method,
        "section": data.section,
        "category_id": data.category_id,
        "notes": data.notes,
        "image_base64": data.image_base64,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.receipts.insert_one(receipt)
    result = {k: v for k, v in receipt.items() if k not in ("_id", "image_base64")}
    result["has_image"] = bool(data.image_base64)
    return result


@api_router.get("/receipts/{receipt_id}")
async def get_receipt(receipt_id: str, request: Request):
    user = await get_current_user(request)
    receipt = await db.receipts.find_one(
        {"receipt_id": receipt_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@api_router.put("/receipts/{receipt_id}")
async def update_receipt(receipt_id: str, data: ReceiptUpdate, request: Request):
    user = await get_current_user(request)
    update_data = {k: v for k, v in data.dict(exclude_unset=True).items()}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.receipts.update_one(
        {"receipt_id": receipt_id, "user_id": user["user_id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return {"message": "Receipt updated"}


@api_router.delete("/receipts/{receipt_id}")
async def delete_receipt(receipt_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.receipts.delete_one(
        {"receipt_id": receipt_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return {"message": "Receipt deleted"}


# ============= OCR ROUTE =============
@api_router.post("/ocr/scan")
async def ocr_scan(data: OCRRequest, request: Request):
    await get_current_user(request)

    llm_key = os.environ.get('EMERGENT_LLM_KEY', '')
    if not llm_key:
        raise HTTPException(status_code=500, detail="OCR service not configured")

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

        chat = LlmChat(
            api_key=llm_key,
            session_id=f"ocr_{uuid.uuid4().hex[:8]}",
            system_message=(
                "You are a receipt OCR assistant. Extract data from receipt images and return ONLY valid JSON. "
                "Extract: merchant_name (string), date (YYYY-MM-DD string), total (number), "
                "tax (number, GST/HST if visible), items (array of {name: string, price: number}), "
                "payment_method (string like 'Visa', 'Cash', 'Debit', etc). "
                "If a field is not visible, use empty string for strings, 0 for numbers, empty array for items. "
                "Return ONLY the JSON object, no markdown, no explanation."
            )
        ).with_model("openai", "gpt-4o")

        image_content = ImageContent(image_base64=data.image_base64)
        user_message = UserMessage(
            text="Extract all receipt data from this image. Return only valid JSON.",
            file_contents=[image_content]
        )
        response = await chat.send_message(user_message)

        # Parse JSON from response
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1] if "\n" in response_text else response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

        extracted = json.loads(response_text)
        return {
            "merchant_name": extracted.get("merchant_name", ""),
            "date": extracted.get("date", ""),
            "total": float(extracted.get("total", 0)),
            "tax": float(extracted.get("tax", 0)),
            "items": extracted.get("items", []),
            "payment_method": extracted.get("payment_method", "")
        }

    except json.JSONDecodeError as e:
        logger.error(f"OCR JSON parse error: {e}, response: {response_text[:200]}")
        return {
            "merchant_name": "", "date": "", "total": 0, "tax": 0,
            "items": [], "payment_method": "",
            "error": "Could not parse receipt. Please enter details manually."
        }
    except Exception as e:
        logger.error(f"OCR error: {e}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


# ============= DASHBOARD ROUTE =============
@api_router.get("/dashboard/summary")
async def get_dashboard_summary(request: Request):
    user = await get_current_user(request)
    user_id = user["user_id"]

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    year_start = now.replace(month=1, day=1).strftime("%Y-%m-%d")
    today = now.strftime("%Y-%m-%d")

    # Monthly total
    monthly_pipeline = [
        {"$match": {"user_id": user_id, "date": {"$gte": month_start, "$lte": today}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "tax": {"$sum": "$tax"}, "count": {"$sum": 1}}}
    ]
    monthly = await db.receipts.aggregate(monthly_pipeline).to_list(1)
    monthly_data = monthly[0] if monthly else {"total": 0, "tax": 0, "count": 0}

    # Yearly total
    yearly_pipeline = [
        {"$match": {"user_id": user_id, "date": {"$gte": year_start, "$lte": today}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "tax": {"$sum": "$tax"}, "count": {"$sum": 1}}}
    ]
    yearly = await db.receipts.aggregate(yearly_pipeline).to_list(1)
    yearly_data = yearly[0] if yearly else {"total": 0, "tax": 0, "count": 0}

    # Section breakdown
    section_pipeline = [
        {"$match": {"user_id": user_id, "date": {"$gte": year_start, "$lte": today}}},
        {"$group": {"_id": "$section", "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
    ]
    sections = await db.receipts.aggregate(section_pipeline).to_list(10)
    section_data = {s["_id"]: {"total": s["total"], "count": s["count"]} for s in sections if s["_id"]}

    # Category breakdown (top 10)
    category_pipeline = [
        {"$match": {"user_id": user_id, "date": {"$gte": year_start, "$lte": today}}},
        {"$group": {"_id": "$category_id", "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 10}
    ]
    categories = await db.receipts.aggregate(category_pipeline).to_list(10)

    # Resolve category names
    cat_ids = [c["_id"] for c in categories if c["_id"]]
    cat_docs = await db.categories.find(
        {"category_id": {"$in": cat_ids}}, {"_id": 0, "category_id": 1, "name": 1}
    ).to_list(100)
    cat_map = {c["category_id"]: c["name"] for c in cat_docs}

    category_data = [
        {"category_id": c["_id"], "name": cat_map.get(c["_id"], "Unknown"),
         "total": c["total"], "count": c["count"]}
        for c in categories if c["_id"]
    ]

    # Recent receipts
    recent = await db.receipts.find(
        {"user_id": user_id}, {"_id": 0, "image_base64": 0}
    ).sort("created_at", -1).limit(10).to_list(10)

    # Resolve category names for recent
    recent_cat_ids = list(set(r.get("category_id", "") for r in recent if r.get("category_id")))
    if recent_cat_ids:
        recent_cats = await db.categories.find(
            {"category_id": {"$in": recent_cat_ids}}, {"_id": 0, "category_id": 1, "name": 1}
        ).to_list(100)
        recent_cat_map = {c["category_id"]: c["name"] for c in recent_cats}
        for r in recent:
            r["category_name"] = recent_cat_map.get(r.get("category_id", ""), "")

    return {
        "monthly": {"total": monthly_data.get("total", 0), "tax": monthly_data.get("tax", 0), "count": monthly_data.get("count", 0)},
        "yearly": {"total": yearly_data.get("total", 0), "tax": yearly_data.get("tax", 0), "count": yearly_data.get("count", 0)},
        "sections": section_data,
        "categories": category_data,
        "recent_receipts": recent
    }


# ============= REPORT ROUTES =============
@api_router.get("/reports/tax-summary")
async def get_tax_summary(
    request: Request,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    section: Optional[str] = None
):
    user = await get_current_user(request)
    query = {"user_id": user["user_id"]}

    if date_from:
        query.setdefault("date", {})["$gte"] = date_from
    if date_to:
        query.setdefault("date", {})["$lte"] = date_to
    if section:
        query["section"] = section

    # By section and category
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": {"section": "$section", "category_id": "$category_id"},
            "total": {"$sum": "$total"},
            "tax": {"$sum": "$tax"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id.section": 1, "total": -1}}
    ]
    results = await db.receipts.aggregate(pipeline).to_list(200)

    # Resolve category names
    cat_ids = list(set(r["_id"]["category_id"] for r in results if r["_id"].get("category_id")))
    cat_docs = await db.categories.find(
        {"category_id": {"$in": cat_ids}}, {"_id": 0, "category_id": 1, "name": 1}
    ).to_list(200)
    cat_map = {c["category_id"]: c["name"] for c in cat_docs}

    summary = {"personal": [], "business": []}
    totals = {"personal": {"total": 0, "tax": 0, "count": 0}, "business": {"total": 0, "tax": 0, "count": 0}}

    for r in results:
        sec = r["_id"]["section"]
        if sec in summary:
            summary[sec].append({
                "category_id": r["_id"]["category_id"],
                "category_name": cat_map.get(r["_id"]["category_id"], "Unknown"),
                "total": r["total"],
                "tax": r["tax"],
                "count": r["count"]
            })
            totals[sec]["total"] += r["total"]
            totals[sec]["tax"] += r["tax"]
            totals[sec]["count"] += r["count"]

    return {"summary": summary, "totals": totals}


@api_router.get("/reports/export-csv")
async def export_csv(
    request: Request,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    section: Optional[str] = None
):
    user = await get_current_user(request)
    query = {"user_id": user["user_id"]}

    if date_from:
        query.setdefault("date", {})["$gte"] = date_from
    if date_to:
        query.setdefault("date", {})["$lte"] = date_to
    if section:
        query["section"] = section

    receipts = await db.receipts.find(
        query, {"_id": 0, "image_base64": 0, "user_id": 0}
    ).sort("date", -1).to_list(10000)

    # Resolve categories
    cat_ids = list(set(r.get("category_id", "") for r in receipts if r.get("category_id")))
    cat_docs = await db.categories.find(
        {"category_id": {"$in": cat_ids}}, {"_id": 0, "category_id": 1, "name": 1}
    ).to_list(500)
    cat_map = {c["category_id"]: c["name"] for c in cat_docs}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Merchant", "Section", "Category", "Total (CAD)", "Tax (CAD)", "Payment Method", "Notes"])

    for r in receipts:
        writer.writerow([
            r.get("date", ""), r.get("merchant_name", ""), r.get("section", "").title(),
            cat_map.get(r.get("category_id", ""), ""), f"{r.get('total', 0):.2f}",
            f"{r.get('tax', 0):.2f}", r.get("payment_method", ""), r.get("notes", "")
        ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=billbrain_receipts_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


# ============= SETTINGS ROUTES =============
@api_router.put("/settings")
async def update_settings(data: UserSettingsUpdate, request: Request):
    user = await get_current_user(request)
    update_data = {k: v for k, v in data.dict(exclude_unset=True).items() if v is not None}
    if update_data:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update_data})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return updated


# ============= INCLUDE ROUTER & MIDDLEWARE =============
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
