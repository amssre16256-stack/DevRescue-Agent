from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import jwt, JWTError
from openai import OpenAI
from dotenv import load_dotenv
from pymongo import MongoClient
import hashlib
import subprocess
import tempfile
import os
from datetime import datetime, timedelta
from bson import ObjectId

load_dotenv()

SECRET_KEY = "devrescue_secret_key"
ALGORITHM = "HS256"

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MONGO_URL = os.getenv("MONGO_URL")

if not GROQ_API_KEY:
    raise Exception("GROQ_API_KEY missing")

if not MONGO_URL:
    raise Exception("MONGO_URL missing")

ai_client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1"
)

mongo_client = MongoClient(MONGO_URL)
db = mongo_client["devrescue"]
users_collection = db["users"]
history_collection = db["history"]

app = FastAPI(title="DevRescue AI Backend - MongoDB")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://dev-rescue-agent.vercel.app",
        "https://dev-rescue-agent-ey2y5f2c0-amssre16256-stacks-projects.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AuthRequest(BaseModel):
    username: str
    password: str

class CodeRequest(BaseModel):
    code: str

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def create_token(username):
    payload = {
        "sub": username,
        "exp": datetime.utcnow() + timedelta(hours=6)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/")
def home():
    return {"message": "DevRescue MongoDB Backend running"}

@app.post("/signup")
def signup(user: AuthRequest):
    username = user.username.strip()
    password = user.password.strip()

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")

    existing_user = users_collection.find_one({"username": username})

    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    users_collection.insert_one({
        "username": username,
        "password_hash": hash_password(password),
        "created_at": datetime.utcnow()
    })

    return {"message": "User created successfully"}

@app.post("/login")
def login(user: AuthRequest):
    username = user.username.strip()
    password = user.password.strip()

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")

    saved_user = users_collection.find_one({"username": username})

    if not saved_user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if saved_user["password_hash"] != hash_password(password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return {
        "token": create_token(username),
        "username": username
    }

def run_code(code):
    try:
        blocked_words = ["os.system", "subprocess", "shutil.rmtree", "rm -rf", "open("]

        for word in blocked_words:
            if word in code:
                return "", "Restricted operation detected for safety."

        with tempfile.NamedTemporaryFile(delete=False, suffix=".py", mode="w", encoding="utf-8") as f:
            f.write(code)
            file_name = f.name

        result = subprocess.run(
            ["python", file_name],
            capture_output=True,
            text=True,
            timeout=5
        )

        os.remove(file_name)
        return result.stdout, result.stderr

    except subprocess.TimeoutExpired:
        return "", "Code execution timed out. Possible infinite loop."

    except Exception as e:
        return "", str(e)

def extract_code(text):
    text = text.strip()

    if "```python" in text:
        start = text.find("```python") + len("```python")
        end = text.find("```", start)
        return text[start:end].strip()

    if "```" in text:
        start = text.find("```") + len("```")
        end = text.find("```", start)
        return text[start:end].strip()

    return text

def ai_fix_code(code, error, attempt):
    prompt = f"""
You are DevRescue AI, an autonomous Python debugging agent.

Repair attempt: {attempt}

Fix this broken Python code.

Rules:
- Return ONLY corrected Python code.
- No explanation.
- No markdown.
- Preserve user's intent.
- Do not add unsafe system commands, networking, file deletion, credential access, or shell commands.

Broken code:
{code}

Observed error:
{error}
"""

    response = ai_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": "You are a precise Python debugging agent. Return only corrected Python code."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.2
    )

    return extract_code(response.choices[0].message.content)

def fallback_fix_code(code, error):
    fixed = code

    if "NameError" in error and "username" in error:
        fixed = fixed.replace("username", "name")

    elif "IndexError" in error and "range(5)" in code:
        fixed = fixed.replace("range(5)", "range(len(numbers))")

    elif "SyntaxError" in error:
        fixed = fixed.replace("prin(", "print(")

    elif "ZeroDivisionError" in error:
        fixed = fixed.replace("print(a / b)", "print('Cannot divide by zero' if b == 0 else a / b)")

    return fixed

def agentic_debug_loop(original_code):
    steps = []
    current_code = original_code
    agent_type = "Groq Free AI Agent"
    attempts_used = 0

    for attempt in range(1, 4):
        attempts_used = attempt
        steps.append(f"Attempt {attempt}: Executing code safely.")

        output, error = run_code(current_code)

        if not error:
            steps.append(f"Attempt {attempt}: Code executed successfully. Validation passed.")
            return current_code, output, "", agent_type, attempts_used, steps

        steps.append(f"Attempt {attempt}: Error detected.")
        steps.append(error.splitlines()[-1] if error.splitlines() else error)

        try:
            steps.append(f"Attempt {attempt}: Sending error context to AI.")
            current_code = ai_fix_code(current_code, error, attempt)
            steps.append(f"Attempt {attempt}: AI generated corrected code.")
        except Exception as e:
            agent_type = "Fallback Agent: " + str(e)
            steps.append(f"Attempt {attempt}: AI failed. Using fallback repair.")
            current_code = fallback_fix_code(current_code, error)

    output, error = run_code(current_code)
    steps.append("Maximum attempts reached. Returning best available result.")

    return current_code, output, error, agent_type, attempts_used, steps

@app.post("/debug")
def debug_code(request: CodeRequest, token: str):
    username = verify_token(token)

    if not request.code.strip():
        raise HTTPException(status_code=400, detail="Code is required")

    user = users_collection.find_one({"username": username})

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    original_output, original_error = run_code(request.code)

    fixed_code, fixed_output, fixed_error, agent_type, attempts, steps = agentic_debug_loop(request.code)

    history_collection.insert_one({
        "user_id": str(user["_id"]),
        "username": username,
        "code": request.code,
        "error": original_error,
        "fixed_code": fixed_code,
        "output": fixed_output if fixed_output else fixed_error,
        "agent_type": agent_type,
        "attempts": attempts,
        "created_at": datetime.utcnow()
    })

    return {
        "original_error": original_error,
        "original_output": original_output,
        "fixed_code": fixed_code,
        "fixed_output": fixed_output,
        "fixed_error": fixed_error,
        "agent_type": agent_type,
        "attempts": attempts,
        "agent_steps": steps
    }

@app.get("/history")
def get_history(token: str):
    username = verify_token(token)

    user = users_collection.find_one({"username": username})

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    rows = history_collection.find(
        {"user_id": str(user["_id"])}
    ).sort("created_at", -1)

    history = []

    for row in rows:
        history.append({
            "id": str(row["_id"]),
            "code": row.get("code", ""),
            "error": row.get("error", ""),
            "fixed_code": row.get("fixed_code", ""),
            "output": row.get("output", ""),
            "agent_type": row.get("agent_type", ""),
            "attempts": row.get("attempts", 1),
            "created_at": str(row.get("created_at", ""))
        })

    return history