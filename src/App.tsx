/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Settings as SettingsIcon, 
  X, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Lock, 
  LogIn,
  Eye,
  Info
} from "lucide-react";
import { db, auth, loginWithGoogle } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

// --- Constants & Types ---

const ADMIN_EMAIL = "arne.nys@ptiz.be";
const TOTAL_WEEKS_AVAILABLE = 28;

const WEEKLY_IMAGES: Record<number, string> = {
  1: "1J41zLEbk25bChlLGBYpJ9G0FybmWByHv",
  2: "1l8oTatQeYiCKc13b5gdoldYLX_bRXEm7",
  3: "1--5fBz9cciY6VM39pykaLwReSYd57SRG",
  4: "1JGVdKWSCEGhDCYFx6lCCEPVFWRpaSqXD",
  5: "1WtHOsDeFJcKPqeDjgnnh6E8Tc5mhlYpn",
  6: "1stgjVFhONz_Jj5I75fM-zfu5j4_Bw_Xl",
  7: "1cCeivcF6NQK-1pao0_BcUnSdE_NdRCsI",
  8: "10CeYW0LdmObFoMHP_F4058cgU-UB25wn",
  9: "17gVck1J09XAytKyX_OtGv5NOsRJf6vQH",
  10: "1x7Edbg_T14rUCRls1-Q1b5GnSWyteE0R",
  11: "1F1MZgTc9YkOyCQo1amKgkATine5HA_oM",
  12: "1Mje39veiUFKxdJ67jrOKB9SG4eerT-Iu",
  13: "14mzL9yV8jDVGqsA8XWCrAHWss8jNBosh",
  14: "1s9w82IgkJVLPaPWEhal42jBm8DDTzmFY",
  15: "16Yzp1exoV0khg_9fzEKUbCpQsukWCc4n",
  16: "1d4VEBPEQsOE6M04-8JkWGRef01fvZ-Qt",
  17: "1IAwTCIPdyoMaQd_72agXWmZ-LLUTzY21",
  18: "1Q_xgJmGujLcPezING21l6sf8S-mm_DDA",
  19: "16zQEJ-m0YvdwxadlKzTRkhuewf46_yL-",
  20: "1x4PyVdPBE8gGbXY9MHzfqgX-zWgYnRPX",
  21: "1te0mGgWRGz7rj5Dn8QJfwLN7bV6ig39B",
  22: "1W6JlK3x_d4_ReqS3u9AFovJHZCLdwO9R",
  23: "1tnkZUuOD_bhu0ObY5eOjQUEZ1zZLyTjd",
  24: "1bQu8nGAkl7Og0RVo_eUByGuUcHDTrb3y",
  25: "15NHKX3gQxfl6fgCNmCystM5bnzQu5dsz",
  26: "1GeLRtaQNJBvRtAapGsIhQi_sxRj4qDOH",
  27: "1wb6ShiCa_x1IpsRBv-i3FgiLgDTvVOsD",
  28: "1c0bne6ytVugYiQniZwGWphSW7HUedZ19",
};

// --- Utilities ---

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const getGoogleImageUrl = (id: string) => `https://lh3.googleusercontent.com/d/${id}`;

// --- Main Component ---

export default function App() {
  // State
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [hasSynced, setHasSynced] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState("center");

  // Derived Values
  const realWeekNumber = useMemo(() => getISOWeek(new Date()), []);
  const isAdmin = user?.email === ADMIN_EMAIL;
  
  const activeWeek = useMemo(() => {
    if (selectedWeek !== null) return selectedWeek;
    let w = realWeekNumber + weekOffset;
    while (w <= 0) w += 52;
    while (w > 52) w -= 52;
    return w;
  }, [realWeekNumber, weekOffset, selectedWeek]);

  const imageUrl = useMemo(() => {
    if (!hasSynced && selectedWeek === null) return null;
    const fileId = WEEKLY_IMAGES[activeWeek];
    return fileId ? getGoogleImageUrl(fileId) : null;
  }, [activeWeek, hasSynced, selectedWeek]);

  // --- Effects ---

  // Auth sync
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // Settings sync (Firestore)
  useEffect(() => {
    const settingsRef = doc(db, "settings", "global");
    return onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (typeof data.weekOffset === "number") {
          setWeekOffset(data.weekOffset);
        }
      }
      setHasSynced(true);
    });
  }, []);

  // Hidden trigger logic (5 clicks)
  useEffect(() => {
    if (clickCount >= 5) {
      setShowSettings(true);
      setClickCount(0);
    }
    if (clickCount > 0) {
      const timer = setTimeout(() => setClickCount(0), 3000);
      return () => clearTimeout(timer);
    }
  }, [clickCount]);

  // --- Handlers ---

  const handleZoomToggle = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setZoomOrigin(`${x}% ${y}%`);
      setIsZoomed(true);
    } else {
      setIsZoomed(false);
    }
  }, [isZoomed]);

  const handleUpdateOffset = async (newOffset: number) => {
    if (!isAdmin) return;
    try {
      await setDoc(doc(db, "settings", "global"), {
        weekOffset: newOffset,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email
      });
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-white selection:bg-blue-100">
      {/* --- Viewer Section --- */}
      <main className="flex h-full w-full items-start justify-center overflow-auto">
        <div 
          className={`
            relative flex items-start justify-center transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]
            ${isZoomed ? 'scale-[1.75] cursor-zoom-out' : 'scale-100 cursor-zoom-in'}
          `}
          style={{ transformOrigin: zoomOrigin }}
          onClick={handleZoomToggle}
        >
          {/* Internal image logic simplified to direct render */}
          {imageUrl ? (
            <motion.img
              key={imageUrl}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={imageUrl}
              alt={`Week ${activeWeek}`}
              className="max-h-screen max-w-full w-auto h-auto block select-none"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-gray-400 font-sans">
              <Info className="h-8 w-8 opacity-20" />
              <p className="text-sm font-medium">Geen afbeelding voor week {activeWeek}</p>
            </div>
          )}
        </div>

        {/* Hidden Interaction Zone (Top-Right) */}
        <div 
          className="absolute top-0 right-0 z-50 h-32 w-32 cursor-default"
          onClick={(e) => {
            e.stopPropagation();
            setClickCount(c => c + 1);
          }}
        />
      </main>

      {/* --- Settings Modal --- */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/40 backdrop-blur-md p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-lg overflow-hidden rounded-[2.5rem] bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 px-8 py-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <SettingsIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 leading-tight">Brede basiszorg</h2>
                    <p className="text-xs font-medium text-gray-400">Instellingen & Beheer</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="rounded-full p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-900 active:scale-95"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Body */}
              <div className="p-8 space-y-10">
                {/* Admin Status / Auth */}
                {!user ? (
                  <div className="group relative overflow-hidden rounded-3xl border border-gray-100 bg-gray-50/50 p-6 text-center transition-all hover:bg-gray-50">
                    <p className="mb-4 text-xs font-medium text-gray-500">Log in om de globale weekoffset aan te passen.</p>
                    <button 
                      onClick={loginWithGoogle}
                      className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900 shadow-sm ring-1 ring-gray-200 transition-all hover:shadow-md active:scale-95"
                    >
                      <LogIn className="h-4 w-4" />
                      Inloggen met Google
                    </button>
                  </div>
                ) : !isAdmin ? (
                  <div className="rounded-3xl bg-amber-50/50 p-6 text-center border border-amber-100">
                    <p className="text-xs font-semibold text-amber-700">
                      Je bent ingelogd als <span className="underline">{user.email}</span>, maar hebt geen beheerdersrechten.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-green-600">
                    <Lock className="h-3 w-3" />
                    <span>Je hebt beheerdersrechten</span>
                  </div>
                )}

                {/* Global Week Offset */}
                <div className={!isAdmin ? 'opacity-40 pointer-events-none' : ''}>
                  <div className="mb-4 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Wereldwijde Offset</span>
                    </div>
                    {weekOffset !== 0 && (
                      <button 
                        onClick={() => handleUpdateOffset(0)}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 transition-all hover:opacity-70"
                      >
                        <RotateCcw className="h-3 w-3" />
                        RESET
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between rounded-[2rem] bg-gray-50 p-4 ring-1 ring-gray-100/50">
                    <button 
                      onClick={() => handleUpdateOffset(weekOffset - 1)}
                      className="rounded-2xl bg-white p-4 text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-90"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    
                    <div className="text-center">
                      <div className="text-4xl font-black tabular-nums tracking-tighter text-gray-900">
                        {weekOffset > 0 ? `+${weekOffset}` : weekOffset}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                        weken
                      </div>
                    </div>

                    <button 
                      onClick={() => handleUpdateOffset(weekOffset + 1)}
                      className="rounded-2xl bg-white p-4 text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-90"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {/* User Force Selection */}
                <div>
                  <div className="mb-4 px-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                    <Eye className="h-3.5 w-3.5" />
                    <span>Forceer Week (Alleen voor jou)</span>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {[...Array(TOTAL_WEEKS_AVAILABLE)].map((_, i) => {
                      const w = i + 1;
                      const isCurrent = activeWeek === w;
                      const isReal = realWeekNumber === w;
                      return (
                        <button
                          key={w}
                          onClick={() => setSelectedWeek(w === realWeekNumber ? null : w)}
                          className={`
                            group relative flex h-11 items-center justify-center rounded-xl text-xs font-bold transition-all
                            ${isCurrent 
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                              : 'bg-gray-50 text-gray-500 hover:bg-gray-200'}
                            ${isReal ? 'ring-2 ring-blue-100 ring-offset-2' : ''}
                          `}
                        >
                          {w}
                          {isReal && !isCurrent && <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between border-t border-gray-100 pt-8">
                   <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                     Versie 2.0.0
                   </div>
                   <button
                    onClick={() => setShowSettings(false)}
                    className="rounded-[1.25rem] bg-gray-900 px-8 py-3.5 text-sm font-bold text-white shadow-xl transition-all hover:bg-gray-800 active:scale-95"
                  >
                    Klaar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Footer Hint (Hidden mostly) --- */}
      <div className="fixed bottom-6 w-full flex justify-center pointer-events-none transition-opacity duration-1000">
        <div className="px-4 py-2 rounded-full bg-white/40 backdrop-blur-sm border border-black/5 opacity-0 hover:opacity-100 transition-opacity">
           <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-gray-400">
             W{activeWeek} • BREDE BASISZORG
           </span>
        </div>
      </div>
    </div>
  );
}
