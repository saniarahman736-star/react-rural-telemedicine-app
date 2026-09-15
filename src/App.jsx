import { useState } from 'react';
import { PAGES } from './constants/pages';
import './index.css';
import './App.css';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import OfflineBanner from './components/OfflineBanner';

import RoleSelect from './pages/RoleSelect';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import VideoRoom from './pages/VideoRoom';
import DoctorConsultationRoom from './pages/DoctorConsultationRoom';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';
import EmergencyDonation from './pages/EmergencyDonation';
import CareReminders from './pages/CareReminders';
import DiagnosticRouter from './pages/DiagnosticRouter';
import ProfileFamily from './pages/ProfileFamily';
import DoctorWorkspace from './pages/DoctorWorkspace';
import EmergencyAdmissionDashboard from './pages/EmergencyAdmissionDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import PatientRecordsDashboard from './pages/PatientRecordsDashboard';
import FindDoctor from './pages/FindDoctor';
import DoctorRegister from './pages/DoctorRegister';
import MedicineOrder from './pages/MedicineOrder';
import DoctorProfileEdit from './pages/DoctorProfileEdit';
import NearbyCareFinder from './pages/NearbyCareFinder';
import HospitalFinder from './pages/HospitalFinder';
import MyOrders from "./pages/MyOrders";
import EmergencySOS from './pages/EmergencySOS';
import MedicalVault from './pages/MedicalVault';
import LanguageTranslator from './pages/LanguageTranslator';
import OfflineSyncManager from './pages/OfflineSyncManager';
import AdminAnalyticsDashboard from './pages/AdminAnalyticsDashboard';
import DoctorStatusControl from './pages/DoctorStatusControl';
import HospitalLogin from './pages/HospitalLogin';
import HospitalRegister from './pages/HospitalRegister';
import HospitalPortal from './pages/HospitalPortal';

export default function App() {

  const [currentPage, setCurrentPage] = useState('role-select');

  const [selectedPatientId, setSelectedPatientId] = useState(null);
  
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);

  // ADD THIS
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Active Teleconsultation Room Identifier
  const activeRoomId = selectedAppointmentId
    ? `ENC-${selectedAppointmentId}`
    : 'ENC-9042';

  // -----------------------------------------
  // SIGN OUT
  // -----------------------------------------
  const handleSignOut = () => {
    setIsLoggedIn(false);

    // Clear selected doctor/patient appointment data
    setSelectedPatientId(null);
    setSelectedAppointmentId(null);

    // Clear selected patient
    setSelectedPatient(null);

    // Go back to role selection
    setCurrentPage('role-select');
  };

  const renderPage = () => {

    switch (currentPage) {

      case 'role-select':
        return (
          <RoleSelect
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.LOGIN:
        return (
          <Login
            setCurrentPage={setCurrentPage}
            onLoginSuccess={() => {
              setIsLoggedIn(true);
              setCurrentPage(PAGES.DASHBOARD);
            }}
          />
        );

      case 'login-doctor':
        return (
          <Login
            setCurrentPage={setCurrentPage}
            roleHint="doctor"
            onLoginSuccess={() => {
              setIsLoggedIn(true);
              setCurrentPage('doctor-dashboard');
            }}
          />
        );

      case PAGES.REGISTER:
        return (
          <Register
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.DASHBOARD:
        return (
          <Dashboard
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.APPOINTMENTS:
        return (
          <Appointments
            setCurrentPage={setCurrentPage}
          />
        );

      // -----------------------------------------
      // TELECONSULTATION & VIDEO ROOMS
      // -----------------------------------------

      case 'doctor-consultation':
      case 'doctor-video':
        return (
          <DoctorConsultationRoom
            setCurrentPage={setCurrentPage}
            roomId={activeRoomId}
            patientId={selectedPatientId}
            appointmentId={selectedAppointmentId}
            patient={selectedPatient}
          />
        );

      case 'patient-video':
        return (
          <VideoRoom
            setCurrentPage={setCurrentPage}
            role="patient"
            roomId={activeRoomId}
          />
        );

      case PAGES.PROFILE:
        return (
          <Profile
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.EMERGENCY_DONATION:
        return (
          <EmergencyDonation
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.DIAGNOSTIC_ROUTER:
        return (
          <DiagnosticRouter
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.FAMILY_PROFILE:
        return (
          <ProfileFamily
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.DOCTOR_PROFILE:
        return (
          <DoctorWorkspace
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.REMINDERS:
        return (
          <CareReminders
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.EMERGENCY_ADMISSION:
        return (
          <EmergencyAdmissionDashboard
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.DOCTOR_DASHBOARD:
      case 'doctor-dashboard':
        return (
          <DoctorDashboard
            setCurrentPage={setCurrentPage}
            setSelectedPatientId={setSelectedPatientId}
            setSelectedAppointmentId={setSelectedAppointmentId}

            // ADD THIS
            setSelectedPatient={setSelectedPatient}

            setIsLoggedIn={setIsLoggedIn}
            onSignOut={handleSignOut}
          />
        );

      case PAGES.FIND_DOCTOR:
        return (
          <FindDoctor
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.DOCTOR_REGISTER:
        return (
          <DoctorRegister
            setCurrentPage={setCurrentPage}
          />
        );

      case 'records-dashboard':
      case PAGES.RECORDS_DASHBOARD:
        return (
          <PatientRecordsDashboard
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.MEDICINE_ORDER:
      case 'medicine-ordering':
        return (
          <MedicineOrder
            setCurrentPage={setCurrentPage}
          />
        );

      case 'my-orders':
        return (
          <MyOrders
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.DOCTOR_PROFILE_EDIT:
        return (
          <DoctorProfileEdit
            setCurrentPage={setCurrentPage}
          />
        );

      case 'nearby-care-finder':
        return (
          <NearbyCareFinder
            setCurrentPage={setCurrentPage}
          />
        );

      case 'hospital-finder':
        return (
          <HospitalFinder
            setCurrentPage={setCurrentPage}
          />
        );

      case 'emergency-sos':
      case PAGES.EMERGENCY_SOS:
        return (
          <EmergencySOS
            setCurrentPage={setCurrentPage}
          />
        );

      case 'medical-vault':
      case PAGES.MEDICAL_VAULT:
        return (
          <MedicalVault
            setCurrentPage={setCurrentPage}
          />
        );

      case 'language-translator':
      case PAGES.LANGUAGE_TRANSLATOR:
        return (
          <LanguageTranslator
            setCurrentPage={setCurrentPage}
          />
        );

      case 'offline-sync':
        return (
          <OfflineSyncManager
            setCurrentPage={setCurrentPage}
          />
        );

      case 'admin-analytics':
        return (
          <AdminAnalyticsDashboard
            setCurrentPage={setCurrentPage}
          />
        );

      case 'doctor-status-control':
        return (
          <DoctorStatusControl
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.HOSPITAL_LOGIN:
        return (
          <HospitalLogin
            setCurrentPage={setCurrentPage}
            setIsLoggedIn={setIsLoggedIn}
          />
        );

      case 'hospital-register':
        return (
          <HospitalRegister
            setCurrentPage={setCurrentPage}
          />
        );

      case PAGES.HOSPITAL_PORTAL:
        return (
          <HospitalPortal
            setCurrentPage={setCurrentPage}
            setIsLoggedIn={setIsLoggedIn}
          />
        );

      default:
        return (
          <NotFound
            setCurrentPage={setCurrentPage}
          />
        );
    }
  };

  const showNavbar =
    isLoggedIn &&
    currentPage !== PAGES.HOSPITAL_PORTAL &&
    currentPage !== 'doctor-dashboard';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">

      <OfflineBanner />

      {showNavbar && (
        <Navbar
          setCurrentPage={setCurrentPage}
          setIsLoggedIn={setIsLoggedIn}
        />
      )}

      <main className="flex-1">
        {renderPage()}
      </main>

      <Footer />

    </div>
  );
}