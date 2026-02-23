import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import "./App.css";
import AdminPanel from "./components/AdminPanel";

// const SOCKET_URL = "https://aplplayerauction.onrender.com/";
const SOCKET_URL = "http://localhost:5001/";

function App() {
  const [socket, setSocket] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
    setSocket(newSocket);

    // Check for saved admin session
    const savedAdminAuth = localStorage.getItem("admin_authenticated");
    const savedPassword = localStorage.getItem("admin_password");

    if (savedAdminAuth === "true" && savedPassword) {
      setPassword(savedPassword);
      // Auto-login with saved credentials
      newSocket.emit("admin:login", { password: savedPassword });
    }

    // Handle connection events
    newSocket.on("connect", () => {
      console.log("Admin panel connected");
      if (savedAdminAuth === "true" && savedPassword) {
        newSocket.emit("admin:login", { password: savedPassword });
      }
    });

    newSocket.on("disconnect", () => {
      console.log("Admin panel disconnected");
    });

    newSocket.on("reconnect", () => {
      console.log("Admin panel reconnected");
      if (savedAdminAuth === "true" && savedPassword) {
        newSocket.emit("admin:login", { password: savedPassword });
      }
    });

    newSocket.on("auth:success", () => {
      setIsAuthenticated(true);
    });

    newSocket.on("auth:error", (data) => {
      alert(data.message);
      // Clear invalid session
      localStorage.removeItem("admin_authenticated");
      localStorage.removeItem("admin_password");
    });

    return () => {
      newSocket.close();
    };
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (socket) {
      socket.emit("admin:login", { password });
      // Save credentials on successful manual login
      socket.once("auth:success", () => {
        localStorage.setItem("admin_authenticated", "true");
        localStorage.setItem("admin_password", password);
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="app">
        <div className="admin-login">
          <div className="login-card">
            <h1>🔐 Admin Panel</h1>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin Password"
                required
              />
              <button type="submit">Login</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AdminPanel />
    </>
  );
}

export default App;
