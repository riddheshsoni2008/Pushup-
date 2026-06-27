"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Dumbbell, 
  Flame, 
  Settings, 
  History, 
  Play, 
  Square, 
  Target, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle,
  RotateCcw
} from "lucide-react";

export default function Home() {
  // App State
  const [reps, setReps] = useState(0);
  const [repsToday, setRepsToday] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(20);
  const [streak, setStreak] = useState(0);
  const [logs, setLogs] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

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

  // 2. Load MediaPipe Scripts from CDN
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

  // 3. Angle Calculations
  const calculateAngle = (a, b, c) => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) {
      angle = 360.0 - angle;
    }
    return angle;
  };

  // 4. MediaPipe Pose OnResults
  const onResults = (results) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      if (window.drawConnectors && window.drawLandmarks) {
        window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, {
          color: "#2563eb",
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
      console.warn("AudioContext blocked by browser auto-play policy", e);
    }
  };

  // 5. Start/Stop Camera Feed & Pose Tracker
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
          phone_number: "", // Send blank since WhatsApp is disabled
        }),
      });

      if (res.ok) {
        setDailyTarget(parseInt(targetInput));
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
    <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans">
      
      {/* 1. SIDEBAR */}
      <aside className="w-80 border-r border-slate-200 bg-white p-6 flex flex-col justify-between hidden lg:flex flex-shrink-0">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-600/30">
              <Dumbbell className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                FITPOSTURE
              </span>
              <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mt-0.5">
                AI Push-Up Coach
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-orange-500/10 p-2 rounded-xl text-orange-500">
                  <Flame className="w-5 h-5 fill-orange-500/10" />
                </div>
                <span className="text-sm font-semibold text-slate-600">Streak</span>
              </div>
              <span className="text-2xl font-black text-orange-600">{streak} Days</span>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/10 p-2 rounded-xl text-blue-600">
                  <Target className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold text-slate-600">Daily Target</span>
              </div>
              <span className="text-lg font-bold text-slate-800">{dailyTarget} Reps</span>
            </div>
          </div>

          {/* Navigation/Actions */}
          <div className="space-y-2.5">
            <button 
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition-all border border-slate-200 hover:border-blue-200 shadow-sm"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              Configure Settings
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-100 pt-6">
          <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-3 shadow-inner">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold tracking-wide text-emerald-700 uppercase">AI Processor Online</span>
          </div>
        </div>
      </aside>

      {/* 2. MAIN CONTAINER */}
      <main className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 overflow-y-auto max-h-screen">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 pb-4 lg:border-b-0 lg:pb-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white lg:hidden">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent lg:text-slate-900">
                  FITPOSTURE
                </span>
                <span className="hidden md:inline text-slate-300">|</span>
                <span className="hidden md:inline text-base font-bold text-slate-500 mt-1">AI Push-Up Coach</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium hidden md:block">
                Real-time pose assessment using advanced computer vision.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 lg:hidden">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Mobile Quick Stats */}
        <div className="grid grid-cols-2 gap-4 lg:hidden">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500/10" />
              <span className="text-xs font-semibold text-slate-500">Streak</span>
            </div>
            <span className="text-lg font-black text-orange-600">{streak} Days</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-semibold text-slate-500">Target</span>
            </div>
            <span className="text-lg font-bold text-slate-800">{dailyTarget} Reps</span>
          </div>
        </div>

        {/* 3. CORE CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* LEFT: Video */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
            
            <div className="relative border border-slate-200/80 rounded-3xl bg-white shadow-xl overflow-hidden flex flex-col">
              
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${cameraActive ? "bg-red-500 animate-pulse" : "bg-slate-400"}`}></div>
                  <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {cameraActive ? "Camera Active" : "Camera Offline"}
                  </span>
                </div>

                {cameraActive && (
                  <span className={`text-[10px] md:text-xs font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider ${
                    postureState === "Perfect posture" 
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                      : "bg-red-100 text-red-700 border border-red-200 animate-pulse"
                  }`}>
                    {postureState}
                  </span>
                )}
              </div>

              {/* Viewport */}
              <div className="aspect-[4/3] w-full bg-slate-900 flex items-center justify-center relative">
                <video ref={videoRef} className="hidden" playsInline muted />
                <canvas ref={canvasRef} width="640" height="480" className="absolute inset-0 w-full h-full object-cover" />

                {!cameraActive && (
                  <div className="text-center p-6 md:p-8 space-y-5 md:space-y-6 max-w-sm absolute z-10">
                    <div className="inline-flex bg-slate-800 border border-slate-700 p-4 md:p-5 rounded-3xl text-blue-400 shadow-inner">
                      <Play className="w-8 h-8 md:w-10 md:h-10 fill-blue-500/10" />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-bold text-white">Start push-up assessment</h3>
                      <p className="text-xs md:text-sm text-slate-400 mt-2 leading-relaxed">
                        Position your camera to capture your entire profile view (head, shoulders, hips, knees, and feet) clearly.
                      </p>
                    </div>
                    <button
                      onClick={() => setCameraActive(true)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all hover:translate-y-[-1px] text-xs md:text-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      Activate Camera
                    </button>
                  </div>
                )}

                {cameraActive && (
                  <>
                    <div className="absolute top-4 right-4 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2 md:px-5 md:py-3 text-center backdrop-blur-sm shadow-xl flex items-center gap-2 md:gap-3">
                      <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">Reps</span>
                      <span className="text-3xl md:text-4xl font-black text-blue-400 tracking-tight">{reps}</span>
                    </div>

                    {postureWarning && (
                      <div className="absolute bottom-4 left-4 right-4 bg-red-900/95 border border-red-700/80 p-3 rounded-xl flex items-center gap-3 backdrop-blur-sm text-red-105 text-red-100 text-xs md:text-sm font-semibold shadow-2xl animate-bounce">
                        <ShieldAlert className="w-5 h-5 text-red-450 text-red-400 flex-shrink-0" />
                        <span>{postureWarning}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {cameraActive && (
                <div className="p-3 md:p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
                  <div className="flex gap-3 md:gap-4 items-center">
                    <span className="text-[10px] md:text-xs font-bold text-slate-600">
                      Form: <span className="font-extrabold text-slate-800">{
                        sessionFrames > 0 
                          ? Math.round((goodPostureFrames / sessionFrames) * 100) 
                          : 100
                      }%</span>
                    </span>
                    <span className="text-slate-350">|</span>
                    <span className="text-[10px] md:text-xs font-bold text-slate-650">
                      Elbow: <span className="font-extrabold text-slate-800">{elbowAngleVal}°</span>
                    </span>
                  </div>
                  
                  <button
                    onClick={() => setCameraActive(false)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold bg-red-600 hover:bg-red-505 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 transition-all text-xs"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    Stop & Save
                  </button>
                </div>
              )}
            </div>

            {/* Guide */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600 flex-shrink-0">
                  <RotateCcw className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-xs md:text-sm text-slate-850 text-slate-800">How push-up form is calculated</h4>
                  <p className="text-[10px] md:text-xs text-slate-500 mt-1 leading-relaxed">
                    1. **Reps:** Counted when elbow angle bends below 95° and then fully extends above 150°.<br/>
                    2. **Form:** Keeps back straight. Hip-shoulder-knee alignment angle must remain above 155°.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT: Today's progress & History */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 w-full">
            
            <div className="border border-slate-200/80 rounded-3xl bg-white p-5 md:p-6 flex flex-col gap-6 shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl"></div>
              
              <div>
                <h3 className="font-extrabold text-base md:text-lg text-slate-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  Today's Progress
                </h3>
                <p className="text-[10px] md:text-xs text-slate-500 mt-1 font-medium">Your goal resets daily at midnight.</p>
              </div>

              {/* Progress visual */}
              <div className="flex items-center justify-between gap-6">
                
                {/* Circle */}
                <div className="relative w-24 h-24 md:w-28 md:h-28 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      stroke="#f1f5f9" 
                      strokeWidth="10" 
                      fill="transparent" 
                    />
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      stroke="#2563eb" 
                      strokeWidth="10" 
                      fill="transparent" 
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * progressPercent) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-xl md:text-2xl font-black text-slate-800">{progressPercent}%</span>
                  </div>
                </div>

                <div className="space-y-3 flex-1">
                  <div>
                    <span className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-widest">Completed</span>
                    <p className="text-xl md:text-2xl font-black text-slate-800 mt-0.5">{repsToday} Reps</p>
                  </div>
                  <div>
                    <span className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-widest">Remaining</span>
                    <p className="text-sm md:text-md font-bold text-slate-600 mt-0.5">{remainingReps} Reps</p>
                  </div>
                </div>

              </div>
            </div>

            {/* History */}
            <div className="border border-slate-200/80 rounded-3xl bg-white p-5 md:p-6 flex flex-col gap-4 shadow-md">
              <h3 className="font-extrabold text-base md:text-lg text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                Recent Workouts
              </h3>

              {logs.length === 0 ? (
                <div className="text-center py-8 text-slate-450 text-slate-400 text-sm">
                  No logged push-up sessions yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div 
                      key={log.id}
                      className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-4 hover:bg-slate-50 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs md:text-sm font-black text-slate-850 text-slate-800">{log.reps} reps</span>
                          <span className={`text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            log.posture_score >= 80 
                              ? "bg-emerald-100 text-emerald-700" 
                              : log.posture_score >= 60 
                                ? "bg-amber-100 text-amber-700" 
                                : "bg-red-100 text-red-700"
                          }`}>
                            {log.posture_score}% Form
                          </span>
                        </div>
                        <p className="text-[9px] md:text-[10px] text-slate-400 font-semibold">{log.date}</p>
                      </div>
                      
                      {log.posture_score >= 80 ? (
                        <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
                      ) : log.posture_score >= 60 ? (
                        <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
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

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-5 md:p-6 shadow-2xl relative">
            <h3 className="font-extrabold text-lg md:text-xl text-slate-900 flex items-center gap-2.5">
              <Settings className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              Configure AI Settings
            </h3>
            <p className="text-[11px] md:text-xs text-slate-500 mt-1.5 leading-relaxed">
              Set your target push-up goals to track your daily stats.
            </p>

            <form onSubmit={handleUpdateSettings} className="space-y-4 md:space-y-5 mt-5 md:mt-6">
              
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Daily Push-Up Target
                </label>
                <input 
                  type="number"
                  required
                  min="1"
                  max="500"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 md:py-3 text-slate-800 focus:outline-none focus:border-blue-500 font-bold text-sm"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button 
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-2.5 md:py-3 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-655 text-slate-600 text-xs transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 md:py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white text-xs transition-all shadow-lg shadow-blue-600/20"
                >
                  Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
