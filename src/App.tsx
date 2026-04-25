import React, { useState, useEffect, FormEvent } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, onSnapshot, setDoc, query, collection, where, getDocs, getDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, LogIn, LayoutDashboard, Send, Clock, AlertCircle, ExternalLink, Users, CheckCircle, Trash2, Plus, Check, ChevronLeft, ChevronRight, X, Award, History, TrendingUp, Medal, Star, Camera } from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "./lib/utils";
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';

const LOGO_URL = "https://upload.wikimedia.org/wikipedia/ar/1/17/Saudi_Ministry_of_Education_Logo_2025.png";

// --- Types ---
type QuestionType = "text" | "mcq" | "multi";

interface CompetitionData {
  id: string;
  title: string;
  question: string;
  questionType: QuestionType;
  questionImageUrl?: string;
  options?: string[];
  prizeImageUrl?: string;
  adImageUrl?: string;
  adLink?: string;
  status: "idle" | "active" | "drawing" | "finished";
  endTime?: string;
  startTime?: string;
  isScheduled?: boolean;
  winnerId?: string;
  winnerName?: string;
  winnerGrade?: string;
  winnerSection?: string;
  winnerPhotoUrl?: string;
  note?: string;
  correctAnswer?: string;
  createdAt?: string;
}

interface StudentProfile {
  nationalId: string;
  name: string;
  uid: string;
  grade?: string;
  section?: string;
  deviceId?: string;
}

interface PastWinner {
  id: string;
  compTitle: string;
  winnerName: string;
  winnerGrade: string;
  winnerSection: string;
  prizeImageUrl?: string;
  winnerPhotoUrl?: string;
  date: string;
}

// --- Utils ---
const normalizeArabic = (text: string) => {
  return text
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const SOUNDS = {
  suspense: new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"),
  celebration: new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3"),
  click: new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3")
};

const sendReaction = async (competitionId: string, type: string) => {
  const id = "react_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  await setDoc(doc(db, `competitions/${competitionId}/reactions`, id), {
    type,
    timestamp: new Date().toISOString()
  });
};

// --- Components ---

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#050508] flex items-center justify-center z-50">
      <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} className="flex flex-col items-center">
        <Trophy className="w-16 h-16 text-[#00f3ff] mb-4" />
        <h2 className="text-2xl font-bold text-[#00f3ff]">جاري التحميل...</h2>
      </motion.div>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (p: StudentProfile) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [nationalId, setNationalId] = useState("");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("الأول متوسط");
  const [section, setSection] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nationalId || (mode === "register" && !name)) {
      setError("يرجى إكمال الحقول المطلوبة");
      return;
    }
    setLoading(true);
    setError("");

    const deviceId = localStorage.getItem("eduwin_device_id") || "dev_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("eduwin_device_id", deviceId);

    try {
      if (mode === "register") {
        const q = query(collection(db, "students"), where("nationalId", "==", nationalId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setError("هذا الرقم مسجل مسبقاً، يرجى تسجيل الدخول");
          setLoading(false);
          return;
        }

        const dq = query(collection(db, "students"), where("deviceId", "==", deviceId));
        const dsnap = await getDocs(dq);
        if (!dsnap.empty && dsnap.docs[0].data().nationalId !== nationalId) {
          setError("عذراً، هذا الجهاز مسجل بحساب آخر.");
          setLoading(false);
          return;
        }

        const res = await signInAnonymously(auth);
        const studentData: StudentProfile = {
          uid: res.user.uid,
          name, nationalId, grade, section, deviceId
        };
        await setDoc(doc(db, "students", res.user.uid), studentData);
        localStorage.setItem("eduwin_student", JSON.stringify(studentData));
        onLogin(studentData);
      } else {
        const q = query(collection(db, "students"), where("nationalId", "==", nationalId));
        const snap = await getDocs(q);
        if (snap.empty) {
          setError("هذا الرقم غير مسجل");
          setLoading(false);
          return;
        }
        const studentData = snap.docs[0].data() as StudentProfile;
        await signInAnonymously(auth);
        localStorage.setItem("eduwin_student", JSON.stringify(studentData));
        onLogin(studentData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#050508]">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full bg-[#0a0a12] p-8 rounded-[40px] border border-[#bc13fe]/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#bc13fe] via-[#00f3ff] to-[#bc13fe]" />
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="Logo" className="w-24 h-auto mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">مسابقة عماد الدين زنكي</h1>
          <p className="text-white/40 text-sm">بوابة الأبطال والمبدعين</p>
        </div>

        <div className="flex bg-black/40 rounded-2xl p-1 mb-8 gap-1">
          <button onClick={() => setMode("register")} className={cn("flex-1 py-2 rounded-xl text-sm font-bold transition-all", mode === "register" ? "bg-[#bc13fe] text-white shadow-lg" : "text-white/40")}>تسجيل جديد</button>
          <button onClick={() => setMode("login")} className={cn("flex-1 py-2 rounded-xl text-sm font-bold transition-all", mode === "login" ? "bg-[#bc13fe] text-white shadow-lg" : "text-white/40")}>دخول</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
          <div>
            <label className="block text-xs font-bold mb-2 text-[#00f3ff] text-right uppercase tracking-widest">رقم الهوية</label>
            <input type="text" value={nationalId} onChange={(e) => setNationalId(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-4 focus:border-[#bc13fe] outline-none text-right text-white" placeholder="أدخل رقم الهوية" />
          </div>
          {mode === "register" && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold mb-2 text-[#00f3ff] text-right uppercase tracking-widest">الاسم الثلاثي</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-4 focus:border-[#bc13fe] outline-none text-right text-white" placeholder="أدخل اسمك الكامل" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-4 text-right text-white"><option value="الأول متوسط">الأول متوسط</option><option value="الثاني متوسط">الثاني متوسط</option><option value="الثالث متوسط">الثالث متوسط</option></select>
                <select value={section} onChange={(e) => setSection(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-4 text-right text-white">{[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}</select>
              </div>
            </div>
          )}
          {error && <div className="text-red-400 text-xs text-right bg-red-400/10 p-3 rounded-xl">{error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-[#bc13fe] text-white font-black py-4 rounded-2xl hover:opacity-90 shadow-2xl disabled:opacity-50 flex items-center justify-center gap-2">{loading ? "جاري المعالجة..." : "دخول المسابقة"}</button>
        </form>
      </motion.div>
    </div>
  );
}

function LiveReactions({ competitionId }: { competitionId: string }) {
  const [reactions, setReactions] = useState<{ id: string, type: string, x: number }[]>([]);

  useEffect(() => {
    const q = query(collection(db, `competitions/${competitionId}/reactions`), where("timestamp", ">", new Date(Date.now() - 10000).toISOString()));
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const id = change.doc.id;
          setReactions(prev => [...prev, { id, type: data.type, x: Math.random() * 80 + 10 }]);
          setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 4000);
        }
      });
    });
    return () => unsub();
  }, [competitionId]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div key={r.id} initial={{ y: "100vh", x: `${r.x}vw`, opacity: 1, scale: 0.5 }} animate={{ y: "-10vh", opacity: 0, scale: 2, rotate: Math.random() * 40 - 20 }} exit={{ opacity: 0 }} transition={{ duration: 4, ease: "easeOut" }} className="absolute text-5xl">
            {r.type === "heart" ? "❤️" : r.type === "clap" ? "👏" : "🎉"}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}


function WinnerAnnouncementCard({ winnerName, compTitle, prizeImageUrl, winnerPhotoUrl }: { winnerName: string, compTitle: string, prizeImageUrl?: string, winnerPhotoUrl?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-xl w-full mx-auto relative overflow-hidden rounded-[50px] border-2 border-[#ffd700]/30 shadow-2xl winner-card-bg p-1"
      dir="rtl"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#ffd700]/10 via-transparent to-transparent pointer-events-none" />
      
      {/* Top Header */}
      <div className="flex justify-between items-start p-8 relative z-10">
        <div className="flex flex-col items-center">
          <img src={LOGO_URL} alt="Ministry of Education" className="w-16 h-auto mb-2" />
          <span className="text-[8px] text-white/60 font-bold">وزارة التعليم</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="crown-shadow">
            <Trophy className="w-12 h-12 text-[#ffd700]" />
          </div>
        </div>
        <div className="text-left">
          <div className="text-[10px] text-[#ffd700] font-bold">مدرسة</div>
          <div className="text-sm font-black text-white">عماد الدين زنكي</div>
          <div className="text-[10px] text-white/60">المتوسطة</div>
        </div>
      </div>

      {/* Center Content */}
      <div className="text-center px-8 pb-12 relative z-10">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[#ffd700]" />
          <span className="text-[#ffd700] text-xs font-bold tracking-widest">الفائز في المسابقة</span>
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[#ffd700]" />
        </div>

        <h2 className="text-5xl md:text-6xl font-black mb-8 gold-text py-4 leading-tight">
          {winnerName}
        </h2>

        {/* Prize Section */}
        <div className="relative mt-12 mb-16">
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <Award className="w-48 h-48 text-[#ffd700]" />
          </div>
          
          <div className="flex flex-col items-center relative z-20">
            <div className="flex items-center gap-4 mb-6">
              <Star className="w-4 h-4 text-[#ffd700]" />
              <span className="text-xs font-bold text-white tracking-widest">الجائزة المستلمة</span>
              <Star className="w-4 h-4 text-[#ffd700]" />
            </div>

            <div className="relative group">
              {/* Pedestal */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-48 h-12 pedestal rounded-[50%]" />
              
              {/* Prize Image */}
              <div className="relative animate-float">
                {prizeImageUrl ? (
                  <img src={prizeImageUrl} alt="Prize" className="w-40 h-40 object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]" />
                ) : (
                  <Trophy className="w-32 h-32 text-[#ffd700] drop-shadow-lg" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Shield */}
        <div className="flex flex-col items-center">
          <div className="bg-[#12121c] border-2 border-[#ffd700] px-10 py-3 rounded-b-[30px] rounded-t-[10px] relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 text-[#ffd700] fill-[#ffd700]" />)}
            </div>
            <div className="text-[10px] text-[#ffd700] font-bold mb-1">مسابقة</div>
            <div className="text-xl font-black text-white">{compTitle}</div>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#ffd700]/5 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-0 w-24 h-24 bg-[#bc13fe]/5 rounded-full blur-3xl" />
    </motion.div>
  );
}

function WinnerCertificate({ winnerName, compTitle, date, prizeImageUrl }: { winnerName: string, compTitle: string, date: string, prizeImageUrl?: string }) {
  const certificateRef = React.useRef<HTMLDivElement>(null);
  const downloadCertificate = async () => {
    if (certificateRef.current) {
      const dataUrl = await toPng(certificateRef.current, { quality: 0.95 });
      const link = document.createElement('a');
      link.download = `شهادة_${winnerName}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div ref={certificateRef} className="w-[800px] h-[600px] bg-white p-12 relative overflow-hidden text-right shadow-2xl border-[15px] border-[#ffd700]" dir="rtl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ffd700]/5 rounded-full -mr-32 -mt-32" />
        <div className="relative z-10 h-full border-4 border-[#ffd700]/20 p-10 flex flex-col items-center justify-between">
          <div className="flex justify-between items-center w-full">
            <img src={LOGO_URL} className="w-24 h-auto" alt="Logo" />
            <h1 className="text-3xl font-black text-[#050508]">شهادة فوز وتميز</h1>
            <div className="w-24" />
          </div>
          <div className="text-center space-y-6">
            <p className="text-xl text-gray-600 font-bold">تتشرف إدارة المدرسة بمنح هذه الشهادة للبطل:</p>
            <h2 className="text-5xl font-black text-[#050508] py-4 bg-[#ffd700]/10 rounded-2xl">{winnerName}</h2>
            <p className="text-xl text-gray-600">لفوزه في مسابقة:</p>
            <h3 className="text-3xl font-black text-[#bc13fe]">« {compTitle} »</h3>
          </div>
          <div className="flex justify-between items-end w-full">
            <div className="text-right">
              <p className="text-sm text-gray-400">التاريخ: {date}</p>
              {prizeImageUrl && <img src={prizeImageUrl} className="w-24 h-24 object-contain mt-2" alt="Prize" />}
            </div>
            <div className="text-center opacity-30"><Medal className="w-16 h-16 text-[#00f3ff]" /><p className="text-[10px] font-bold">ختم المدرسة</p></div>
          </div>
        </div>
      </div>
      <button onClick={downloadCertificate} className="bg-[#ffd700] text-black font-black px-10 py-4 rounded-2xl shadow-xl hover:scale-105 transition-all flex items-center gap-2"><ExternalLink className="w-5 h-5" /> تحميل الشهادة</button>
    </div>
  );
}

function StudentInterface({ student, isAdmin }: { student: StudentProfile, isAdmin?: boolean }) {
  const [competition, setCompetition] = useState<CompetitionData | null>(null);
  const [qualifiedNames, setQualifiedNames] = useState<string[]>([]);
  const [shuffleIndex, setShuffleIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [multiAnswers, setMultiAnswers] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState("00:00");
  const [liveStats, setLiveStats] = useState({ totalAnswers: 0 });
  const [myAnswerData, setMyAnswerData] = useState<any>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "competitions"), (snap) => {
      if (!snap.empty) {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as CompetitionData));
        setCompetition(docs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (competition?.id) {
      const unsub = onSnapshot(collection(db, `competitions/${competition.id}/answers`), (snap) => {
        setLiveStats({ totalAnswers: snap.docs.length });
        const myDoc = snap.docs.find(d => d.id === student.uid);
        if (myDoc) {
          setSubmitted(true);
          setMyAnswerData(myDoc.data());
        }
      });
      return () => unsub();
    }
  }, [competition?.id, student.uid]);

  useEffect(() => {
    if (competition?.status === 'drawing') {
      const q = query(collection(db, `competitions/${competition.id}/answers`), where("isCorrect", "==", true));
      getDocs(q).then(snap => {
        const names = snap.docs.map(d => d.data().studentName);
        setQualifiedNames(names.length > 0 ? names : ["جاري السحب..."]);
      });
      const interval = setInterval(() => setShuffleIndex(p => (p + 1) % (qualifiedNames.length || 1)), 100);
      return () => clearInterval(interval);
    }
  }, [competition?.status, competition?.id, qualifiedNames.length]);

  useEffect(() => {
    if (competition?.status === 'active' && competition.endTime) {
      const timer = setInterval(() => {
        const diff = new Date(competition.endTime!).getTime() - Date.now();
        if (diff <= 0) setTimeLeft("00:00");
        else {
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setTimeLeft(`${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [competition]);

  const handleSendAnswer = async () => {
    const finalAnswer = competition?.questionType === "multi" ? multiAnswers.join(", ") : answer;
    if (!finalAnswer || !competition || submitted) return;
    const sAns = normalizeArabic(finalAnswer);
    const cAns = normalizeArabic(competition.correctAnswer || "");
    const isCorrect = competition.questionType === "text" ? sAns.includes(cAns) : sAns === cAns;
    
    await setDoc(doc(db, `competitions/${competition.id}/answers`, student.uid), {
      studentId: student.uid, studentName: student.name, grade: student.grade, section: student.section,
      answerText: finalAnswer, isCorrect, reviewed: true, timestamp: new Date().toISOString()
    });
  };

  if (isAdmin) return <AdminView />;
  
  // Handle Loading state
  if (!competition) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050508] text-white p-6" dir="rtl">
        <Trophy className="w-16 h-16 text-[#00f3ff] mb-6 opacity-20" />
        <h2 className="text-2xl font-bold mb-2">لا توجد مسابقات نشطة حالياً</h2>
        <p className="text-white/40 text-center">سيتم إظهار المسابقات هنا بمجرد بدئها من قبل الإدارة.</p>
        <button onClick={() => { auth.signOut(); localStorage.removeItem("eduwin_student"); window.location.reload(); }} className="mt-8 text-[#00f3ff] text-sm underline">تسجيل الخروج</button>
      </div>
    );
  }

  const now = Date.now();
  const startTime = competition.startTime ? new Date(competition.startTime).getTime() : 0;
  const isStarted = competition.isScheduled ? now >= startTime : true;

  if (!isStarted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050508] text-white p-6" dir="rtl">
        <Clock className="w-16 h-16 text-[#00f3ff] mb-6 animate-pulse" />
        <h2 className="text-3xl font-black mb-2">المسابقة لم تبدأ بعد</h2>
        <p className="text-white/40">موعد البدء: {new Date(competition.startTime!).toLocaleString('ar-SA')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4 bg-[#050508] text-white overflow-x-hidden">
      <header className="h-20 flex justify-between items-center bg-[#0a0a12]/80 border border-[#00f3ff]/20 rounded-3xl px-8 shadow-2xl mb-4" dir="rtl">
        <div className="flex items-center gap-4">
          <img src={LOGO_URL} className="w-10 h-auto" alt="Logo" />
          <div className="text-right">
            <div className="font-bold">{student.name}</div>
            <div className="text-[10px] text-white/40">{student.grade} - فصل {student.section}</div>
          </div>
        </div>
        <button onClick={() => { auth.signOut(); localStorage.removeItem("eduwin_student"); window.location.reload(); }} className="p-2 rounded-xl bg-white/5 hover:text-red-500 transition-all"><X className="w-5 h-5" /></button>
      </header>

      <main className="flex-grow flex flex-col gap-4">
        {competition.status === "active" && (
          <div className="flex-grow flex flex-col lg:grid lg:grid-cols-[300px_1fr] gap-4" dir="rtl">
            <aside className="bg-[#0a0a12] p-6 rounded-[32px] border border-white/5 flex flex-col gap-6">
              <div className="bg-black/40 p-6 rounded-2xl text-center border-2 border-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.2)]">
                <span className="text-[10px] text-[#00f3ff] font-bold block mb-1">الوقت المتبقي</span>
                <div className="text-5xl font-black text-[#00f3ff]">{timeLeft}</div>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
                <span className="text-white/40">المشاركين</span>
                <span className="font-bold text-[#00f3ff]">{liveStats.totalAnswers}</span>
              </div>
            </aside>
            <div className="bg-[#0a0a12]/50 p-8 rounded-[40px] border border-white/5 flex flex-col items-center justify-center text-center">
              {!submitted ? (
                <>
                  <div className="bg-[#bc13fe]/10 text-[#bc13fe] px-4 py-1 rounded-full text-[10px] font-black mb-6 border border-[#bc13fe]/20">المسابقة نشطة الآن</div>
                  {competition.questionImageUrl && <img src={competition.questionImageUrl} className="max-h-[300px] rounded-2xl mb-6 shadow-2xl" alt="Q" />}
                  <h2 className="text-2xl md:text-4xl font-black mb-10 leading-tight">{competition.question}</h2>
                  <div className="w-full max-w-xl space-y-6">
                    {competition.questionType === "text" ? (
                      <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xl text-right outline-none focus:border-[#bc13fe]" placeholder="اكتب إجابتك هنا" />
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {competition.options?.map((opt, i) => (
                          <button key={i} onClick={() => competition.questionType === "multi" ? setMultiAnswers(p => p.includes(opt) ? p.filter(x => x !== opt) : [...p, opt]) : setAnswer(opt)} className={cn("p-4 rounded-xl border-2 transition-all font-bold", (competition.questionType === "multi" ? multiAnswers.includes(opt) : answer === opt) ? "bg-[#00f3ff]/20 border-[#00f3ff] text-white" : "bg-white/5 border-white/5 text-white/40")}>{opt}</button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setIsConfirming(true)} className="w-full bg-[#bc13fe] text-white font-black py-5 rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">إرسال المشاركة</button>
                  </div>
                </>
              ) : (
                <div className="py-20 flex flex-col items-center">
                  <CheckCircle className="w-20 h-20 text-green-500 mb-6 animate-bounce" />
                  <h3 className="text-3xl font-black mb-2">تم استلام إجابتك!</h3>
                  <p className="text-white/40">سيتم إعلان الفائز عند انتهاء الوقت، حظاً موفقاً!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {competition.status === "drawing" && (
          <div className="flex-grow flex flex-col items-center justify-center p-10 bg-[#0a0a12] rounded-[40px] border border-[#bc13fe]/20 relative overflow-hidden">
            <LiveReactions competitionId={competition.id} />
            <h2 className="text-4xl font-black text-white mb-2">ترقّبوا بطل المسابقة!</h2>
            <div className="w-full max-w-2xl h-40 bg-black/60 rounded-[40px] border-2 border-white/10 flex items-center justify-center text-4xl md:text-6xl font-black text-white mb-12 shadow-[0_0_50px_rgba(188,19,254,0.2)]">
              {qualifiedNames[shuffleIndex]}
            </div>
            <div className="flex gap-4">
              {["heart", "clap", "celebrate"].map(t => (
                <button key={t} onClick={() => { SOUNDS.click.play(); sendReaction(competition.id, t); }} className="p-6 bg-white/5 rounded-3xl border border-white/10 hover:bg-white/10 transition-all active:scale-90 text-3xl">
                  {t === "heart" ? "❤️" : t === "clap" ? "👏" : "🎉"}
                </button>
              ))}
            </div>
          </div>
        )}

        {competition.status === "finished" && (
          <div className="flex-grow flex flex-col items-center justify-center p-6 space-y-12" dir="rtl">
            <WinnerAnnouncementCard 
              winnerName={competition.winnerName || ""} 
              compTitle={competition.title} 
              prizeImageUrl={competition.prizeImageUrl} 
            />

            {myAnswerData && (
              <div className={cn("max-w-xl w-full p-6 rounded-3xl border text-center", myAnswerData.isCorrect ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-red-500/10 border-red-500/20 text-red-500")}>
                <div className="font-black text-xl">{myAnswerData.isCorrect ? "مبروك! إجابتك صحيحة ودخلت السحب" : "حظاً موفقاً! إجابتك لم تكن صحيحة"}</div>
                <div className="text-white/40 text-sm mt-2">الإجابة الصحيحة: {competition.correctAnswer}</div>
              </div>
            )}

            {student.uid === competition.winnerId && (
              <div className="w-full max-w-4xl border-t border-white/5 pt-12">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-black text-white">شهادتك الرقمية</h3>
                  <p className="text-white/40">احتفظ بنسخة من شهادة فوزك في المسابقة</p>
                </div>
                <WinnerCertificate 
                  winnerName={student.name} 
                  compTitle={competition.title} 
                  date={new Date().toLocaleDateString('ar-SA')} 
                  prizeImageUrl={competition.prizeImageUrl} 
                />
              </div>
            )}
          </div>
        )}
      </main>

      <AnimatePresence>
        {isConfirming && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#0a0a12] border border-[#bc13fe]/30 p-8 rounded-[32px] max-w-md w-full text-center">
              <AlertCircle className="w-16 h-16 text-[#bc13fe] mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-6">هل أنت متأكد من إرسال الإجابة؟</h3>
              <div className="flex gap-4">
                <button onClick={() => { setIsConfirming(false); handleSendAnswer(); }} className="flex-1 bg-[#bc13fe] text-white font-bold py-4 rounded-2xl">نعم، أرسل</button>
                <button onClick={() => setIsConfirming(false)} className="flex-1 bg-white/5 text-white font-bold py-4 rounded-2xl">تراجع</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminView() {
  const [competition, setCompetition] = useState<CompetitionData | null>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComp, setNewComp] = useState<Partial<CompetitionData>>({ title: "", question: "", questionType: "text", options: [], isScheduled: false });
  const [options, setOptions] = useState<string[]>(["", ""]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "competitions"), (snap) => {
      if (!snap.empty) {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as CompetitionData));
        setCompetition(docs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (competition?.id) {
      const unsub = onSnapshot(collection(db, `competitions/${competition.id}/answers`), (snap) => setAnswers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      return () => unsub();
    }
  }, [competition?.id]);

  const handleCreate = async () => {
    if (!newComp.title || !newComp.question) return alert("أكمل البيانات");
    setLoading(true);
    const id = "comp_" + Date.now();
    await setDoc(doc(db, "competitions", id), {
      ...newComp, id, status: "active", createdAt: new Date().toISOString(),
      endTime: newComp.isScheduled ? newComp.endTime : new Date(Date.now() + 3600000).toISOString(),
      startTime: newComp.isScheduled ? newComp.startTime : new Date().toISOString(),
      options: options.filter(o => o.trim() !== "")
    });
    setLoading(false);
    setNewComp({ title: "", question: "", questionType: "text", options: [], isScheduled: false, startTime: "", endTime: "" });
  };

  const handleStartDraw = async () => {
    if (competition) await setDoc(doc(db, "competitions", competition.id), { status: "drawing" }, { merge: true });
  };

  const finalizeWinner = async (winner: any, fallback: boolean = false) => {
    if (competition) {
      await setDoc(doc(db, "competitions", competition.id), {
        status: "finished", winnerId: winner.studentId, winnerName: winner.studentName,
        winnerGrade: winner.grade, winnerSection: winner.section,
        note: fallback ? "تم السحب من جميع المشاركين (لا توجد إجابات صحيحة)" : ""
      }, { merge: true });
      confetti({ particleCount: 200, spread: 100 });
      SOUNDS.celebration.play().catch(() => {});
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(answers.map(a => ({ "الاسم": a.studentName, "الإجابة": a.answerText, "الحالة": a.isCorrect ? "صح" : "خطأ" })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Answers");
    XLSX.writeFile(wb, "results.xlsx");
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10 space-y-10" dir="rtl">
      <div className="flex justify-between items-center bg-[#0a0a12] p-8 rounded-[32px] border border-white/5">
        <h1 className="text-3xl font-black text-white">لوحة الإدارة</h1>
        <button onClick={exportToExcel} className="bg-green-500 text-black font-bold px-6 py-2 rounded-xl">تصدير Excel</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
        <div className="space-y-8">
          <section className="bg-[#0a0a12] p-8 rounded-[40px] border border-white/5 space-y-6">
            <h2 className="text-xl font-bold text-[#bc13fe]">إنشاء مسابقة جديدة</h2>
            <input type="text" value={newComp.title} onChange={e => setNewComp({...newComp, title: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-right text-white" placeholder="عنوان المسابقة" />
            <textarea value={newComp.question} onChange={e => setNewComp({...newComp, question: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-right text-white min-h-[120px]" placeholder="نص السؤال" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-[10px] text-[#00f3ff] font-bold block text-right">رابط صورة السؤال (اختياري)</span>
                <input type="text" value={newComp.questionImageUrl} onChange={e => setNewComp({...newComp, questionImageUrl: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-right text-white text-xs" placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] text-[#ffd700] font-bold block text-right">رابط صورة الجائزة (اختياري)</span>
                <input type="text" value={newComp.prizeImageUrl} onChange={e => setNewComp({...newComp, prizeImageUrl: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-right text-white text-xs" placeholder="https://..." />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {["text", "mcq", "multi"].map(t => (
                <button key={t} onClick={() => setNewComp({...newComp, questionType: t as any})} className={cn("py-2 rounded-xl border text-xs font-bold", newComp.questionType === t ? "border-[#bc13fe] bg-[#bc13fe]/10 text-white" : "border-white/5 text-white/40")}>{t === "text" ? "مقالي" : t === "mcq" ? "خيار واحد" : "خيارات"}</button>
              ))}
            </div>
            {newComp.questionType !== "text" && (
              <div className="space-y-2">
                {options.map((o, i) => (
                  <input key={i} value={o} onChange={e => { const no = [...options]; no[i] = e.target.value; setOptions(no); }} className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-right text-sm" placeholder={`خيار ${i+1}`} />
                ))}
                <button onClick={() => setOptions([...options, ""])} className="text-xs text-[#00f3ff]">+ إضافة خيار</button>
              </div>
            )}
            <input type="text" value={newComp.correctAnswer} onChange={e => setNewComp({...newComp, correctAnswer: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-right text-white" placeholder="الإجابة الصحيحة (للتصحيح الآلي)" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 p-6 rounded-3xl border border-white/5">
               <div className="flex flex-row-reverse items-center gap-3">
                  <input type="checkbox" checked={newComp.isScheduled} onChange={e => setNewComp({...newComp, isScheduled: e.target.checked})} className="w-5 h-5 accent-[#bc13fe]" />
                  <span className="text-xs font-bold text-white/40">تفعيل الجدولة التلقائية</span>
               </div>
               {newComp.isScheduled && (
                 <>
                   <div className="space-y-2">
                     <span className="text-[10px] text-white/20 block text-right">وقت البدء</span>
                     <input type="datetime-local" value={newComp.startTime} onChange={e => setNewComp({...newComp, startTime: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-white text-xs" />
                   </div>
                   <div className="space-y-2">
                     <span className="text-[10px] text-white/20 block text-right">وقت الانتهاء</span>
                     <input type="datetime-local" value={newComp.endTime} onChange={e => setNewComp({...newComp, endTime: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-white text-xs" />
                   </div>
                 </>
               )}
            </div>

            <button onClick={handleCreate} disabled={loading} className="w-full bg-[#bc13fe] text-white font-black py-5 rounded-2xl shadow-xl">{loading ? "جاري الإرسال..." : "إطلاق المسابقة"}</button>
          </section>
        </div>

        <div className="space-y-8">
          {competition ? (
            <div className="bg-[#0a0a12] p-8 rounded-[40px] border border-white/10">
              <h3 className="font-bold mb-4 text-[#00f3ff]">{competition.title}</h3>
              {competition.status === "active" ? (
                <button onClick={handleStartDraw} className="w-full bg-[#bc13fe] text-white py-4 rounded-2xl font-black mb-4">بدء مرحلة السحب</button>
              ) : competition.status === "drawing" ? (
                <div className="space-y-4">
                  <div className="text-center text-white/40 text-xs animate-pulse">جاري السحب المباشر...</div>
                  <button 
                    onClick={() => {
                      const qualified = answers.filter(a => a.isCorrect);
                      const isFallback = qualified.length === 0;
                      const source = isFallback ? answers : qualified;
                      if (source.length === 0) return alert("لا يوجد مشاركون");
                      finalizeWinner(source[Math.floor(Math.random() * source.length)], isFallback);
                    }} 
                    className="w-full bg-[#00f3ff] text-black py-4 rounded-2xl font-black"
                  >
                    اختيار فائز الآن
                  </button>
                </div>
              ) : (
                <div className="text-center p-4 bg-green-500/10 rounded-2xl border border-green-500/20 text-green-500 font-bold">انتهت | الفائز: {competition.winnerName}</div>
              )}
              <div className="mt-8 space-y-2">
                <div className="flex justify-between text-xs text-white/40"><span className="font-bold text-white">{answers.length}</span><span>إجمالي المشاركات</span></div>
                <div className="flex justify-between text-xs text-white/40"><span className="font-bold text-green-500">{answers.filter(a => a.isCorrect).length}</span><span>إجابات صحيحة</span></div>
              </div>
            </div>
          ) : <div className="p-10 border border-dashed border-white/10 rounded-[40px] text-center text-white/10">لا مسابقة حالياً</div>}
          
          <div className="bg-[#0a0a12] rounded-[32px] border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 font-bold text-xs text-white/40 text-right">أحدث المشاركات</div>
            <div className="max-h-[400px] overflow-y-auto divide-y divide-white/5">
              {answers.map(a => (
                <div key={a.id} className="p-4 flex justify-between items-center bg-black/20">
                  <div className={cn("w-2 h-2 rounded-full", a.isCorrect ? "bg-green-500" : "bg-red-500")} />
                  <div className="text-right"><div className="text-xs font-bold">{a.studentName}</div><div className="text-[10px] text-white/40">{a.answerText}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("eduwin_student");
    if (saved) setStudent(JSON.parse(saved));
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        if (adminDoc.exists()) setIsAdmin(true);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <LoadingScreen />;
  if (!student) return <LoginPage onLogin={setStudent} />;
  return <StudentInterface student={student} isAdmin={isAdmin} />;
}
