import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import patientRoutes from "./routes/patientRoutes.js";
import otpRoutes from "./routes/otpRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import hospitalRoutes from "./routes/hospitalRoutes.js";
import prescriptionRoutes from "./routes/prescriptionRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import medicineRoutes from "./routes/medicineRoutes.js";

dotenv.config();

const app = express();

// Express CORS Setup - Allows requests from any origin (e.g., both localhosts)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());

// API Routes
app.use("/api/patients", patientRoutes);
app.use("/api/auth", otpRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/medicines", medicineRoutes);

// Database Connection
connectDB();

app.get("/", (req, res) => {
  res.send("Rural Telemedicine Backend is running");
});

const server = http.createServer(app);

// Socket.io Setup with open CORS rules for real-time WebRTC signaling
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["*"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("⚡ User connected to Socket server:", socket.id);

  // Unified Room Join (Supports Object or Argument Signature)
  socket.on("join-room", (data, userIdArg, roleArg) => {
    let roomId, userId, role;

    if (typeof data === "object" && data !== null) {
      roomId = data.roomId;
      role = data.role;
      userId = data.userId;
    } else {
      roomId = data;
      userId = userIdArg;
      role = roleArg;
    }

    if (!roomId) return;

    socket.join(roomId);

    const room = io.sockets.adapter.rooms.get(roomId);
    const numberOfUsers = room ? room.size : 0;

    console.log(
      `👤 ${role || "User"} (${userId || socket.id}) joined consultation room: ${roomId}`
    );
    console.log(`🏥 Room ${roomId} currently has ${numberOfUsers} active user(s)`);

    // Notify room of connection status
    socket.to(roomId).emit("user-connected", { socketId: socket.id, role });

    // Handle peer alerts when room contains both doctor and patient
    if (role === "doctor" && numberOfUsers > 1) {
      socket.emit("patient-connected");
    }
    if (role === "patient" && numberOfUsers > 1) {
      socket.to(roomId).emit("patient-connected");
    }
  });

  // Generic Signaling Channel for WebRTC (SDP Offers, Answers, and ICE Candidates)
  socket.on("signal", (data) => {
    if (data.target) {
      io.to(data.target).emit("signal", {
        sender: socket.id,
        signal: data.signal,
      });
    } else if (data.roomId) {
      socket.to(data.roomId).emit("signal", {
        sender: socket.id,
        signal: data.signal,
      });
    }
  });

  // Backward compatibility for separate offer/answer events
  socket.on("offer", (data) => {
    socket.to(data.roomId).emit("offer", {
      signal: data.signal,
      from: socket.id,
    });
  });

  socket.on("answer", (data) => {
    socket.to(data.roomId).emit("answer", {
      signal: data.signal,
      from: socket.id,
    });
  });

  // Dedicated ICE Candidate Handler
  socket.on("ice-candidate", (data) => {
    socket.to(data.roomId).emit("ice-candidate", {
      candidate: data.candidate,
      from: socket.id,
    });
  });

  // Real-time E-Prescription Broadcast to Room
  socket.on("send-prescription", (data) => {
    console.log(`💊 Prescription sent to room: ${data.roomId}`);
    socket.to(data.roomId).emit("receive-prescription", data);
  });

  // Ping/Pong Network Health Check
  socket.on("ping-check", () => {
    socket.emit("pong-check", {
      serverTime: Date.now(),
    });
  });

  // Connection Lifecycle Handling
  socket.on("disconnecting", () => {
    console.log("User disconnecting:", socket.id);
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        socket.to(roomId).emit("user-disconnected", socket.id);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Telemedicine Server running on PORT ${PORT}`);
});