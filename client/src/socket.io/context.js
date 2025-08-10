import React from 'react';
import { io } from "socket.io-client";

export const socket = io("https://dnm-m84a.onrender.com");
export const SocketContext = React.createContext(socket);