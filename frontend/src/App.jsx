import { useEffect, useState } from "react";

function App() {
  const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const [loggedIn, setLoggedIn] = useState(false);
  const [page, setPage] = useState("debug");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [code, setCode] = useState(`name = "Jatin"
print("Hello " + username)`);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) setLoggedIn(true);
  }, []);

  const signup = async () => {
    if (!username.trim() || !password.trim()) {
      alert("Enter username and password");
      return;
    }

    const res = await fetch(`${API}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    alert(data.message || data.detail || "Signup done");
  };

  const login = async () => {
    if (!username.trim() || !password.trim()) {
      alert("Enter username and password");
      return;
    }

    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username || username);
      setLoggedIn(true);
      setPage("debug");
    } else {
      alert(data.detail || "Login failed");
    }
  };

  const logout = () => {
    localStorage.clear();
    setLoggedIn(false);
    setResult(null);
    setHistory([]);
  };

  const runAgent = async () => {
    const token = localStorage.getItem("token");

    if (!code.trim()) {
      alert("Paste some Python code first");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${API}/debug?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      alert("AI agent failed. Backend may be sleeping. Try again in 30 seconds.");
    }

    setLoading(false);
  };

  const loadHistory = async () => {
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${API}/history?token=${token}`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
      setPage("history");
    } catch {
      alert("Could not load history");
    }
  };

  if (!loggedIn) {
    return (
      <div style={styles.authPage}>
        <div style={styles.authCard}>
          <h1 style={styles.logo}>DevRescue AI</h1>
          <p style={styles.subtitle}>Autonomous AI Debugging Agent</p>

          <input
            style={styles.input}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            style={styles.input}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button style={styles.greenBtn} onClick={login}>Login</button>
          <button style={styles.blueBtn} onClick={signup}>Signup</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <h2>DevRescue</h2>
        <p style={styles.small}>Welcome, {localStorage.getItem("username")}</p>

        <button style={styles.navBtn} onClick={() => setPage("debug")}>
          AI Debug Agent
        </button>

        <button style={styles.navBtn} onClick={loadHistory}>
          History
        </button>

        <button style={styles.logoutBtn} onClick={logout}>
          Logout
        </button>
      </aside>

      <main style={styles.main}>
        {page === "debug" && (
          <>
            <h1>AI Debug Dashboard</h1>
            <p style={styles.subtitle}>
              Paste broken Python code. The agent runs it, detects the error, fixes it, retries, and validates the result.
            </p>

            <textarea
              style={styles.textarea}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />

            <br />

            <button style={styles.greenBtn} onClick={runAgent}>
              {loading ? "Agent is thinking..." : "Run Debug Agent"}
            </button>

            {loading && (
              <div style={styles.loadingBox}>
                Running code → detecting error → asking AI → validating fix...
              </div>
            )}

            {result && (
              <div style={styles.grid}>
                <div style={styles.card}>
                  <h2>Original Error</h2>
                  <pre style={styles.pre}>{result.original_error || "No error"}</pre>
                </div>

                <div style={styles.card}>
                  <h2>Fixed Code</h2>
                  <pre style={styles.pre}>{result.fixed_code}</pre>
                </div>

                <div style={styles.card}>
                  <h2>Output</h2>
                  <pre style={styles.pre}>
                    {result.fixed_output || result.fixed_error || "No output"}
                  </pre>
                </div>

                <div style={styles.card}>
                  <h2>Agent Report</h2>
                  <p><b>Agent:</b> {result.agent_type}</p>
                  <p><b>Attempts:</b> {result.attempts || 1}</p>

                  <h3>Steps</h3>
                  <ol>
                    {result.agent_steps?.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </>
        )}

        {page === "history" && (
          <>
            <h1>Debug History</h1>

            {history.length === 0 && <p>No history found.</p>}

            {history.map((item) => (
              <div style={styles.historyCard} key={item.id}>
                <p><b>Date:</b> {item.created_at}</p>
                <p><b>Agent:</b> {item.agent_type}</p>
                <p><b>Attempts:</b> {item.attempts}</p>

                <h3>Original Code</h3>
                <pre style={styles.pre}>{item.code}</pre>

                <h3>Error</h3>
                <pre style={styles.pre}>{item.error}</pre>

                <h3>Fixed Code</h3>
                <pre style={styles.pre}>{item.fixed_code}</pre>

                <h3>Output</h3>
                <pre style={styles.pre}>{item.output}</pre>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}

const styles = {
  authPage: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #020617, #0f172a)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "white",
  },
  authCard: {
    width: "420px",
    background: "#1e293b",
    padding: "35px",
    borderRadius: "18px",
    textAlign: "center",
    boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
  },
  logo: {
    fontSize: "38px",
    marginBottom: "5px",
  },
  subtitle: {
    color: "#94a3b8",
    marginBottom: "20px",
  },
  input: {
    width: "90%",
    padding: "13px",
    margin: "10px",
    borderRadius: "8px",
    border: "none",
  },
  greenBtn: {
    background: "#22c55e",
    color: "white",
    border: "none",
    padding: "12px 22px",
    margin: "10px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  blueBtn: {
    background: "#3b82f6",
    color: "white",
    border: "none",
    padding: "12px 22px",
    margin: "10px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  app: {
    display: "flex",
    minHeight: "100vh",
    background: "#0f172a",
    color: "white",
  },
  sidebar: {
    width: "240px",
    background: "#020617",
    padding: "25px",
  },
  small: {
    color: "#94a3b8",
    fontSize: "14px",
  },
  navBtn: {
    width: "100%",
    padding: "12px",
    marginTop: "12px",
    background: "#1e293b",
    color: "white",
    border: "1px solid #334155",
    borderRadius: "8px",
    cursor: "pointer",
  },
  logoutBtn: {
    width: "100%",
    padding: "12px",
    marginTop: "30px",
    background: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  main: {
    flex: 1,
    padding: "35px",
  },
  textarea: {
    width: "95%",
    height: "280px",
    background: "#020617",
    color: "#22c55e",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "18px",
    fontFamily: "monospace",
    fontSize: "15px",
  },
  loadingBox: {
    marginTop: "20px",
    background: "#1e293b",
    padding: "15px",
    borderRadius: "10px",
    color: "#22c55e",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginTop: "25px",
  },
  card: {
    background: "#1e293b",
    padding: "20px",
    borderRadius: "14px",
    border: "1px solid #334155",
  },
  pre: {
    background: "#020617",
    color: "#22c55e",
    padding: "14px",
    borderRadius: "10px",
    whiteSpace: "pre-wrap",
    overflowX: "auto",
  },
  historyCard: {
    background: "#1e293b",
    padding: "22px",
    borderRadius: "14px",
    marginTop: "20px",
    border: "1px solid #334155",
  },
};

export default App;