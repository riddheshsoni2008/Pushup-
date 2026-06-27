"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Dumbbell, 
  Flame, 
  MessageSquare, 
  Settings, 
  History, 
  Play, 
  Square, 
  Target, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle,
  RotateCcw,
  Smartphone
} from "lucide-react";

export default function Home() {
  // App State
  const [reps, setReps] = useState(0);
  const [repsToday, setRepsToday] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(20);
  const [streak, setStreak] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [logs, setLogs] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  
  // WhatsApp Automation States
  const [whatsappStatus, setWhatsappStatus] = useState("initializing");
  const [whatsappQr, setWhatsappQr] = useState(null);
  const [whatsappTesting, setWhatsappTesting] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Real-time Posture Metrics
  const [postureState, setPostureState] = useState("Align your body"); 
  const [elbowAngleVal, setElbowAngleVal] = useState(180);
  const [backAngleVal, setBackAngleVal] = useState(180);
  const [postureWarning, setPostureWarning] = useState("");
  const [sessionFrames, setSessionFrames] = useState(0);
  const [goodPostureFrames, setGoodPostureFrames] = useState(0);

  // Settings UI Modal Toggle
  const [showSettings, setShowSettings] = useState(false);
  const [targetInput, setTargetInput] = useState(20);
  const [phoneInput, setPhoneInput] = useState("");

  // Refs for Video & Canvas
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseRef = useRef(null);
  const cameraRef = useRef(null);
  
  // Rep Counter State Machine Refs
  const repStateRef = useRef("up"); 
  const repsCountRef = useRef(0);
  const goodFramesRef = useRef(0);
  const totalFramesRef = useRef(0);

  // API Backend Base URL
  const API_BASE = "http://localhost:5000/api";

  // 1. Fetch User Data & Workout Logs
  const fetchData = async () => {
    try {
      const resUser = await fetch(`${API_BASE}/user`);
      if (resUser.ok) {
        const user = await resUser.json();
        setRepsToday(user.reps_today || 0);
        setDailyTarget(user.daily_target || 20);
        setTargetInput(user.daily_target || 20);
        setStreak(user.streak || 0);
        setPhoneNumber(user.phone_number || "");
        setPhoneInput(user.phone_number || "");
      }

      const resLogs = await fetch(`${API_BASE}/logs`);
      if (resLogs.ok) {
        const data = await resLogs.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Error fetching data from backend:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Poll WhatsApp Automation Client Connection Status
  useEffect(() => {
    const checkWhatsappStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/whatsapp/status`);
        if (res.ok) {
          const data = await res.json();
          setWhatsappStatus(data.status);
          setWhatsappQr(data.qr);
        }
      } catch (err) {
        console.error("Error checking WhatsApp status:", err);
      }
    };

    checkWhatsappStatus();
    const interval = setInterval(checkWhatsappStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // 3. Trigger Manual Test Dispatch for Auto Reminders
  const handleTestWhatsApp = async () => {
    if (!phoneNumber) return;
    setWhatsappTesting(true);
    try {
      const res = await fetch(`${API_BASE}/whatsapp/test`, { method: "POST" });
      if (res.ok) {
        alert("Automated warning check dispatched successfully! An alert was sent if you haven't completed your reps today.");
      } else {
        alert("Failed to execute test automated warning.");
      }
    } catch (err) {
      console.error(err);
      alert("Error sending test message.");
    } finally {
      setWhatsappTesting(false);
    }
  };

  // 4. Load MediaPipe Scripts from CDN
  useEffect(() => {
    const loadMediaPipe = async () => {
      try {
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js");
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js");
        setScriptsLoaded(true);
      } catch (err) {
        console.error("Failed to load MediaPipe Pose scripts", err);
      }
    };
    loadMediaPipe();
  }, []);

  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.crossOrigin = "anonymous";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // 5. Angle Calculations
  const calculateAngle = (a, b, c) => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) {
      angle = 360.0 - angle;
    }
    return angle;
  };

  // 6. MediaPipe Pose OnResults
  const onResults = (results) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      if (window.drawConnectors && window.drawLandmarks) {
        window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, {
          color: "#4f46e5",
          lineWidth: 4,
        });
        window.drawLandmarks(ctx, results.poseLandmarks, {
          color: "#10b981",
          lineWidth: 2,
          radius: 4,
        });
      }

      const leftShoulder = results.poseLandmarks[11];
      const rightShoulder = results.poseLandmarks[12];
      const leftElbow = results.poseLandmarks[13];
      const rightElbow = results.poseLandmarks[14];
      const leftWrist = results.poseLandmarks[15];
      const rightWrist = results.poseLandmarks[16];
      const leftHip = results.poseLandmarks[23];
      const rightHip = results.poseLandmarks[24];
      const leftKnee = results.poseLandmarks[25];
      const rightKnee = results.poseLandmarks[26];
      
      const leftVisible = leftShoulder.visibility > rightShoulder.visibility;
      
      const shoulder = leftVisible ? leftShoulder : rightShoulder;
      const elbow = leftVisible ? leftElbow : rightElbow;
      const wrist = leftVisible ? leftWrist : rightWrist;
      const hip = leftVisible ? leftHip : rightHip;
      const knee = leftVisible ? leftKnee : rightKnee;

      if (shoulder.visibility > 0.5 && elbow.visibility > 0.5 && wrist.visibility > 0.5 && hip.visibility > 0.5) {
        const elbowAngle = calculateAngle(shoulder, elbow, wrist);
        setElbowAngleVal(Math.round(elbowAngle));

        const backAngle = calculateAngle(shoulder, hip, knee);
        setBackAngleVal(Math.round(backAngle));

        totalFramesRef.current += 1;
        setSessionFrames(totalFramesRef.current);

        let currentPostureGood = true;
        if (backAngle < 155) {
          currentPostureGood = false;
          setPostureWarning("⚠️ Keep your back straight! Don't sag or raise your hips.");
          setPostureState("Sagging / High Hips");
          ctx.beginPath();
          ctx.arc(hip.x * canvas.width, hip.y * canvas.height, 15, 0, 2 * Math.PI);
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 4;
          ctx.stroke();
        } else {
          setPostureWarning("");
          setPostureState("Perfect posture");
        }

        if (currentPostureGood) {
          goodFramesRef.current += 1;
          setGoodPostureFrames(goodFramesRef.current);
        }

        if (elbowAngle < 95) {
          if (repStateRef.current === "up") {
            repStateRef.current = "down";
          }
        } else if (elbowAngle > 150) {
          if (repStateRef.current === "down") {
            repsCountRef.current += 1;
            setReps(repsCountRef.current);
            repStateRef.current = "up";
            playRepSound();
          }
        }

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText(`Elbow Angle: ${Math.round(elbowAngle)}°`, 20, 40);
        ctx.fillText(`Back Angle: ${Math.round(backAngle)}°`, 20, 65);
      } else {
        setPostureWarning("Step back! Position your entire body in profile view.");
        setPostureState("Align your body");
      }
    }
  };

  const playRepSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(600, audioCtx.currentTime); 
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1); 
    } catch (e) {
      console.warn("AudioContext block by browser auto-play policy", e);
    }
  };

  // 7. Start/Stop Camera Feed & Pose Tracker
  useEffect(() => {
    if (!scriptsLoaded) return;

    if (cameraActive) {
      setReps(0);
      repsCountRef.current = 0;
      goodFramesRef.current = 0;
      totalFramesRef.current = 0;
      setSessionFrames(0);
      setGoodPostureFrames(0);
      repStateRef.current = "up";

      const pose = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      pose.onResults(onResults);
      poseRef.current = pose;

      if (videoRef.current) {
        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current) {
              await pose.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });
        camera.start();
        cameraRef.current = camera;
      }
    } else {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      if (poseRef.current) {
        poseRef.current.close();
        poseRef.current = null;
      }

      if (repsCountRef.current > 0) {
        saveWorkoutSession();
      }
    }

    return () => {
      if (cameraRef.current) cameraRef.current.stop();
    };
  }, [cameraActive, scriptsLoaded]);

  const saveWorkoutSession = async () => {
    const calculatedScore = totalFramesRef.current > 0 
      ? Math.round((goodFramesRef.current / totalFramesRef.current) * 100)
      : 100;

    try {
      const res = await fetch(`${API_BASE}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reps: repsCountRef.current,
          posture_score: calculatedScore,
        }),
      });

      if (res.ok) {
        fetchData();
        setReps(0);
        repsCountRef.current = 0;
      }
    } catch (err) {
      console.error("Failed to save workout session:", err);
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daily_target: parseInt(targetInput),
          phone_number: phoneInput,
        }),
      });

      if (res.ok) {
        setDailyTarget(parseInt(targetInput));
        setPhoneNumber(phoneInput);
        setShowSettings(false);
        fetchData();
      }
    } catch (err) {
      console.error("Failed to update user settings:", err);
    }
  };

  const progressPercent = Math.min(100, Math.round((repsToday / dailyTarget) * 100));
  const remainingReps = Math.max(0, dailyTarget - repsToday);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* 1. SIDEBAR (Hidden on mobile/tablet, visible on desktop) */}
      <aside className="w-80 border-r border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 flex flex-col justify-between hidden lg:flex flex-shrink-0">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-600/30">
              <Dumbbell className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                FITPOSTURE
              </span>
              <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase mt-0.5">
                Push-Up AI Agent
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="space-y-4">
            <div className="bg-slate-800/40 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flame className="w-5 h-5 text-orange-500 fill-orange-500/10" />
                <span className="text-sm font-semibold text-slate-400">Workout Streak</span>
              </div>
              <span className="text-2xl font-black text-orange-400">{streak} Days</span>
            </div>

            <div className="bg-slate-800/40 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-semibold text-slate-400">Daily Target</span>
              </div>
              <span className="text-lg font-bold text-slate-200">{dailyTarget} Reps</span>
            </div>
          </div>

          {/* Navigation/Actions */}
          <div className="space-y-2.5">
            <button 
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-all border border-transparent hover:border-slate-700/60"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              Configure Settings
            </button>

            {/* WhatsApp Connection status dashboard */}
            <div className="border border-slate-800 rounded-xl p-3.5 space-y-2.5 bg-slate-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Auto Alerts</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1.5 ${
                  whatsappStatus === "ready" 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                    : whatsappStatus === "qr_ready"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    whatsappStatus === "ready" ? "bg-emerald-400 animate-pulse" : whatsappStatus === "qr_ready" ? "bg-amber-400 animate-ping" : "bg-blue-400"
                  }`}></span>
                  {whatsappStatus === "ready" ? "Connected" : whatsappStatus === "qr_ready" ? "Link Device" : "Connecting"}
                </span>
              </div>

              {whatsappStatus === "qr_ready" && (
                <button
                  onClick={() => setShowQrModal(true)}
                  className="w-full py-2 rounded-lg font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Scan QR Code
                </button>
              )}

              {whatsappStatus === "ready" && (
                <button
                  onClick={handleTestWhatsApp}
                  disabled={whatsappTesting || !phoneNumber}
                  className="w-full py-2 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <MessageSquare className="w-3.5 h-3.5 fill-white/10" />
                  {whatsappTesting ? "Testing..." : "Test Auto Alert"}
                </button>
              )}

              {!phoneNumber && (
                <p className="text-[10px] text-amber-500/90 leading-tight">
                  ⚠️ Configure a phone number in settings to enable reminders.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-800/80 pt-6">
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
            <span className="text-xs font-bold tracking-wide text-slate-400 uppercase">AI Processor Online</span>
          </div>
        </div>
      </aside>

      {/* 2. MAIN CONTAINER */}
      <main className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 overflow-y-auto max-h-screen">
        
        {/* Responsive Header (Top Bar for Mobile, Standard for Desktop) */}
        <header className="flex items-center justify-between border-b border-slate-900 pb-4 lg:border-b-0 lg:pb-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white lg:hidden">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent lg:text-white">
                  FITPOSTURE
                </span>
                <span className="hidden md:inline text-slate-400">|</span>
                <span className="hidden md:inline text-base font-semibold text-slate-400 mt-1">AI Push-Up posture Tracker</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium hidden md:block">
                Real-time pose assessment using computer vision.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 lg:hidden">
            {/* Quick settings trigger for mobile screen sizes */}
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Mobile Quick Stats Grid (Under header on small screens) */}
        <div className="grid grid-cols-2 gap-4 lg:hidden">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500/10" />
              <span className="text-xs font-semibold text-slate-400">Streak</span>
            </div>
            <span className="text-lg font-black text-orange-400">{streak} Days</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-slate-400">Target</span>
            </div>
            <span className="text-lg font-bold text-slate-200">{dailyTarget} reps</span>
          </div>
        </div>

        {/* Mobile Quick Actions Row */}
        <div className="flex flex-wrap gap-2 lg:hidden">
          {whatsappStatus === "qr_ready" ? (
            <button 
              onClick={() => setShowQrModal(true)}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10 animate-pulse"
            >
              <Smartphone className="w-4 h-4" />
              Link WhatsApp
            </button>
          ) : whatsappStatus === "ready" ? (
            <button 
              onClick={handleTestWhatsApp}
              disabled={whatsappTesting || !phoneNumber}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4 fill-emerald-400/10" />
              {whatsappTesting ? "Testing..." : "Test Alert"}
            </button>
          ) : (
            <div className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></div>
              WhatsApp Connecting...
            </div>
          )}
        </div>

        {/* 3. CORE CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* LEFT: Live Video assessment (Responsive width) */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
            
            {/* The Camera Feed Panel */}
            <div className="relative border border-slate-800 rounded-3xl bg-slate-900/40 shadow-2xl overflow-hidden flex flex-col">
              
              {/* Header Bar */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${cameraActive ? "bg-red-500 animate-pulse" : "bg-slate-600"}`}></div>
                  <span className="text-[10px] md:text-xs font-bold text-slate-300 uppercase tracking-widest">
                    {cameraActive ? "Camera Active" : "Camera Offline"}
                  </span>
                </div>

                {cameraActive && (
                  <span className={`text-[10px] md:text-xs font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider ${
                    postureState === "Perfect posture" 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                      : "bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse"
                  }`}>
                    {postureState}
                  </span>
                )}
              </div>

              {/* Video and Canvas viewport */}
              <div className="aspect-[4/3] w-full bg-slate-950 flex items-center justify-center relative">
                
                <video 
                  ref={videoRef}
                  className="hidden"
                  playsInline
                  muted
                />

                <canvas 
                  ref={canvasRef}
                  width="640"
                  height="480"
                  className="absolute inset-0 w-full h-full object-cover rounded-b-3xl"
                />

                {!cameraActive && (
                  <div className="text-center p-6 md:p-8 space-y-5 md:space-y-6 max-w-sm absolute z-10">
                    <div className="inline-flex bg-slate-900 border border-slate-800 p-4 md:p-5 rounded-3xl text-indigo-500 shadow-inner">
                      <Play className="w-8 h-8 md:w-10 md:h-10 fill-indigo-500/10" />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-bold text-slate-200">Start push-up assessment</h3>
                      <p className="text-xs md:text-sm text-slate-500 mt-2 leading-relaxed">
                        Position your camera to capture your entire profile view (head, shoulders, hips, knees, and feet) clearly.
                      </p>
                    </div>
                    <button
                      onClick={() => setCameraActive(true)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all hover:translate-y-[-1px] text-xs md:text-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      Activate Camera
                    </button>
                  </div>
                )}

                {cameraActive && (
                  <>
                    <div className="absolute top-4 right-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl px-4 py-2 md:px-5 md:py-3 text-center backdrop-blur-sm shadow-xl flex items-center gap-2 md:gap-3">
                      <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">Reps</span>
                      <span className="text-3xl md:text-4xl font-black text-indigo-400 tracking-tight">{reps}</span>
                    </div>

                    {postureWarning && (
                      <div className="absolute bottom-4 left-4 right-4 bg-red-950/80 border border-red-800/80 p-3 rounded-xl flex items-center gap-3 backdrop-blur-sm text-red-200 text-xs md:text-sm font-semibold shadow-2xl animate-bounce">
                        <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <span>{postureWarning}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {cameraActive && (
                <div className="p-3 md:p-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between gap-4">
                  <div className="flex gap-3 md:gap-4 items-center">
                    <span className="text-[10px] md:text-xs font-bold text-slate-400">
                      Form: <span className="font-extrabold text-slate-200">{
                        sessionFrames > 0 
                          ? Math.round((goodPostureFrames / sessionFrames) * 100) 
                          : 100
                      }%</span>
                    </span>
                    <span className="text-slate-800">|</span>
                    <span className="text-[10px] md:text-xs font-bold text-slate-400">
                      Elbow: <span className="font-extrabold text-slate-200">{elbowAngleVal}°</span>
                    </span>
                  </div>
                  
                  <button
                    onClick={() => setCameraActive(false)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all text-xs"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    Stop & Save
                  </button>
                </div>
              )}
            </div>
            
            {/* Quick calibration guide */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600/10 p-2.5 rounded-xl text-indigo-400 flex-shrink-0">
                  <RotateCcw className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-xs md:text-sm text-slate-200">How push-up form is calculated</h4>
                  <p className="text-[10px] md:text-xs text-slate-500 mt-1 leading-relaxed">
                    1. **Reps:** Counted when elbow angle bends below 95° and then fully extends above 150°.<br/>
                    2. **Form:** Keeps back straight. Hip-shoulder-knee alignment angle must remain above 155°.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT: Streaks & Analytics (Responsive Grid) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 w-full">
            
            {/* Today's Target Dashboard Card */}
            <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-5 md:p-6 flex flex-col gap-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl"></div>
              
              <div>
                <h3 className="font-extrabold text-base md:text-lg text-slate-100 flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-400" />
                  Today's Progress
                </h3>
                <p className="text-[10px] md:text-xs text-slate-500 mt-1 font-medium">Your goal resets daily at midnight.</p>
              </div>

              {/* Progress visual */}
              <div className="flex items-center justify-between gap-6">
                
                {/* SVG Progress Ring */}
                <div className="relative w-24 h-24 md:w-28 md:h-28 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      stroke="#1e293b" 
                      strokeWidth="10" 
                      fill="transparent" 
                    />
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      stroke="#4f46e5" 
                      strokeWidth="10" 
                      fill="transparent" 
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * progressPercent) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-xl md:text-2xl font-black text-white">{progressPercent}%</span>
                  </div>
                </div>

                <div className="space-y-3 flex-1">
                  <div>
                    <span className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-widest">Completed</span>
                    <p className="text-xl md:text-2xl font-black text-slate-200 mt-0.5">{repsToday} Reps</p>
                  </div>
                  <div>
                    <span className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-widest">Remaining</span>
                    <p className="text-sm md:text-md font-bold text-slate-400 mt-0.5">{remainingReps} Reps</p>
                  </div>
                </div>

              </div>

              {/* WhatsApp automated notification action block */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-600/10 p-2 rounded-lg text-emerald-400 flex-shrink-0 mt-0.5">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-300">Automated Reminders</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Our system automatically checks your progress at 9 PM and messages you if your goal is incomplete.
                    </p>
                  </div>
                </div>

                {whatsappStatus === "ready" ? (
                  <div className="space-y-3">
                    <button 
                      onClick={handleTestWhatsApp}
                      disabled={whatsappTesting || !phoneNumber}
                      className="w-full py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 text-xs transition-all shadow-md shadow-emerald-900/10 disabled:opacity-50"
                    >
                      <MessageSquare className="w-4 h-4 fill-white" />
                      {whatsappTesting ? "Dispatching Alert..." : "Test Automated Alert"}
                    </button>
                    {phoneNumber && (
                      <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800 text-[10px] text-slate-500 leading-snug">
                        <span className="font-bold text-slate-400">Target Phone:</span> {phoneNumber}
                      </div>
                    )}
                  </div>
                ) : whatsappStatus === "qr_ready" ? (
                  <button 
                    onClick={() => setShowQrModal(true)}
                    className="w-full py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs transition-all"
                  >
                    Scan WhatsApp Link QR
                  </button>
                ) : (
                  <div className="text-center py-2 text-xs text-slate-500 flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></div>
                    Connecting WhatsApp automation...
                  </div>
                )}
              </div>

            </div>

            {/* Workout Log History list */}
            <div className="border border-slate-800 rounded-3xl bg-slate-900/40 p-5 md:p-6 flex flex-col gap-4 shadow-xl">
              <h3 className="font-extrabold text-base md:text-lg text-slate-100 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                Recent Workouts
              </h3>

              {logs.length === 0 ? (
                <div className="text-center py-8 text-slate-600 text-sm">
                  No logged push-up sessions yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div 
                      key={log.id}
                      className="bg-slate-900/60 border border-slate-850 p-3 rounded-xl flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs md:text-sm font-black text-slate-200">{log.reps} reps</span>
                          <span className={`text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            log.posture_score >= 80 
                              ? "bg-emerald-500/10 text-emerald-400" 
                              : log.posture_score >= 60 
                                ? "bg-amber-500/10 text-amber-400" 
                                : "bg-red-500/10 text-red-400"
                          }`}>
                            {log.posture_score}% Form
                          </span>
                        </div>
                        <p className="text-[9px] md:text-[10px] text-slate-500 font-semibold">{log.date}</p>
                      </div>
                      
                      {log.posture_score >= 80 ? (
                        <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
                      ) : log.posture_score >= 60 ? (
                        <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </main>

      {/* 4. SETTINGS MODAL DIALOG */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 md:p-6 shadow-2xl relative">
            <h3 className="font-extrabold text-lg md:text-xl text-slate-100 flex items-center gap-2.5">
              <Settings className="w-5 h-5 md:w-6 md:h-6 text-indigo-500" />
              Configure AI Settings
            </h3>
            <p className="text-[11px] md:text-xs text-slate-500 mt-1.5 leading-relaxed">
              Set your target push-up goals and enter your phone number to enable automated alerts.
            </p>

            <form onSubmit={handleUpdateSettings} className="space-y-4 md:space-y-5 mt-5 md:mt-6">
              
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Daily Push-Up Target
                </label>
                <input 
                  type="number"
                  required
                  min="1"
                  max="500"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 md:py-3 text-slate-200 focus:outline-none focus:border-indigo-500 font-bold text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider block flex flex-wrap items-center gap-1">
                  WhatsApp Phone Number 
                  <span className="text-[9px] md:text-[10px] text-slate-650 font-semibold normal-case">(Include country code, digits only, e.g., 919876543210)</span>
                </label>
                <input 
                  type="text"
                  placeholder="e.g. 919876543210"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 md:py-3 text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button 
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-2.5 md:py-3 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 md:py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white text-xs transition-all shadow-lg shadow-indigo-600/20"
                >
                  Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 5. WHATSAPP QR MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 md:p-6 shadow-2xl relative text-center space-y-4 md:space-y-5">
            <div>
              <h3 className="font-extrabold text-lg md:text-xl text-slate-100 flex items-center justify-center gap-2">
                <Smartphone className="w-5.5 h-5.5 text-amber-400 animate-bounce" />
                Link WhatsApp Device
              </h3>
              <p className="text-[11px] md:text-xs text-slate-500 mt-1.5 leading-relaxed">
                Scan this QR code with WhatsApp on your phone to link FitPosture and enable <strong>automatic daily warnings</strong>.
              </p>
            </div>

            {whatsappQr ? (
              <div className="bg-white p-3 md:p-4 rounded-2xl inline-block shadow-inner mx-auto">
                <img 
                  src={whatsappQr} 
                  alt="WhatsApp QR Code"
                  className="w-44 h-44 md:w-52 md:h-52 object-contain"
                />
              </div>
            ) : (
              <div className="py-16 md:py-20 flex flex-col items-center justify-center gap-3">
                <div className="w-7 h-7 md:w-8 md:h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-semibold text-slate-400">Generating secure connection QR...</span>
              </div>
            )}

            <div className="bg-slate-950/60 p-3 md:p-4 rounded-2xl border border-slate-850 text-[10px] md:text-[11px] text-slate-400 text-left space-y-1 md:space-y-1.5 leading-relaxed">
              <span className="font-black text-slate-350 block mb-1">Instructions:</span>
              1. Open WhatsApp on your phone.<br/>
              2. Go to **Settings** or **Menu** (three dots) ➔ **Linked Devices**.<br/>
              3. Tap **Link a Device** and scan the QR code above.<br/>
              4. The page will automatically reload once connected!
            </div>

            <button 
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 md:py-3 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
