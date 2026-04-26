import { useState } from "react";

function App() {
  const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
    try {
      const res = await fetch(`${API}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      alert(data.message || "Signup done");
    } catch (err) {
      console.error(err);
      alert("Signup failed");
    }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      alert(data.message || "Login success");
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#0b132b",
      }}
    >
      <div
        style={{
          background: "#1c2541",
          padding: "30px",
          borderRadius: "10px",
          width: "300px",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "white" }}>DevRescue AI</h2>
        <p style={{ color: "#aaa" }}>Autonomous AI Debugging Agent</p>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ width: "100%", margin: "10px 0", padding: "8px" }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", margin: "10px 0", padding: "8px" }}
        />

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button
            onClick={handleLogin}
            style={{
              background: "#22c55e",
              border: "none",
              padding: "10px",
              color: "white",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Login
          </button>

          <button
            onClick={handleSignup}
            style={{
              background: "#3b82f6",
              border: "none",
              padding: "10px",
              color: "white",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Signup
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;