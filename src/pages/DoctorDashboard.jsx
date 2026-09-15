import React, { useEffect, useState } from 'react';
import api from "../constants/api.js";

export default function DoctorDashboard({
  setCurrentPage,
  setSelectedPatientId,
  setSelectedAppointmentId,
  setSelectedPatient,
  setIsLoggedIn,
  onSignOut
}) {
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [appointmentError, setAppointmentError] = useState("");

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        setLoadingAppointments(true);

        const res = await api.get("/appointments/doctor");

        console.log("Doctor appointments:", res.data);

        setAppointments(
          Array.isArray(res.data)
            ? res.data
            : res.data.appointments || []
        );

      } catch (error) {
        console.error("Error loading appointments:", error);

        setAppointmentError(
          error.response?.data?.error ||
          "Could not load appointments"
        );

      } finally {
        setLoadingAppointments(false);
      }
    };

    fetchAppointments();
  }, []);

  const triageAppointments = appointments.filter(
    (appointment) => appointment.status === "confirmed"
  );

  const handleSignOut = () => {
    if (typeof onSignOut === 'function') {
      onSignOut();
    } else {
      if (setIsLoggedIn) setIsLoggedIn(false);
      setCurrentPage('role-select');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-800">

      {/* Doctor Portal Header */}
      <header className="bg-[#0f766e] text-white shadow-md w-full sticky top-0 z-50">

        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

          <div
            onClick={() => setCurrentPage('doctor-dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >

            <div className="w-11 h-11 rounded-2xl bg-teal-900/60 border border-teal-500/40 flex items-center justify-center shadow-inner">
              <span className="text-xl">🩺</span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-black tracking-tight text-white">
                  GraminSwasthya
                </h1>

                <span className="text-amber-300 font-bold text-lg">
                  Portal
                </span>
              </div>

              <p className="text-[11px] text-teal-100 font-medium tracking-wide">
                Doctor Command & Telemedicine Center
              </p>
            </div>

          </div>

          <div className="flex items-center gap-4">

            <button
              onClick={() => {
                const activeAppointment = appointments.find(
                  (appointment) => appointment.status === "confirmed"
                );

                if (!activeAppointment) {
                  return;
                }

                setSelectedPatientId(
                  activeAppointment.patient_id?._id
                );

                setSelectedPatient(
                  activeAppointment.patient_id
                );

                setSelectedAppointmentId(
                  activeAppointment._id
                );

                setCurrentPage("doctor-video");
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer border border-emerald-400"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              Join Active Consultation
            </button>

            {/* User Profile Info & Sign Out */}

            <div className="flex items-center gap-3 pl-4 border-l border-teal-700/80">

              <div className="text-right hidden sm:block">

                <span className="block text-xs font-bold text-white">
                  Dr. Subhankar Chatterjee
                </span>

                <span className="block text-[10px] text-teal-200">
                  Senior Medical Officer
                </span>

              </div>

              <div className="flex items-center gap-2">

                <div className="w-10 h-10 rounded-full bg-teal-900 border border-teal-500/50 text-teal-200 font-black text-xs flex items-center justify-center shadow-sm">
                  SC
                </div>

                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="bg-teal-950/60 hover:bg-rose-600 text-teal-200 hover:text-white p-2.5 rounded-xl transition border border-teal-600 hover:border-rose-500 flex items-center justify-center cursor-pointer shadow-sm"
                >

                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>

                </button>

              </div>

            </div>

          </div>

        </div>

      </header>

      {/* Main Dashboard Body */}

      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">

        {/* Quick Metrics */}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

          <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-slate-200/80">
            <span className="text-xs text-slate-500 font-semibold uppercase">
              Pending Triage
            </span>

            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              6 Patients
            </h3>

            <span className="text-[11px] text-amber-600 font-medium mt-1 inline-block">
              Requires review
            </span>
          </div>

          <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-slate-200/80">
            <span className="text-xs text-slate-500 font-semibold uppercase">
              Completed Today
            </span>

            <h3 className="text-2xl font-bold text-emerald-600 mt-1">
              12 Sessions
            </h3>

            <span className="text-[11px] text-slate-400 mt-1 inline-block">
              +3 more than yesterday
            </span>
          </div>

          <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-slate-200/80">
            <span className="text-xs text-slate-500 font-semibold uppercase">
              Monthly Earnings
            </span>

            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              ₹18,400
            </h3>

            <span className="text-[11px] text-emerald-600 font-medium mt-1 inline-block">
              Payout ready
            </span>
          </div>

          <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-slate-200/80">
            <span className="text-xs text-slate-500 font-semibold uppercase">
              Zone Risk Alert
            </span>

            <h3 className="text-xl font-bold text-amber-600 mt-1">
              Moderate (South)
            </h3>

            <span className="text-[11px] text-slate-400 mt-1 inline-block">
              Viral fever spike
            </span>
          </div>

        </div>

        {/* Clinical Portal Modules */}

        <div>

          <h2 className="font-bold text-slate-900 text-base mb-4 drop-shadow-sm">
            Clinical Portal Modules
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            <div
              onClick={() => setCurrentPage('records-dashboard')}
              className="bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-slate-200/80 hover:border-teal-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
            >
              <div>
                <span className="text-2xl mb-2 inline-block">📂</span>

                <h3 className="font-bold text-slate-900 text-sm">
                  Patient Records (EHR)
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Look up medical histories, vital trends, and past prescriptions.
                </p>
              </div>

              <span className="text-xs font-semibold text-teal-600 mt-4 inline-block">
                Open Module &rarr;
              </span>
            </div>

            <div
              onClick={() => setCurrentPage('medical-vault')}
              className="bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-slate-200/80 hover:border-teal-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
            >
              <div>
                <span className="text-2xl mb-2 inline-block">🏥</span>

                <h3 className="font-bold text-slate-900 text-sm">
                  Medical Guidelines
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Access evidence-based clinical protocols and treatment standards.
                </p>
              </div>

              <span className="text-xs font-semibold text-teal-600 mt-4 inline-block">
                Open Module &rarr;
              </span>
            </div>

            <div
              onClick={() => setCurrentPage('language-translator')}
              className="bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-slate-200/80 hover:border-teal-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
            >
              <div>
                <span className="text-2xl mb-2 inline-block">🌐</span>

                <h3 className="font-bold text-slate-900 text-sm">
                  Language Translator
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Translate regional symptom descriptions and prescriptions live.
                </p>
              </div>

              <span className="text-xs font-semibold text-teal-600 mt-4 inline-block">
                Open Module &rarr;
              </span>
            </div>

            <div
              onClick={() => setCurrentPage('doctor-status-control')}
              className="bg-white/90 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-slate-200/80 hover:border-teal-500 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
            >
              <div>
                <span className="text-2xl mb-2 inline-block">⚡</span>

                <h3 className="font-bold text-slate-900 text-sm">
                  Doctor Status & Triage
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Control online availability, specialty status, and queue rules.
                </p>
              </div>

              <span className="text-xs font-semibold text-teal-600 mt-4 inline-block">
                Open Module &rarr;
              </span>
            </div>

          </div>

        </div>

        {/* My Appointments */}

        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200/80">

          <div className="flex justify-between items-center mb-5">

            <div>

              <h2 className="font-bold text-slate-900 text-base">
                📅 My Appointments
              </h2>

              <p className="text-xs text-slate-500">
                Patients who have booked appointments with you.
              </p>

            </div>

            <span className="text-xs font-bold bg-teal-100 text-teal-800 px-3 py-1 rounded-full">
              {appointments.length} Appointment
              {appointments.length !== 1 ? "s" : ""}
            </span>

          </div>

          {loadingAppointments && (
            <div className="text-center py-8 text-slate-500 text-sm">
              Loading appointments...
            </div>
          )}

          {appointmentError && (
            <div className="text-center py-8 text-red-500 text-sm">
              {appointmentError}
            </div>
          )}

          {!loadingAppointments &&
            !appointmentError &&
            appointments.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">
                No appointments booked yet.
              </div>
            )}

          {!loadingAppointments &&
            !appointmentError &&
            appointments.length > 0 && (

              <div className="space-y-4">

                {appointments.map((appointment) => (

                  <div
                    key={appointment._id}
                    className="border border-slate-200 rounded-xl p-5 hover:border-teal-300 hover:shadow-sm transition"
                  >

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                      <div>

                        <h3 className="font-bold text-slate-900 text-sm">
                          👤 {appointment.patient_id?.name || "Unknown Patient"}
                        </h3>

                        <p className="text-xs text-slate-500 mt-1">
                          📧 {appointment.patient_id?.email || "No email"}
                        </p>

                        <p className="text-xs text-slate-500 mt-1">
                          📱 {appointment.patient_id?.mobile ||
                            appointment.patient_id?.phone ||
                            "No phone"}
                        </p>

                      </div>

                      <div className="text-sm">

                        <p className="text-slate-700">
                          📅{" "}
                          {new Date(
                            appointment.appointment_date
                          ).toLocaleDateString("en-IN")}
                        </p>

                        <p className="text-slate-700 mt-1">
                          🕐 {appointment.appointment_time}
                        </p>

                        <p className="text-slate-700 mt-1">
                          🎥 {appointment.appointment_type}
                        </p>

                      </div>

                      <div className="flex flex-col items-start md:items-end gap-2">

                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                            appointment.status === "confirmed"
                              ? "bg-emerald-100 text-emerald-700"
                              : appointment.status === "completed"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {appointment.status === "confirmed"
                            ? "Confirmed"
                            : appointment.status === "completed"
                            ? "Completed"
                            : "Cancelled"}
                        </span>

                        {/* START CONSULTATION */}

                        {appointment.status === "confirmed" && (

                          <button
                            onClick={() => {

                              setSelectedPatientId(
                                appointment.patient_id?._id
                              );

                              // IMPORTANT: store the complete patient object
                              setSelectedPatient(
                                appointment.patient_id
                              );

                              setSelectedAppointmentId(
                                appointment._id
                              );

                              setCurrentPage("doctor-video");

                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Start Consultation →
                          </button>

                        )}

                        {appointment.status === "completed" && (

                          <span className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition">
                            Appointment Completed
                          </span>

                        )}

                        {appointment.status === "cancelled" && (

                          <span className="text-xs text-red-500 font-semibold">
                            Appointment Cancelled
                          </span>

                        )}

                      </div>

                    </div>

                    {appointment.reason && (

                      <div className="mt-4 pt-3 border-t border-slate-100">

                        <p className="text-xs text-slate-500">

                          <span className="font-semibold text-slate-700">
                            Reason:
                          </span>{" "}

                          {appointment.reason}

                        </p>

                      </div>

                    )}

                  </div>

                ))}

              </div>

            )}

        </div>

        {/* Live Patient Triage Queue */}

        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-slate-200/80">

          <div className="flex justify-between items-center mb-4">

            <div>

              <h2 className="font-bold text-slate-900 text-base">
                Incoming Patient Triage Queue
              </h2>

              <p className="text-xs text-slate-500">
                Patients who have confirmed appointments with you.
              </p>

            </div>

            <span className="text-xs font-bold bg-teal-100 text-teal-800 px-3 py-1 rounded-full">
              {triageAppointments.length} Waiting
            </span>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full text-left text-sm text-slate-600">

              <thead className="bg-slate-50/80 text-slate-700 uppercase text-[11px] font-semibold">

                <tr>

                  <th className="p-3">
                    Patient ID & Name
                  </th>

                  <th className="p-3">
                    Age/Gender
                  </th>

                  <th className="p-3">
                    Primary Symptom
                  </th>

                  <th className="p-3">
                    Appointment
                  </th>

                  <th className="p-3">
                    Action
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-100 text-xs">

                {triageAppointments.length === 0 ? (

                  <tr>

                    <td
                      colSpan="5"
                      className="p-8 text-center text-slate-500"
                    >
                      No patients waiting for consultation
                    </td>

                  </tr>

                ) : (

                  triageAppointments.map((appointment) => {

                    const patient = appointment.patient_id;

                    return (
                      <tr
              key={appointment._id}
              className="hover:bg-slate-50/50"
            >

              <td className="p-3">
                <div className="font-semibold text-slate-900">
                  {patient?.name || "Unknown Patient"}
                </div>

                <div className="text-[10px] text-slate-400 mt-1">
                  ID: {patient?._id || "N/A"}
                </div>
              </td>

              <td className="p-3">
                {patient?.dob
                  ? `${Math.floor(
                      (new Date() - new Date(patient.dob)) /
                      (1000 * 60 * 60 * 24 * 365.25)
                    )} yrs`
                  : "N/A"
                }

                {" / "}

                {patient?.gender || "N/A"}
              </td>

              <td className="p-3 font-medium text-slate-700">
                {appointment.reason ||
                  patient?.details ||
                  "General Consultation"}
              </td>

              <td className="p-3">
                <div className="font-medium text-slate-700">
                  📅{" "}
                  {new Date(
                    appointment.appointment_date
                  ).toLocaleDateString("en-IN")}
                </div>

                <div className="text-slate-500 mt-1">
                  🕐 {appointment.appointment_time}
                </div>
              </td>

              <td className="p-3">
                <button
                  onClick={() => {

                    setSelectedPatientId(
                      patient?._id
                    );

                    setSelectedPatient(
                      patient
                    );

                    setSelectedAppointmentId(
                      appointment._id
                    );

                    setCurrentPage("doctor-video");

                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg transition shadow-sm cursor-pointer"
                >
                  Start Consult →
                </button>
              </td>

            </tr>
          );
        })
      )}
    </tbody>
  </table>
</div>
</div>
</main>
</div>
  );
}