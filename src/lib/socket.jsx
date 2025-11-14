import { io } from "socket.io-client";

const URL = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export const socket = io(URL, {
  path: "/socket.io",
  transports: ["websocket"],
  withCredentials: true,
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on("connect_error", (err) => {
  console.warn("[socket] connect_error:", err.message);
});
