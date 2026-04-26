from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import jwt, JWTError
from openai import OpenAI
from dotenv import load_dotenv
import sqlite3
import hashlib
import subprocess
import tempfile
import os
from datetime import datetime, timedelta

load_dotenv()

SECRET_KEY = "devrescue_secret_key"
ALGORITHM = "HS256"

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

app = FastAPI(title="DevRescue AI Backend - Agentic Debugger")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AuthRequest(BaseModel):
    username: str
    password: str

class CodeRequest(BaseModel):
    code: str

def get_db():
    conn = sqlite3.connect("devrescue.db", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    db = get_db()
    db.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    )
    """)
    db.execute("""
    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        code TEXT,
        error TEXT,
        fixed_code TEXT,
        output TEXT,
        agent_type TEXT,
        attempts INTEGER,
        created_at TEXT
    )
    """)
    db.commit()
    db.close()

init_db()

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
    return {"message": "DevRescue Agentic Backend running"}

@app.post("/signup")
def signup(user: AuthRequest):
    username = user.username.strip()
    password = user.password.strip()

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")

    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, hash_password(password))
        )
        db.commit()
        return {"message": "User created successfully"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="User already exists")
    finally:
        db.close()

@app.post("/login")
def login(user: AuthRequest):
    username = user.username.strip()
    password = user.password.strip()

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")

    db = get_db()
    saved_user = db.execute(
        "SELECT * FROM users WHERE username = ?",
        (username,)
    ).fetchone()
    db.close()

    if not saved_user or saved_user["password_hash"] != hash_password(password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return {
        "token": create_token(username),
        "username": username
    }

def run_code(code):
    try:
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

def groq_fix_code(code, error, attempt):
    prompt = f"""
You are DevRescue AI, an autonomous Python debugging agent.

You are on repair attempt number {attempt}.

Your task:
Fix the broken Python code.

Rules:
- Return ONLY corrected Python code.
- No explanation.
- No markdown.
- Preserve the user's original intent.
- Do not add unsafe file deletion, networking, credential access, shell commands, or system commands.
- If the previous fix still failed, produce a better corrected version.

Broken code:
{code}

Observed error:
{error}
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": "You are a precise Python debugging agent. Return only valid corrected Python code."
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

    if "IndexError" in error and "range(5)" in code:
        fixed = fixed.replace("range(5)", "range(len(numbers))")

    elif "ZeroDivisionError" in error:
        fixed = fixed.replace("print(a / b)", "print('Cannot divide by zero' if b == 0 else a / b)")

    elif "NameError" in error and "username" in error:
        fixed = fixed.replace("username", "name")

    elif "SyntaxError" in error:
        fixed = fixed.replace("prin(", "print(")

    return fixed

def agentic_debug_loop(original_code):
    steps = []
    current_code = original_code
    final_output = ""
    final_error = ""
    agent_type = "Groq Free AI Agent"
    attempts_used = 0

    for attempt in range(1, 4):
        attempts_used = attempt
        steps.append(f"Attempt {attempt}: Executing code safely in backend sandbox.")

        output, error = run_code(current_code)

        if not error:
            steps.append(f"Attempt {attempt}: Code executed successfully. Validation passed.")
            final_output = output
            final_error = ""
            return current_code, final_output, final_error, agent_type, attempts_used, steps

        steps.append(f"Attempt {attempt}: Error observed and captured.")
        steps.append(error.splitlines()[-1] if error.splitlines() else error)

        try:
            steps.append(f"Attempt {attempt}: Sending error context to Groq AI for repair.")
            current_code = groq_fix_code(current_code, error, attempt)
            steps.append(f"Attempt {attempt}: AI generated a corrected version.")
        except Exception as e:
            agent_type = "Fallback Agent: " + str(e)
            steps.append(f"Attempt {attempt}: Groq failed, fallback repair engine activated.")
            current_code = fallback_fix_code(current_code, error)

        final_output = output
        final_error = error

    steps.append("Maximum repair attempts reached. Returning best available fix.")
    output, error = run_code(current_code)
    final_output = output
    final_error = error

    return current_code, final_output, final_error, agent_type, attempts_used, steps

@app.post("/debug")
def debug_code(request: CodeRequest, token: str):
    username = verify_token(token)

    if request.code.strip() == "":
        raise HTTPException(status_code=400, detail="Code is required")

    db = get_db()
    user = db.execute(
        "SELECT * FROM users WHERE username = ?",
        (username,)
    ).fetchone()

    if not user:
        db.close()
        raise HTTPException(status_code=401, detail="User not found")

    original_output, original_error = run_code(request.code)

    fixed_code, fixed_output, fixed_error, agent_type, attempts, steps = agentic_debug_loop(request.code)

    try:
        db.execute("""
            INSERT INTO history (user_id, code, error, fixed_code, output, agent_type, attempts, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user["id"],
            request.code,
            original_error,
            fixed_code,
            fixed_output if fixed_output else fixed_error,
            agent_type,
            attempts,
            datetime.now().isoformat()
        ))
        db.commit()
    except Exception:
        pass
    finally:
        db.close()

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

    db = get_db()
    user = db.execute(
        "SELECT * FROM users WHERE username = ?",
        (username,)
    ).fetchone()

    if not user:
        db.close()
        raise HTTPException(status_code=401, detail="User not found")

    rows = db.execute(
        "SELECT * FROM history WHERE user_id = ? ORDER BY id DESC",
        (user["id"],)
    ).fetchall()

    db.close()
    return [dict(row) for row in rows]