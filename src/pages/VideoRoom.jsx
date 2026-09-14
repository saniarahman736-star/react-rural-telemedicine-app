import React, { useState, useEffect, useRef } from 'react';
import Peer from 'simple-peer';
import io from 'socket.io-client';
import doctorPlaceholder from '../assets/images/doctor paceholder.jpg';
import { PAGES } from '../constants/pages';
import { useOfflineSync } from '../context/OfflineSyncContext';
const SOCKET_SERVER_URL = 'https://react-rural-telemedicine-app.onrender.com'; 
export default function VideoRoom({ setCurrentPage,role="patient",patientId,appointmentId}) {
  const { isOnline, queueAction, pendingCount } = useOfflineSync();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [activeTab, setActiveTab] = useState(role=== "doctor" ? 'prescription':'chat'); 
  const [liveSpokenText, setLiveSpokenText] = useState('Listening to translated speech output...');
  const [stream, setStream] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [latency, setLatency] = useState(0);
  const [bandwidthMode, setBandwidthMode] = useState('video');
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const socketRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const ROOM_ID = appointmentId
        ? `appointment_${appointmentId}`
        : "appointment_unknown";
  const [messages, setMessages] = useState([
    { sender: 'System', text: 'Secure consultation room active. Audio stream translated live.' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  
  const [prescriptionData, setPrescriptionData] = useState({
    disease: '', diagnosis: '', medicines: '', treatment: '',
    suggestions: '', next_steps: '', notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    // 1. Get Local Media Stream
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }
        // 2. Initialize Socket.io Connection after getting camera
        initializeSocket(currentStream);
      })
      .catch(err => console.error("Failed to access media devices", err));

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (socketRef.current) socketRef.current.disconnect();
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const initializeSocket = (currentStream) => {
    socketRef.current = io(SOCKET_SERVER_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to signaling server via Socket.io');
      const userId=role==="doctor"?"Doctor_ID":"Patient_ID";
      socketRef.current.emit('join-room', ROOM_ID,userId,role);

      // Ping for latency
      pingIntervalRef.current = setInterval(() => {
        socketRef.current.emit('ping-check', { latency: latency });
      }, 2000);
    });

    socketRef.current.on('offer', (data) => {
      console.log('Patient joined, receiving offer...');
      if(role === "patient"){
      handleReceiveCall(data.signal, currentStream);
      }
    });
    socketRef.current.on('answer', (data) => {
      if (connectionRef.current) {
        connectionRef.current.signal(data.signal);
      }
    });

    socketRef.current.on('fallback-instruction', (data) => {
      console.warn(`Bandwidth shift: ${data.mode} - ${data.message}`);
      setBandwidthMode(data.mode);
      if (data.mode === 'audio-only' && currentStream) {
        currentStream.getVideoTracks()[0].enabled = false;
        setIsVideoOff(true);
      }
    });
    socketRef.current.on('patient-connected', () => {
      console.log('Patient joined, initiating WebRTC call...');
      if(role==="doctor"){
        console.log("Doctor initiating ebRTC call...");
      initiateCall(currentStream);
      }
    });
    socketRef.current.on('user-disconnected', () => {
      handleEndCall(false);
    });
    socketRef.current.on('call-ended', () => {
      handleEndCall(false);
    });
  };

  const initiateCall = (currentStream) => {
    console.log("Creating WebRTC peer...");
    const peer = new Peer({ 
      initiator: true, 
      trickle: false, 
      stream: currentStream,
      config:{
        iceServers:[
          {
            urls:
            'stun:stun.l.google.com:19302'
          }
        ]
      } });
    peer.on('signal', (data) => {
      console.log("📧 Doctor sending offer");
      socketRef.current.emit('offer', { signal: data, roomId: ROOM_ID });
    });
    peer.on('stream', (remoteStream) => {
      console.log("Doctor received patient video");
      if (userVideo.current){
         userVideo.current.srcObject = remoteStream;
      }
      setCallAccepted(true);
    });
    peer.on("error",(err)=>{
      console.error("Doctor WebRTC error:",err);
    });
    connectionRef.current = peer;
  };

  const handleReceiveCall = (incomingSignal, currentStream) => {
    setCallAccepted(true);
    const peer = new Peer({ 
      initiator: false, 
      trickle: false, 
      stream: currentStream,
      config:{
        iceServers:[
          { urls:
            'stun:stun.google.com:19302'
          }
        ]
      }});

    peer.on('signal', (data) => {
      socketRef.current.emit('answer', { signal: data, roomId: ROOM_ID });
    });

    peer.on('stream', (remoteStream) => {
      if (userVideo.current) userVideo.current.srcObject = remoteStream;
    });

    peer.signal(incomingSignal);
    connectionRef.current = peer;
  };

  // --- UI Handlers ---

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks()[0].enabled = !stream.getAudioTracks()[0].enabled;
      setIsMuted(!stream.getAudioTracks()[0].enabled);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks()[0].enabled = !stream.getVideoTracks()[0].enabled;
      setIsVideoOff(!stream.getVideoTracks()[0].enabled);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    setMessages((prev) => [...prev, { sender: 'You (Doctor)', text: inputMessage }]);
    setInputMessage('');
    setTimeout(() => {
      setMessages((prev) => [...prev, { sender: 'Patient', text: 'Thank you, doctor.' }]);
    }, 1000);
  };

  const handlePrescriptionChange = (e) => {
    setPrescriptionData({ ...prescriptionData, [e.target.name]: e.target.value });
  };
const handleSubmitPrescription = async (e) => {
  e.preventDefault();

  setSubmitting(true);
  setFormMessage({ type: '', text: '' });

  const payload = {
    ...prescriptionData,
    patient_id: patientId,
    appointment_id:appointmentId,
  };

  console.log("========== PRESCRIPTION DEBUG ==========");
  console.log("patientId:", patientId);
  console.log("prescriptionData:", prescriptionData);
  console.log("payload:", payload);
  console.log("========================================");

  if (!isOnline) {
    queueAction({
      type: 'prescription',
      payload
    });

    setFormMessage({
      type: 'success',
      text: '📥 Offline: Prescription saved locally. It will sync automatically once your connection returns.'
    });

    setSubmitting(false);

    setTimeout(() => handleEndCall(true), 2000);
    return;
  }

  try {
    const token = localStorage.getItem('token');

    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch(
      'https://react-rural-telemedicine-app.onrender.com/api/prescriptions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json().catch(() => ({}));

    console.log("Prescription status:", response.status);
    console.log("Prescription response:", data);

    if (!response.ok) {
      throw new Error(
        data.error || `Prescription request failed (${response.status})`
      );
    }
    await markAppointmentCompleted();
    setFormMessage({
      type: 'success',
      text: 'Prescription saved! Appointment completed.'
    });

    setTimeout(() => handleEndCall(true), 2000);

  } catch (error) {
    console.error("Prescription save error:", error);

    setFormMessage({
      type: 'error',
      text: error.message || 'Error saving prescription.'
    });

  } finally {
    setSubmitting(false);
  }
};
  const markAppointmentCompleted = async () => {
  if (!appointmentId || role !== "doctor") return;

  try {
    const token = localStorage.getItem("token");

    if (!token) {
      console.error("Authentication token not found");
      return;
    }

    const response = await fetch(
      `https://react-rural-telemedicine-app.onrender.com/api/appointments/${appointmentId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: "completed",
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    console.log("Appointment completed:", data);

    if (!response.ok) {
      console.error(
        data.error || "Could not mark appointment as completed"
      );
    }
  } catch (error) {
    console.error("Error completing appointment:", error);
  }
};

  const handleEndCall =async (navigateAway = true) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('end-call', { roomId: ROOM_ID });
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (connectionRef.current) connectionRef.current.destroy();
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (navigateAway && setCurrentPage) {
      setCurrentPage(role === "doctor" ? "doctor-dashboard":"dashboard");
  }
  };
  const simulateSpeechTranslation = () => {
    setLiveSpokenText('🗣️ [Live Translated Voice]: "Please take deep breaths and describe your chest comfort."');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-900 text-white p-4">
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <img src={doctorPlaceholder} alt="Doctor Profile" className="w-10 h-10 rounded-full object-cover border-2 border-green-500 shadow-sm animate-pulse" />
          <div>
            <h2 className="text-lg font-bold text-green-400">Live Consultation Workspace</h2>
            <p className="text-xs text-gray-400 flex items-center gap-2">
                Secure end-to-end encrypted connection
                {latency > 0 && <span className={`px-2 py-0.5 rounded text-[10px] ${latency < 200 ? 'bg-green-900 text-green-300' : latency < 1000 ? 'bg-yellow-900 text-yellow-300' : 'bg-red-900 text-red-300'}`}>Ping: {latency}ms</span>}
                {!isOnline && <span className="px-2 py-0.5 rounded text-[10px] bg-orange-900 text-orange-300 font-bold">📴 Offline</span>}
                {pendingCount > 0 && <span className="px-2 py-0.5 rounded text-[10px] bg-blue-900 text-blue-300 font-bold">📥 {pendingCount} pending sync</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button onClick={() => setIsChatVisible(!isChatVisible)} className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 px-3 py-2 rounded text-sm font-semibold transition-transform transform active:scale-95 shadow-md">
            {isChatVisible ? 'Hide Panel 📝' : 'Show Panel 📝'}
          </button>
          <button onClick={() => handleEndCall(true)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-semibold transition-transform transform active:scale-95 shadow-md">
            End Call
          </button>
        </div>
      </div>
      
      <div className={`flex-1 grid grid-cols-1 ${isChatVisible ? 'md:grid-cols-3' : 'grid-cols-1'} gap-4 pb-4 transition-all duration-300 h-full overflow-hidden`}>
        
        {/* Video Feed Area */}
        <div className={`${isChatVisible ? 'md:col-span-2' : 'col-span-1'} bg-black rounded-lg flex flex-col items-center justify-center relative border border-gray-700 shadow-inner overflow-hidden`}>
          
          <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover absolute inset-0 z-0" />
          
          {(!callAccepted || bandwidthMode === 'audio-only') && (
            <div className="flex flex-col items-center justify-center space-y-2 z-10 absolute inset-0 bg-black/80">
              <div className={`w-24 h-24 rounded-full border-2 flex items-center justify-center ${bandwidthMode === 'audio-only' ? 'bg-yellow-900/40 border-yellow-500' : 'bg-green-900/40 border-green-500 animate-bounce'}`}>
                <span className="text-3xl">{bandwidthMode === 'audio-only' ? '🔉' : '👤'}</span>
              </div>
              <p className={`font-semibold text-sm ${bandwidthMode === 'audio-only' ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {bandwidthMode === 'audio-only' ? 'Audio-Only Mode Active (Low Bandwidth)' : role === "doctor" ?'Waiting for patient connection...':'Waiting for doctor to join...'}
              </p>
            </div>
          )}

          <div className="absolute bottom-4 left-4 w-40 h-32 bg-gray-800 border-2 border-gray-600 rounded-lg overflow-hidden z-20 shadow-lg">
             {isVideoOff ? (
                 <div className="w-full h-full flex items-center justify-center bg-gray-900 text-red-500">📷🚫</div>
             ) : (
                 <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover transform scale-x-[-1]" />
             )}
          </div>

          <div className="absolute top-4 bg-black/70 backdrop-blur px-4 py-2 rounded-lg border border-green-500/50 text-xs text-green-300 font-medium max-w-md text-center cursor-pointer z-20" onClick={simulateSpeechTranslation}>
            {liveSpokenText} <span className="text-[10px] text-gray-400 block underline">(Click to simulate translated speaker audio)</span>
          </div>

          <div className="absolute bottom-4 right-4 flex space-x-2 bg-gray-900/90 backdrop-blur p-2 rounded-lg border border-gray-700 shadow-xl z-20">
            <button onClick={toggleMute} className={`p-2 rounded text-xs font-bold transition-transform transform active:scale-95 ${isMuted ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}>
              {isMuted ? '🔇 Muted' : '🎤 Mute'}
            </button>
            <button onClick={toggleVideo} className={`p-2 rounded text-xs font-bold transition-transform transform active:scale-95 ${isVideoOff ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}>
              {isVideoOff ? '📷 Video Off' : '📹 Video On'}
            </button>
          </div>
        </div>
        
        {/* Sidebar Panel */}
        {isChatVisible && (
          <div className="bg-gray-800 rounded-lg p-4 flex flex-col border border-gray-700 shadow-lg h-full overflow-hidden">
            <div className="flex border-b border-gray-700 pb-2 mb-3 space-x-2 shrink-0">
              {role === "doctor" && (<button onClick={() => setActiveTab('prescription')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-all transform active:scale-95 ${activeTab === 'prescription' ? 'bg-blue-600 text-white shadow' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                📝 E-Prescription
              </button>
              )}
              <button onClick={() => setActiveTab('chat')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-all transform active:scale-95 ${activeTab === 'chat' ? 'bg-green-600 text-white shadow' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                💬 Live Chat
              </button>
            </div>

            {/* CHAT TAB */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-sm">
                  {messages.map((msg, index) => (
                    <div key={index} className={`p-3 rounded-lg ${msg.sender === 'You (Doctor)' ? 'bg-green-900/50 border border-green-700 ml-4' : 'bg-gray-700 mr-4'}`}>
                      <p className="text-xs font-bold text-green-400 mb-1">{msg.sender}</p>
                      <p className="text-gray-200">{msg.text}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendMessage} className="mt-3 pt-3 border-t border-gray-700 flex gap-2 shrink-0">
                  <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} placeholder="Type message or translated text..." className="flex-1 bg-gray-700 border border-gray-600 rounded p-2 text-sm focus:outline-none focus:border-green-500 text-white" />
                  <button type="submit" className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded font-bold text-sm transition-transform transform active:scale-95 shadow">Send</button>
                </form>
              </div>
            )}
            {role === "doctor" && activeTab === 'prescription' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {formMessage.text && (
                  <div className={`p-2 mb-3 rounded text-xs font-bold text-center shrink-0 ${formMessage.type === 'error' ? 'bg-red-900/50 text-red-300 border border-red-700' : 'bg-green-900/50 text-green-300 border border-green-700'}`}>{formMessage.text}</div>
                )}
                <form id="prescription-form" onSubmit={handleSubmitPrescription} className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Disease</label>
                      <input type="text" name="disease" value={prescriptionData.disease} onChange={handlePrescriptionChange} placeholder="e.g. Viral Fever" className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-blue-500" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Diagnosis</label>
                      <input type="text" name="diagnosis" value={prescriptionData.diagnosis} onChange={handlePrescriptionChange} placeholder="Diagnosis" className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Prescribed Medicines 💊</label>
                    <textarea name="medicines" value={prescriptionData.medicines} onChange={handlePrescriptionChange} rows="3" placeholder="1. Paracetamol 650mg - 1-0-1" className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-xs text-white font-mono focus:outline-none focus:border-blue-500" required></textarea>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Treatment Plan</label>
                    <textarea name="treatment" value={prescriptionData.treatment} onChange={handlePrescriptionChange} rows="2" placeholder="Drink plenty of fluids." className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-blue-500"></textarea>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Suggestions</label>
                      <input type="text" name="suggestions" value={prescriptionData.suggestions} onChange={handlePrescriptionChange} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Next Steps</label>
                      <input type="text" name="next_steps" value={prescriptionData.next_steps} onChange={handlePrescriptionChange} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Internal Notes</label>
                    <input type="text" name="notes" value={prescriptionData.notes} onChange={handlePrescriptionChange} className="w-full p-2 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 focus:outline-none focus:border-blue-500" />
                  </div>
                </form>
                <div className="pt-3 border-t border-gray-700 shrink-0">
                  <button type="submit" form="prescription-form" disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-bold transition-transform transform active:scale-95 shadow disabled:opacity-50">
                    {submitting ? 'Submitting...' : 'Sign & Submit Prescription ✓'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
  }
