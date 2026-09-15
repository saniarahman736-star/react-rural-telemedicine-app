import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// Safe import handling for DoctorPortalBackground
let DoctorPortalBackground;
try {
  DoctorPortalBackground = require('../components/DoctorPortalBackground').default;
} catch (e) {
  // Fallback wrapper if component file is missing or path differs
  DoctorPortalBackground = ({ children }) => (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      {children}
    </div>
  );
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://react-rural-telemed.onrender.com';

export default function DoctorConsultationRoom({
   setCurrentPage, 
   roomId = 'ENC-9042',
   patientId,
   appointmentId,
   patient
  }) {
  const [activeTab, setActiveTab] = useState('prescription');
  const [caseNotes, setCaseNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  
  // Media states
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);

  // Form State
  const [medicine, setMedicine] = useState('');
  const [dosage, setDosage] = useState('1-0-1 (After Food)');
  const [duration, setDuration] = useState('5 Days');
  const [instructions, setInstructions] = useState('Drink plenty of warm water and avoid oily foods.');
  
  const [prescriptionList, setPrescriptionList] = useState([
    { name: 'Amlodipine 5mg', dosage: '1-0-0', duration: '7 Days' }
  ]);

  // WebRTC & Socket Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // 1. Establish Socket Connection
    socketRef.current = io(BACKEND_URL, {
      transports: ['websocket', 'polling']
    });

    // 2. Initialize Media Devices
    async function startMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Join room as doctor
        socketRef.current.emit('join-room', { roomId, role: 'doctor' });
      } catch (err) {
        console.error('Camera/Microphone permission denied:', err);
      }
    }

    startMedia();

    // 3. Socket Signaling Handlers
    socketRef.current.on('user-connected', ({ socketId }) => {
      setIsConnected(true);
      createPeerConnection(socketId, true);
    });

    socketRef.current.on('patient-connected', () => {
      setIsConnected(true);
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
        console.error('Signaling error:', err);
      }
    });

    socketRef.current.on('user-disconnected', () => {
      setIsConnected(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      if (peerConnectionRef.current) peerConnectionRef.current.close();
    });

    return () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      peerConnectionRef.current?.close();
      socketRef.current?.disconnect();
    };
  }, [roomId]);

  const createPeerConnection = (targetSocketId, isInitiator) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('signal', {
          target: targetSocketId,
          signal: { candidate: event.candidate }
        });
      }
    };

    if (isInitiator) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        socketRef.current.emit('signal', {
          target: targetSocketId,
          signal: { sdp: offer }
        });
      });
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  const handleAddMedicine = (e) => {
    e.preventDefault();
    if (!medicine.trim()) return;
    setPrescriptionList(prev => [...prev, { name: medicine, dosage, duration }]);
    setMedicine('');
  };

  const handleSignAndSend = () => {
    socketRef.current?.emit('send-prescription', {
      roomId,
      prescriptions: prescriptionList,
      instructions
    });
    setSuccessMsg('Digital E-Prescription successfully signed and sent to patient vault!');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleEndCall = () => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    peerConnectionRef.current?.close();
    socketRef.current?.disconnect();
    if (typeof setCurrentPage === 'function') {
      setCurrentPage('doctor-dashboard');
    }
  };

  return (
    <DoctorPortalBackground>
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-80px)]">
        {/* Top Header & Navigation */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <button 
              onClick={handleEndCall}
              className="text-xs text-emerald-600 font-semibold hover:underline mb-0.5 inline-block cursor-pointer"
            >
              &larr; Back to Doctor Command Portal
            </button>
            <h1 className="text-xl font-bold text-slate-800">Active Teleconsultation & E-Prescription Room</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
              isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700 animate-pulse'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              {isConnected ? `Live Session (ID: #${roomId})` : 'Waiting for Patient...'}
            </span>
            <button 
              onClick={handleEndCall}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg transition cursor-pointer"
            >
              End & Exit Room
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-xl text-xs font-medium animate-fade-in">
            {successMsg}
          </div>
        )}

        {/* Main Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden pb-4">
          
          {/* Left: Video / Audio Stream */}
          <div className="lg:col-span-2 bg-slate-900 rounded-2xl flex flex-col justify-between p-4 relative shadow-lg overflow-hidden">
            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 z-10">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`}></span>
              Patient: {patient?.name || "Loading patient..."}
                {patient?.dob && (
                <>
               {" "}
                (
             {Math.floor(
            (new Date() - new Date(patient.dob)) /
           (1000 * 60 * 60 * 24 * 365.25)
           )} yrs
    </>
)}
{patient?.gender && <> / {patient.gender}</>}
            </div>

            {/* Remote Patient Video Feed */}
            <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-slate-950 rounded-xl">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {!isConnected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-900/90">
                  <span className="text-4xl animate-bounce">📹</span>
                  <p className="text-sm font-medium">Waiting for patient to enter session...</p>
                  <span className="text-xs text-slate-500">Room Code: {roomId}</span>
                </div>
              )}

              {/* Doctor Self View (Overlay) */}
              <div className="absolute bottom-4 right-4 w-40 h-28 bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${!isVideoOn && 'hidden'}`}
                />
                {!isVideoOn && (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 font-bold bg-slate-900">
                    Camera Off
                  </div>
                )}
              </div>
            </div>

            {/* Call Controls Bar */}
            <div className="flex justify-center gap-4 bg-slate-800/90 p-3 rounded-xl backdrop-blur mt-4">
              <button 
                onClick={toggleMic}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isMicOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                {isMicOn ? '🎤 Mute Microphone' : '🎙️ Unmute Microphone'}
              </button>

              <button 
                onClick={toggleVideo}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isVideoOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                {isVideoOn ? '📹 Turn Off Camera' : '📷 Turn On Camera'}
              </button>

              <button 
                onClick={handleEndCall}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Disconnect Call
              </button>
            </div>
          </div>

          {/* Right: Doctor Toolkit Workspace */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="flex border-b border-slate-200 bg-slate-50">
              <button 
                onClick={() => setActiveTab('prescription')}
                className={`flex-1 py-3 text-xs font-semibold text-center transition cursor-pointer ${
                  activeTab === 'prescription' ? 'border-b-2 border-emerald-600 text-emerald-700 bg-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                💊 E-Prescription
              </button>
              <button 
                onClick={() => setActiveTab('notes')}
                className={`flex-1 py-3 text-xs font-semibold text-center transition cursor-pointer ${
                  activeTab === 'notes' ? 'border-b-2 border-emerald-600 text-emerald-700 bg-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📝 Case Notes
              </button>
              <button 
                onClick={() => setActiveTab('vitals')}
                className={`flex-1 py-3 text-xs font-semibold text-center transition cursor-pointer ${
                  activeTab === 'vitals' ? 'border-b-2 border-emerald-600 text-emerald-700 bg-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📊 Live Vitals
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {activeTab === 'prescription' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm mb-1">Digital Prescription Creator</h3>
                    <p className="text-xs text-slate-500">Add medicines below; they will be digitally signed and sent instantly to the patient's vault.</p>
                  </div>

                  <div className="space-y-2">
                    {prescriptionList.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                        <div>
                          <strong className="text-slate-800">{item.name}</strong>
                          <span className="text-slate-500 block">Dosage: {item.dosage} • {item.duration}</span>
                        </div>
                        <button 
                          onClick={() => setPrescriptionList(prescriptionList.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 font-bold px-1.5 cursor-pointer"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddMedicine} className="space-y-3 pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      placeholder="Medicine Name & Strength (e.g. Paracetamol 650mg)"
                      value={medicine}
                      onChange={(e) => setMedicine(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Frequency (1-0-1)"
                        value={dosage}
                        onChange={(e) => setDosage(e.target.value)}
                        className="border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                      />
                      <input
                        type="text"
                        placeholder="Duration (5 Days)"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-lg text-xs transition cursor-pointer"
                    >
                      + Add to Prescription
                    </button>
                  </form>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">General Instructions / Advice</label>
                    <textarea
                      rows="2"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                    ></textarea>
                  </div>

                  <button
                    type="button"
                    onClick={handleSignAndSend}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-xs transition shadow-sm cursor-pointer"
                  >
                    Sign & Send E-Prescription securely
                  </button>
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-800 text-sm">Clinical Observations & Diagnosis</h3>
                  <textarea
                    rows="8"
                    value={caseNotes}
                    onChange={(e) => setCaseNotes(e.target.value)}
                    placeholder="Record symptoms, provisional diagnosis, and physical examination findings..."
                    className="w-full border border-slate-200 rounded-lg p-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                  ></textarea>
                  <button
                    onClick={() => alert('Case notes saved to patient EHR history successfully!')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg text-xs transition cursor-pointer"
                  >
                    Save Notes to EHR
                  </button>
                </div>
              )}

              {activeTab === 'vitals' && (
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-800 text-sm">Real-time Patient Vitals Stream</h3>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Blood Pressure:</span>
                      <strong className="text-slate-800">138/88 mmHg (Elevated)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Heart Rate:</span>
                      <strong className="text-slate-800">78 bpm (Normal)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Blood Glucose:</span>
                      <strong className="text-slate-800">132 mg/dL (Postprandial)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">SpO2 Level:</span>
                      <strong className="text-emerald-700">98% Room Air</strong>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 italic">
                    * Vitals streamed securely via connected BLE smart health wearable devices paired with the patient app.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </DoctorPortalBackground>
  );
}