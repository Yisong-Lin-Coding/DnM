import React from "react";
import { io } from "socket.io-client";

const DEFAULT_RENDER_URL = "https://dnm-m84a.onrender.com";
const DEFAULT_LOCAL_PORT = 3001;

const parseEnvUrls = () => {
  const raw = process.env.REACT_APP_SOCKET_URLS || process.env.REACT_APP_SOCKET_URL;
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const buildLocalUrl = () => {
  if (typeof window === "undefined") {
    return `http://localhost:${DEFAULT_LOCAL_PORT}`;
  }
  const hostname = window.location.hostname || "localhost";
  return `http://${hostname}:${DEFAULT_LOCAL_PORT}`;
};

const uniqueUrls = (urls) => {
  const seen = new Set();
  return urls.filter((url) => {
    const normalized = String(url || "").trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

export const getSocketUrls = () =>
  uniqueUrls([...parseEnvUrls(), buildLocalUrl(), DEFAULT_RENDER_URL]);

export const createSocket = (url, options = {}) =>
  io(url, {
    transports: ["websocket", "polling"],
    autoConnect: false,
    timeout: 2500,
    ...options,
  });

export const SocketContext = React.createContext(null);
