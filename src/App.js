import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";
import "./App.css";
import AdminPanel from "./components/AdminPanel";

const SOCKET_URL = "https://aplplayerauction.onrender.com/";
const API_URL = "https://aplplayerauction.onrender.com/api";

// Default placeholder image (SVG data URL)
const PLACEHOLDER_IMAGE = `${SOCKET_URL}uploads/placeholder.jpg`;

function App() {
  const [socket, setSocket] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  // Auction state
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [auctionState, setAuctionState] = useState(null);

  // Auto auction state
  const [autoAuctionStatus, setAutoAuctionStatus] = useState({
    isActive: false,
    queueLength: 0,
    unsoldCount: 0,
    totalRemaining: 0,
  });

  // Stats
  const [stats, setStats] = useState({
    totalPlayers: 0,
    soldPlayers: 0,
    unsoldPlayers: 0,
  });

  // Create captain form
  const [captainForm, setCaptainForm] = useState({
    teamName: "",
    captainName: "",
    teamId: "",
    pin: "",
  });

  // Edit modals
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [playerForm, setPlayerForm] = useState({});
  const [teamForm, setTeamForm] = useState({});

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
      loadData(); // Reload data on reconnection
    });

    newSocket.on("auth:success", () => {
      setIsAuthenticated(true);
      loadData();
    });

    newSocket.on("auth:error", (data) => {
      alert(data.message);
      // Clear invalid session
      localStorage.removeItem("admin_authenticated");
      localStorage.removeItem("admin_password");
    });

    newSocket.on("auction:state", (data) => {
      setAuctionState(data.state);
    });

    newSocket.on("teams:status", (data) => {
      setTeams(data.teams);
    });

    // Listen for player sold to update player list and stats
    newSocket.on("player:sold", (data) => {
      // Reload data to get updated player statuses and team info
      loadData();
    });

    // Listen for auction started to update player status
    newSocket.on("auction:started", (data) => {
      // Update the specific player's status
      setPlayers((prev) =>
        prev.map((p) =>
          p._id === data.player._id ? { ...p, status: "IN_AUCTION" } : p,
        ),
      );
    });

    // Listen for bid updates (optional - for real-time bid display)
    newSocket.on("bid:new", (data) => {
      setAuctionState((prev) =>
        prev
          ? {
              ...prev,
              currentHighBid: {
                amount: data.amount,
                team: { teamName: data.teamName },
              },
            }
          : prev,
      );
    });

    // Auto auction events
    newSocket.on("autoAuction:started", (data) => {
      setAutoAuctionStatus((prev) => ({
        ...prev,
        isActive: true,
        queueLength: data.queueLength,
        totalRemaining: data.totalPlayers,
      }));
    });

    newSocket.on("autoAuction:queueUpdate", (data) => {
      setAutoAuctionStatus((prev) => ({
        ...prev,
        queueLength: data.queueLength,
        unsoldCount: data.unsoldCount,
        totalRemaining: data.totalRemaining,
      }));
    });

    newSocket.on("autoAuction:playerUnsold", (data) => {
      setAutoAuctionStatus((prev) => ({
        ...prev,
        unsoldCount: data.unsoldCount,
      }));
    });

    newSocket.on("autoAuction:unsoldRound", (data) => {
      alert(data.message + " (" + data.count + " players)");
    });

    newSocket.on("autoAuction:completed", (data) => {
      alert(data.message);
      setAutoAuctionStatus({
        isActive: false,
        queueLength: 0,
        unsoldCount: 0,
        totalRemaining: 0,
      });
      loadData();
    });

    newSocket.on("autoAuction:stopped", (data) => {
      setAutoAuctionStatus({
        isActive: false,
        queueLength: data.remainingInQueue,
        unsoldCount: data.unsoldCount,
        totalRemaining: data.remainingInQueue + data.unsoldCount,
      });
    });

    newSocket.on("autoAuction:status", (data) => {
      setAutoAuctionStatus(data);
    });

    // Set up periodic data refresh every 10 seconds
    const refreshInterval = setInterval(() => {
      if (isAuthenticated) {
        loadData();
      }
    }, 10000);

    return () => {
      clearInterval(refreshInterval);
      newSocket.close();
    };
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      const [playersRes, teamsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/players`),
        axios.get(`${API_URL}/teams`),
        axios.get(`${API_URL}/auction/stats`),
      ]);

      setPlayers(playersRes.data.players || []);
      setTeams(teamsRes.data.teams || []);
      setStats(statsRes.data.stats || {});
    } catch (error) {
      console.error("Load error:", error);
    }
  };

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
