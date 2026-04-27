from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
import hashlib
import jwt
import os
from datetime import datetime, timedelta

app = FastAPI(title="DevRescue AI Backend - MongoDB")

# ✅ CORS FIX (IMPORTANT)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all (simplest fix)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# CONFIG
# =========================

SECRET = "mysecretkey"
MONGO_URL = os.getenv("MONGO_URL")

if not MONGO_URL:
    raise Exception("MONGO_URL missing")

client = MongoClient(MONGO_URL)
db = client["devrescue"]

users = db["users"]
history = db["history"]

# =========================
# MODELS
# =========================

class AuthRequest(BaseModel):
    username: str
    password: str

class CodeRequest(BaseModel):
    code: str

# =========================
# HELPERS
# =========================

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(username):
    payload = {
        "sub": username,
        "exp": datetime.utcnow() + timedelta(hours=6)
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")

def verify_token(token):
    try:
        payload = jwt.decode(token, SECRET, algorithms=["HS256"])
        return payload["sub"]
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

# =========================
# ROUTES
# =========================

@app.get("/")
def home():
    return {"message": "Backend working"}

@app.post("/signup")
def signup(data: AuthRequest):
    if users.find_one({"username": data.username}):
        raise HTTPException(status_code=400, detail="User already exists")

    users.insert_one({
        "username": data.username,
        "password": hash_password(data.password)
    })

    return {"message": "User created successfully"}

@app.post("/login")
def login(data: AuthRequest):
    user = users.find_one({"username": data.username})

    if not user or user["password"] != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_token(data.username)

    return {"token": token}

@app.post("/debug")
def debug(code_data: CodeRequest, token: str):
    username = verify_token(token)

    # Fake debug (for now)
    fixed_code = code_data.code.replace("username", f'"{username}"')
    output = f"Hello {username}"

    history.insert_one({
        "username": username,
        "code": code_data.code,
        "fixed_code": fixed_code,
        "output": output,
        "time": datetime.utcnow()
    })

    return {
        "fixed_code": fixed_code,
        "output": output,
        "original_error": "NameError fixed"
    }

@app.get("/history")
def get_history(token: str):
    username = verify_token(token)

    data = list(history.find({"username": username}, {"_id": 0}))
    return data