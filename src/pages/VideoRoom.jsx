// telemedicine-frontend/src/pages/VideoRoom.jsx
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// Enhanced WebRTC ICE Configuration featuring free Open Relay TURN servers
// Configured across UDP, TCP (Port 80/443), and TLS to bypass strict firewalls
const ICE_SERVERS = {
  iceServers: [
    // Standard Free Public STUN Servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },

    // Free Public TURN Relay Servers (OpenRelay Project by Metered)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

// Replace with your Render Backend URL from .env or default to Render address
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://react-rural-telemed.onrender.com';

export default function VideoRoom({ setCurrentPage, roomId = 'consultation-room-1', userRole = 'doctor' }) {
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [activePanel, setActivePanel] = useState('notes');
  const [isConnected, setIsConnected] = useState(false);

  // References for Media and Connection
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);

  // Mock Patient Data
  const patient = {
    id: 'P-9482',
    name: 'Ananya Sharma',
    age: 34,
    gender: 'Female',
    condition: 'Acute Bronchitis / Asthmatic Flare-up',
    vitals: { bp: '128/82 mmHg', hr: '94 bpm', spo2: '96%', temp: '99.2 °F' },
    allergies: ['Penicillin', 'Sulfonamides']
  };

  const [messages, setMessages] = useState([
    { sender: 'system', text: 'Room connected. Waiting for peer...', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState(
    'Chief Complaint: Acute chest tightness and dry cough.\nAssessment: Mild asthmatic flare-up triggered by seasonal dust.\nPlan: Prescribe bronchodilator inhaler and monitor vitals for 48 hours.'
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // 1. Initialize Socket Connection
    socketRef.current = io(BACKEND_URL, { transports: ['websocket'] });

    // 2. Initialize Camera and Microphone
    async function setupMediaDevices() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 3. Join Signaling Room
        socketRef.current.emit('join-room', { roomId, role: userRole });
      } catch (err) {
        console.error('Error accessing camera/microphone:', err);
        alert('Could not access camera/microphone. Please ensure permissions are granted and HTTPS/localhost is used.');
      }
    }

    setupMediaDevices();

    // 4. Socket Listeners for WebRTC Signaling
    socketRef.current.on('user-connected', async ({ socketId }) => {
      console.log('Peer connected:', socketId);
      setIsConnected(true);
      createPeerConnection(socketId, true);
    });

    socketRef.current.on('signal', async ({ sender, signal }) => {
      if (!peerConnectionRef.current) {
        createPeerConnection(sender, false);
      }

      const pc = peerConnectionRef.current;
      try {
        if (signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketRef.current.emit('signal', { target: sender, signal: { sdp: pc.localDescription } });
          }
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error('Error handling WebRTC signal:', err);
      }
    });

    socketRef.current.on('receive-message', (data) => {
      setMessages(prev => [...prev, data]);
    });

    socketRef.current.on('user-disconnected', () => {
      setIsConnected(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    });

    return () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      peerConnectionRef.current?.close();
      socketRef.current?.disconnect();
    };
  }, [roomId, userRole]);

  // Create WebRTC Peer Connection
  const createPeerConnection = (targetSocketId, isInitiator) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    // Add Local Tracks to Peer Connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle Remote Track Received
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Send ICE Candidates via Signaling Server
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('signal', {
          target: targetSocketId,
          signal: { candidate: event.candidate }
        });
      }
    };

    // Monitor Connection State
    pc.oniceconnectionstatechange = () => {
      console.log('ICE Connection State:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setIsConnected(false);
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setIsConnected(true);
      }
    };

    // If caller, create SDP Offer
    if (isInitiator) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        socketRef.current.emit('signal', {
          target: targetSocketId,
          signal: { sdp: offer }
        });
      }).catch(err => console.error('Error creating SDP Offer:', err));
    }
  };

  // Toggle Mute Audio
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  // Toggle Video On/Off
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  // Chat Submission
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const msgData = {
      sender: userRole,
      text: inputMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    socketRef.current.emit('send-message', msgData);
    setInputMessage('');
  };

  const endCall = () => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    peerConnectionRef.current?.close();
    socketRef.current?.disconnect();
    if (setCurrentPage) setCurrentPage('dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <div className="flex-1 flex flex-col lg:flex-row h-screen overflow-hidden">
        
        {/* Main Video Viewport */}
        <div className="flex-1 flex flex-col bg-slate-900 border-r border-slate-800 relative">
          <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-slate-950/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 shadow-lg">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <span className="text-xs font-bold text-white">{patient.name}</span>
            <span className="text-xs text-slate-400 border-l border-slate-700 pl-3">
              {isConnected ? 'Connected' : 'Waiting for Peer...'}
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative">
            <div className="w-full h-full max-h-[75vh] bg-slate-950 rounded-3xl border border-slate-800 relative overflow-hidden flex items-center justify-center shadow-2xl">
              
              {/* Remote Video Stream */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Local Self-View Stream Overlay */}
              <div className="absolute bottom-6 right-6 w-36 sm:w-48 h-24 sm:h-32 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex items-center justify-center">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${!isVideoOn && 'hidden'}`}
                />
                {!isVideoOn && <span className="text-[10px] text-slate-500 font-bold">Camera Off</span>}
              </div>
            </div>
          </div>

          {/* Call Controls */}
          <div className="h-20 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 px-6 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <button 
                onClick={toggleMic}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                  isMicOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-600 text-white shadow-lg'
                }`}
              >
                {isMicOn ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="1" y1="1" x2="23" y2="23"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 10-5.94-.6M17 16.95A7 7 0 015 11v-1m14 1v1a7 7 0 01-.36 2.15M12 19v4m-4 0h8"/></svg>
                )}
              </button>

              <button 
                onClick={toggleVideo}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                  isVideoOn ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-600 text-white shadow-lg'
                }`}
              >
                {isVideoOn ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 2H14a2 2 0 012 2v3.34l1.553-1.276A1 1 0 0119 12.618v2.764m-4-6.382L4 16m15-10l-4 4"/></svg>
                )}
              </button>
            </div>

            <button 
              onClick={endCall}
              className="flex items-center gap-2 px-6 h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
            >
              <span>End Consultation</span>
            </button>
          </div>
        </div>

        {/* Control Sidebar */}
        <div className="w-full lg:w-[420px] bg-slate-900 flex flex-col border-t lg:border-t-0 border-slate-800">
          <div className="grid grid-cols-3 p-2 bg-slate-950 border-b border-slate-800 gap-1">
            <button onClick={() => setActivePanel('notes')} className={`py-2 px-2 rounded-xl text-xs font-bold cursor-pointer ${activePanel === 'notes' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Notes</button>
            <button onClick={() => setActivePanel('chat')} className={`py-2 px-2 rounded-xl text-xs font-bold cursor-pointer ${activePanel === 'chat' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Chat</button>
            <button onClick={() => setActivePanel('records')} className={`py-2 px-2 rounded-xl text-xs font-bold cursor-pointer ${activePanel === 'records' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Vitals</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {activePanel === 'notes' && (
              <textarea 
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                className="w-full h-48 bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-200 focus:outline-none font-mono"
              />
            )}

            {activePanel === 'records' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-400 mb-2">Patient Vitals</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-slate-500">BP:</span> {patient.vitals.bp}</div>
                    <div><span className="text-slate-500">HR:</span> {patient.vitals.hr}</div>
                    <div><span className="text-slate-500">SpO2:</span> {patient.spo2 || patient.vitals.spo2}</div>
                    <div><span className="text-slate-500">Temp:</span> {patient.vitals.temp}</div>
                  </div>
                </div>
              </div>
            )}

            {activePanel === 'chat' && (
              <div className="flex flex-col flex-1 h-[400px]">
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-3">
                  {messages.map((msg, index) => (
                    <div key={index} className={`flex flex-col ${msg.sender === userRole ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-xs ${msg.sender === userRole ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1">{msg.time}</span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input 
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type message..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                  />
                  <button type="submit" className="w-10 h-10 bg-blue-600 text-white rounded-xl">Send</button>
                </form>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
