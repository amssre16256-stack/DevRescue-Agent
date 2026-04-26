import { useState } from "react";

function App() {
  const API = "http://127.0.0.1:8000";

  const [loggedIn, setLoggedIn] = useState(false);
  const [page, setPage] = useState("debug");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [code, setCode] = useState(`name = "Jatin"
print("Hello " + username)`);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!username.trim() || !password.trim()) {
      alert("Please enter username and password");
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

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      alert("Please enter username and password");
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
      setLoggedIn(true);
    } else {
      alert(data.detail || "Login failed");
    }
  };

  const runAgent = async () => {
    setLoading(true);
    setResult(null);

    const token = localStorage.getItem("token");

    const res = await fetch(`${API}/debug?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  const loadHistory = async () => {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API}/history?token=${token}`);
    const data = await res.json();

    setHistory(Array.isArray(data) ? data : []);
    setPage("history");
  };

  const logout = () => {
    localStorage.removeItem("token");
    setLoggedIn(false);
    setResult(null);
    setHistory([]);
  };

  if (!loggedIn) {
    return (
      <div style={styles.authPage}>
        <div style={styles.authCard}>
          <h1 style={styles.logo}>DevRescue AI</h1>
          <p style={styles.subtitle}>Autonomous AI Debugging Agent</p>

          <input
            placeholder="Username"
            style={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            placeholder="Password"
            type="password"
            style={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div>
            <button style={styles.primaryBtn} onClick={handleLogin}>
              Login
            </button>

            <button style={styles.secondaryBtn} onClick={handleSignup}>
              Signup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <h2>DevRescue</h2>
        <button style={styles.navBtn} onClick={() => setPage("debug")}>
          Debug Agent
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
            <h1>🧠 Autonomous Debugging Agent</h1>
            <p style={styles.subtitle}>
              Run → Observe → Fix → Retry → Validate
            </p>

            <textarea
              style={styles.textarea}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />

            <br />

            <button style={styles.primaryBtn} onClick={runAgent}>
              {loading ? "Agent is thinking..." : "Run Debug Agent"}
            </button>

            {loading && (
              <div style={styles.loadingBox}>
                🧠 Agent is executing code, observing error, asking AI, and
                retrying...
              </div>
            )}

            {result && (
              <div style={styles.grid}>
                <section style={styles.panel}>
                  <h2>Original Error</h2>
                  <pre style={styles.pre}>{result.original_error || "No error"}</pre>
                </section>

                <section style={styles.panel}>
                  <h2>Fixed Code</h2>
                  <pre style={styles.pre}>{result.fixed_code}</pre>
                </section>

                <section style={styles.panel}>
                  <h2>Output After Fix</h2>
                  <pre style={styles.pre}>
                    {result.fixed_output || result.fixed_error || "No output"}
                  </pre>
                </section>

                <section style={styles.panel}>
                  <h2>Agent Report</h2>
                  <p>
                    <b>Agent:</b> {result.agent_type}
                  </p>
                  <p>
                    <b>Attempts:</b> {result.attempts || 1}
                  </p>
                  <h3>Agent Steps</h3>
                  <ol>
                    {result.agent_steps?.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </section>
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
                <p>
                  <b>Created:</b> {item.created_at}
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
    background: "linear-gradient(135deg, #020617, #0f172a)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
  },
  authCard: {
    width: "380px",
    backgroundColor: "#1e293b",
    padding: "35px",
    borderRadius: "18px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
    textAlign: "center",
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
    margin: "10px 0",
    borderRadius: "8px",
    border: "1px solid #334155",
  },
  primaryBtn: {
    backgroundColor: "#22c55e",
    border: "none",
    color: "white",
    padding: "12px 22px",
    margin: "10px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  secondaryBtn: {
    backgroundColor: "#3b82f6",
    border: "none",
    color: "white",
    padding: "12px 22px",
    margin: "10px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  app: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    color: "white",
  },
  sidebar: {
    width: "230px",
    backgroundColor: "#020617",
    padding: "25px",
  },
  navBtn: {
    display: "block",
    width: "100%",
    padding: "12px",
    marginTop: "12px",
    backgroundColor: "#1e293b",
    color: "white",
    border: "1px solid #334155",
    borderRadius: "8px",
    cursor: "pointer",
  },
  logoutBtn: {
    display: "block",
    width: "100%",
    padding: "12px",
    marginTop: "30px",
    backgroundColor: "#dc2626",
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
    backgroundColor: "#020617",
    color: "#22c55e",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "18px",
    fontFamily: "monospace",
    fontSize: "15px",
  },
  loadingBox: {
    marginTop: "20px",
    backgroundColor: "#1e293b",
    padding: "15px",
    borderRadius: "12px",
    color: "#22c55e",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginTop: "25px",
  },
  panel: {
    backgroundColor: "#1e293b",
    padding: "20px",
    borderRadius: "14px",
    border: "1px solid #334155",
  },
  pre: {
    backgroundColor: "#020617",
    color: "#22c55e",
    padding: "14px",
    borderRadius: "10px",
    overflowX: "auto",
    whiteSpace: "pre-wrap",
  },
  historyCard: {
    backgroundColor: "#1e293b",
    padding: "22px",
    borderRadius: "14px",
    marginTop: "20px",
    border: "1px solid #334155",
  },
};

export default App;