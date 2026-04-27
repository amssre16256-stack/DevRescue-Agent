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
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) setLoggedIn(true);
  }, []);

  const showNotice = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3000);
  };

  const signup = async () => {
    if (!username.trim() || !password.trim()) {
      showNotice("Enter username and password");
      return;
    }

    const res = await fetch(`${API}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    showNotice(data.message || data.detail || "Signup done");
  };

  const login = async () => {
    if (!username.trim() || !password.trim()) {
      showNotice("Enter username and password");
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
      setUsername("");
      setPassword("");
    } else {
      showNotice(data.detail || "Login failed");
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
      showNotice("Paste Python code first");
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
    } catch {
      showNotice("Backend may be sleeping. Try again in 30 seconds.");
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
      showNotice("Could not load history");
    }
  };

  const copyFixedCode = () => {
    if (result?.fixed_code) {
      navigator.clipboard.writeText(result.fixed_code);
      showNotice("Fixed code copied");
    }
  };

  if (!loggedIn) {
    return (
      <div style={styles.authPage}>
        {notice && <div style={styles.toast}>{notice}</div>}

        <div style={styles.authCard}>
          <div style={styles.badge}>AI AGENT</div>
          <h1 style={styles.logo}>DevRescue AI</h1>
          <p style={styles.subtitle}>
            Autonomous code debugging for students and beginner developers.
          </p>

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

          <div style={styles.authActions}>
            <button style={styles.primaryBtn} onClick={login}>
              Login
            </button>
            <button style={styles.secondaryBtn} onClick={signup}>
              Signup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      {notice && <div style={styles.toast}>{notice}</div>}

      <aside style={styles.sidebar}>
        <div>
          <h2 style={styles.sideLogo}>DevRescue</h2>
          <p style={styles.small}>Welcome, {localStorage.getItem("username")}</p>
        </div>

        <div style={styles.nav}>
          <button
            style={page === "debug" ? styles.activeNavBtn : styles.navBtn}
            onClick={() => setPage("debug")}
          >
            Debug Agent
          </button>

          <button
            style={page === "history" ? styles.activeNavBtn : styles.navBtn}
            onClick={loadHistory}
          >
            History
          </button>
        </div>

        <button style={styles.logoutBtn} onClick={logout}>
          Logout
        </button>
      </aside>

      <main style={styles.main}>
        {page === "debug" && (
          <>
            <section style={styles.hero}>
              <div>
                <div style={styles.badge}>RUN → OBSERVE → FIX → VALIDATE</div>
                <h1 style={styles.heroTitle}>Autonomous AI Debugging Agent</h1>
                <p style={styles.heroText}>
                  Paste broken Python code. DevRescue executes it safely,
                  detects the error, repairs it with AI, retries execution, and
                  validates the final output.
                </p>
              </div>

              <div style={styles.statsRow}>
                <div style={styles.statCard}>
                  <b>AI</b>
                  <span>Groq Agent</span>
                </div>
                <div style={styles.statCard}>
                  <b>3x</b>
                  <span>Repair Attempts</span>
                </div>
                <div style={styles.statCard}>
                  <b>Live</b>
                  <span>Cloud Deployed</span>
                </div>
              </div>
            </section>

            <section style={styles.editorPanel}>
              <div style={styles.panelHeader}>
                <h2>Python Code</h2>
                <button
                  style={styles.primaryBtn}
                  onClick={runAgent}
                  disabled={loading}
                >
                  {loading ? "Analyzing..." : "Run Debug Agent"}
                </button>
              </div>

              <textarea
                style={styles.textarea}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </section>

            {loading && (
              <div style={styles.loadingBox}>
                Agent is executing code, reading the traceback, generating a
                fix, and validating the result...
              </div>
            )}

            {result && (
              <div style={styles.grid}>
                <div style={styles.card}>
                  <h2>Original Error</h2>
                  <pre style={styles.pre}>
                    {result.original_error || "No error"}
                  </pre>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardHeader}>
                    <h2>Fixed Code</h2>
                    <button style={styles.copyBtn} onClick={copyFixedCode}>
                      Copy
                    </button>
                  </div>
                  <pre style={styles.pre}>{result.fixed_code}</pre>
                </div>

                <div style={styles.card}>
                  <h2>Output After Fix</h2>
                  <pre style={styles.pre}>
                    {result.fixed_output || result.fixed_error || "No output"}
                  </pre>
                </div>

                <div style={styles.card}>
                  <h2>Agent Report</h2>
                  <p>
                    <b>Agent:</b> {result.agent_type}
                  </p>
                  <p>
                    <b>Attempts:</b> {result.attempts || 1}
                  </p>

                  <h3>Execution Steps</h3>
                  <ol style={styles.steps}>
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
            <section style={styles.hero}>
              <div>
                <div style={styles.badge}>SAVED RUNS</div>
                <h1 style={styles.heroTitle}>Debug History</h1>
                <p style={styles.heroText}>
                  View previous errors, fixes, outputs, and agent attempts.
                </p>
              </div>
            </section>

            {history.length === 0 && <p style={styles.empty}>No history found.</p>}

            {history.map((item) => (
              <div style={styles.historyCard} key={item.id}>
                <p>
                  <b>Date:</b> {item.created_at}
                </p>
                <p>
                  <b>Agent:</b> {item.agent_type}
                </p>
                <p>
                  <b>Attempts:</b> {item.attempts}
                </p>

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
    background:
      "radial-gradient(circle at top, #1e3a8a 0%, #020617 45%, #020617 100%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "white",
  },
  authCard: {
    width: "430px",
    background: "rgba(15, 23, 42, 0.85)",
    padding: "38px",
    borderRadius: "24px",
    textAlign: "center",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
    backdropFilter: "blur(12px)",
  },
  badge: {
    display: "inline-block",
    padding: "7px 12px",
    borderRadius: "999px",
    background: "rgba(34,197,94,0.12)",
    color: "#22c55e",
    border: "1px solid rgba(34,197,94,0.35)",
    fontSize: "12px",
    fontWeight: "bold",
    letterSpacing: "0.8px",
    marginBottom: "12px",
  },
  logo: {
    fontSize: "42px",
    margin: "5px 0",
  },
  subtitle: {
    color: "#94a3b8",
    marginBottom: "24px",
    lineHeight: "1.6",
  },
  input: {
    width: "92%",
    padding: "14px",
    margin: "10px 0",
    borderRadius: "12px",
    border: "1px solid #334155",
    background: "#020617",
    color: "white",
    outline: "none",
  },
  authActions: {
    marginTop: "15px",
  },
  primaryBtn: {
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    color: "white",
    border: "none",
    padding: "12px 22px",
    margin: "8px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  secondaryBtn: {
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    color: "white",
    border: "none",
    padding: "12px 22px",
    margin: "8px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  app: {
    display: "flex",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, #1e3a8a 0%, #0f172a 35%, #020617 100%)",
    color: "white",
  },
  sidebar: {
    width: "245px",
    background: "rgba(2, 6, 23, 0.9)",
    padding: "26px",
    borderRight: "1px solid rgba(148,163,184,0.18)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  sideLogo: {
    marginBottom: "5px",
  },
  small: {
    color: "#94a3b8",
    fontSize: "14px",
  },
  nav: {
    marginTop: "30px",
  },
  navBtn: {
    width: "100%",
    padding: "13px",
    marginTop: "12px",
    background: "rgba(30,41,59,0.8)",
    color: "white",
    border: "1px solid #334155",
    borderRadius: "12px",
    cursor: "pointer",
    textAlign: "left",
  },
  activeNavBtn: {
    width: "100%",
    padding: "13px",
    marginTop: "12px",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "white",
    border: "1px solid #60a5fa",
    borderRadius: "12px",
    cursor: "pointer",
    textAlign: "left",
  },
  logoutBtn: {
    width: "100%",
    padding: "13px",
    background: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  main: {
    flex: 1,
    padding: "36px",
    overflowY: "auto",
  },
  hero: {
    background: "rgba(15, 23, 42, 0.72)",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: "24px",
    padding: "28px",
    marginBottom: "24px",
    display: "flex",
    justifyContent: "space-between",
    gap: "25px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  },
  heroTitle: {
    fontSize: "38px",
    margin: "8px 0",
  },
  heroText: {
    maxWidth: "720px",
    color: "#cbd5e1",
    lineHeight: "1.7",
  },
  statsRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },
  statCard: {
    minWidth: "120px",
    background: "#020617",
    border: "1px solid #334155",
    padding: "15px",
    borderRadius: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "#cbd5e1",
  },
  editorPanel: {
    background: "rgba(15, 23, 42, 0.72)",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: "24px",
    padding: "24px",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  textarea: {
    width: "100%",
    height: "290px",
    background: "#020617",
    color: "#22c55e",
    border: "1px solid #334155",
    borderRadius: "16px",
    padding: "18px",
    fontFamily: "monospace",
    fontSize: "15px",
    boxSizing: "border-box",
  },
  loadingBox: {
    marginTop: "20px",
    background: "rgba(34,197,94,0.1)",
    padding: "16px",
    borderRadius: "14px",
    color: "#22c55e",
    border: "1px solid rgba(34,197,94,0.28)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "22px",
    marginTop: "25px",
  },
  card: {
    background: "rgba(15, 23, 42, 0.78)",
    padding: "22px",
    borderRadius: "22px",
    border: "1px solid rgba(148,163,184,0.22)",
    boxShadow: "0 18px 45px rgba(0,0,0,0.25)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  copyBtn: {
    background: "#334155",
    color: "white",
    border: "1px solid #475569",
    borderRadius: "10px",
    padding: "8px 12px",
    cursor: "pointer",
  },
  pre: {
    background: "#020617",
    color: "#22c55e",
    padding: "15px",
    borderRadius: "14px",
    whiteSpace: "pre-wrap",
    overflowX: "auto",
    lineHeight: "1.6",
  },
  steps: {
    color: "#cbd5e1",
    lineHeight: "1.7",
  },
  historyCard: {
    background: "rgba(15, 23, 42, 0.78)",
    padding: "24px",
    borderRadius: "22px",
    marginTop: "20px",
    border: "1px solid rgba(148,163,184,0.22)",
  },
  empty: {
    color: "#94a3b8",
  },
  toast: {
    position: "fixed",
    top: "20px",
    right: "20px",
    zIndex: 999,
    background: "#020617",
    color: "#22c55e",
    border: "1px solid rgba(34,197,94,0.35)",
    padding: "14px 18px",
    borderRadius: "14px",
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
  },
};

export default App;