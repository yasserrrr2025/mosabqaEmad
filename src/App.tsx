import { useState, useEffect, FormEvent } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, onSnapshot, setDoc, query, collection, where, getDocs, getDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, LogIn, LayoutDashboard, Send, Clock, AlertCircle, ExternalLink, Users, CheckCircle, Trash2, Plus, Check, ChevronLeft, ChevronRight, X, Award, History, TrendingUp, Medal, Star, Camera } from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "./lib/utils";

const LOGO_URL = "https://upload.wikimedia.org/wikipedia/ar/1/17/Saudi_Ministry_of_Education_Logo_2025.png";

// --- Types ---
type QuestionType = "text" | "image" | "mcq" | "multi";

interface CompetitionData {
  id: string;
  title: string;
  question: string;
  questionType: QuestionType;
  questionImageUrl?: string;
  options?: string[]; // For MCQ/Multi
  prizeImageUrl?: string;
  adImageUrl?: string;
  adLink?: string;
  status: "idle" | "active" | "drawing" | "finished";
  endTime?: string;
  winnerId?: string;
  winnerName?: string;
  winnerGrade?: string;
  winnerSection?: string;
  winnerPhotoUrl?: string; // New: Honoring Photo
  note?: string;
  createdAt?: string; // Required for sorting
}

interface StudentProfile {
  nationalId: string;
  name: string;
  uid: string;
  grade?: string;
  section?: string;
}

interface PastWinner {
  id: string;
  compTitle: string;
  winnerName: string;
  winnerGrade: string;
  winnerSection: string;
  prizeImageUrl?: string;
  winnerPhotoUrl?: string; // New: Honoring Photo
  date: string;
}

// --- Components ---

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-dark-bg flex items-center justify-center z-50">
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="flex flex-col items-center"
      >
        <Trophy className="w-16 h-16 text-neon-cyan mb-4" />
        <h2 className="text-2xl font-bold neon-glow-cyan">جاري التحميل...</h2>
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
    
    try {
      if (mode === "register") {
        // التحقق من تكرار التسجيل بنفس رقم الهوية
        const q = query(collection(db, "students"), where("nationalId", "==", nationalId));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          setError("هذا الرقم مسجل مسبقاً، يرجى تسجيل الدخول بدلاً من التسجيل");
          setLoading(false);
          return;
        }

        let uid;
        try {
          const userCred = await signInAnonymously(auth);
          uid = userCred.user.uid;
        } catch (authErr: any) {
          console.warn("Firebase Auth blocked:", authErr.message);
          // Fallback to a deterministic ID if Anonymous Auth is disabled in console
          uid = "std_" + btoa(nationalId).replace(/=/g, "");
        }

        const studentData = { 
          nationalId, 
          name, 
          grade, 
          section, 
          createdAt: new Date().toISOString(), 
          uid 
        };
        await setDoc(doc(db, "students", uid), studentData);
        localStorage.setItem("eduwin_student", JSON.stringify(studentData));
        onLogin(studentData);
      } else {
        // تسجيل الدخول برقم الهوية
        const q = query(collection(db, "students"), where("nationalId", "==", nationalId));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          setError("هذا الرقم غير مسجل، يرجى إنشاء حساب جديد أولاً");
          setLoading(false);
          return;
        }

        const studentData = snap.docs[0].data() as StudentProfile;
        
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.warn("Login Auth fallback used");
        }

        localStorage.setItem("eduwin_student", JSON.stringify(studentData));
        onLogin(studentData);
      }
    } catch (err: any) {
      console.error(err);
      setError("حدث خطأ أثناء العملية: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-dark-surface p-8 rounded-2xl border border-neon-purple/30 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-purple via-neon-cyan to-neon-purple animate-pulse" />
        
        <div className="text-center mb-8">
          <img 
            src={LOGO_URL} 
            alt="Logo" 
            className="w-32 h-auto mx-auto mb-6 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" 
            referrerPolicy="no-referrer"
          />
          <h1 className="text-2xl font-bold neon-glow-cyan mb-2 tracking-tight">مسابقة عماد الدين زنكي المتوسطة</h1>
          <p className="text-white/60">شارك في المسابقات الطلابية الكبرى</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-black/40 rounded-xl p-1 mb-8 gap-1">
          <button
            onClick={() => setMode("register")}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
              mode === "register" ? "bg-neon-purple text-white shadow-lg" : "text-white/40 hover:text-white/70"
            )}
          >
            تسجيل جديد
          </button>
          <button
            onClick={() => setMode("login")}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
              mode === "login" ? "bg-neon-purple text-white shadow-lg" : "text-white/40 hover:text-white/70"
            )}
          >
            دخول (بالهوية)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold mb-2 text-neon-cyan/80 text-right uppercase tracking-wider">رقم الهوية</label>
            <input
              type="text"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              className="w-full bg-black/30 border-2 border-white/10 rounded-xl px-4 py-3 focus:border-neon-purple outline-none transition-all text-right"
              placeholder="أدخل رقم الهوية هنا"
            />
          </div>
          
          {mode === "register" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-6"
            >
              <div>
                <label className="block text-sm font-bold mb-2 text-neon-cyan/80 text-right uppercase tracking-wider">الاسم الثلاثي</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/30 border-2 border-white/10 rounded-xl px-4 py-3 focus:border-neon-purple outline-none transition-all text-right"
                  placeholder="أدخل اسمك الكامل"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2 text-neon-cyan/80 text-right uppercase tracking-wider">الفصل</label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full bg-black/30 border-2 border-white/10 rounded-xl px-4 py-3 focus:border-neon-purple outline-none transition-all text-right text-white"
                  >
                    {[1,2,3,4,5,6,7,8,9].map(n => (
                      <option key={n} value={n.toString()}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-neon-cyan/80 text-right uppercase tracking-wider">الصف</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full bg-black/30 border-2 border-white/10 rounded-xl px-4 py-3 focus:border-neon-purple outline-none transition-all text-right text-white"
                  >
                    <option value="الأول متوسط">الأول متوسط</option>
                    <option value="الثاني متوسط">الثاني متوسط</option>
                    <option value="الثالث متوسط">الثالث متوسط</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg justify-end border border-red-400/20 text-right">
              <span>{error}</span>
              <AlertCircle className="w-4 h-4" />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-neon-purple text-white font-bold py-4 rounded-xl hover:opacity-90 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(188,19,254,0.3)]"
          >
            {loading ? "جاري المعالجة..." : (
              <>
                <LogIn className="w-5 h-5" />
                <span>{mode === "register" ? "إكمال التسجيل" : "دخول المسابقة"}</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function StudentInterface({ student, isAdmin }: { student: StudentProfile, isAdmin?: boolean }) {
  const [activeTab, setActiveTab] = useState<"live" | "honor" | "hall">("live");
  const [competition, setCompetition] = useState<CompetitionData | null>(null);
  const [qualifiedNames, setQualifiedNames] = useState<string[]>([]);
  const [shuffleIndex, setShuffleIndex] = useState(0);

  useEffect(() => {
    if (competition?.status === 'drawing') {
      const q = query(
        collection(db, `competitions/${competition.id}/answers`),
        where("isCorrect", "==", true)
      );
      getDocs(q).then(snap => {
        let names = snap.docs.map(d => d.data().studentName);
        if (names.length === 0) {
           // Fallback if no correct answers
           getDocs(collection(db, `competitions/${competition.id}/answers`)).then(s => {
             setQualifiedNames(s.docs.map(d => d.data().studentName));
           });
        } else {
          setQualifiedNames(names);
        }
      });
    }
  }, [competition?.status, competition?.id]);

  useEffect(() => {
    let interval: any;
    if (competition?.status === 'drawing' && qualifiedNames.length > 0) {
      interval = setInterval(() => {
        setShuffleIndex(prev => (prev + 1) % qualifiedNames.length);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [competition?.status, qualifiedNames]);
  useEffect(() => {
    if (competition?.status === 'finished') {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#00f3ff", "#bc13fe", "#ffd700"]
      });
    }
  }, [competition?.status]);

  const [answer, setAnswer] = useState("");
  const [multiAnswers, setMultiAnswers] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("00:00");
  const [qualifiedStudents, setQualifiedStudents] = useState<{ id: string, name: string }[]>([]);
  const [pastWinners, setPastWinners] = useState<PastWinner[]>([]);
  const [topStudents, setTopStudents] = useState<any[]>([]);

  // منع النسخ وتصوير الشاشة المتكرر (مستوى الـ DOM)
  useEffect(() => {
    const preventActions = (e: any) => {
      if (e.type === 'contextmenu' || e.type === 'copy' || e.type === 'selectstart') {
        e.preventDefault();
      }
    };
    
    // محاكاة حماية ضد لقطات الشاشة (فقط تنبيه أو تعتيم)
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // يمكن إضافة تعتيم هنا إذا لزم الأمر
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // منع PrintScreen, Ctrl+C, Ctrl+V, F12
      if (
        e.key === 'PrintScreen' || 
        (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 's')) || 
        e.key === 'F12'
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', preventActions);
    window.addEventListener('copy', preventActions);
    window.addEventListener('selectstart', preventActions);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('contextmenu', preventActions);
      window.removeEventListener('copy', preventActions);
      window.removeEventListener('selectstart', preventActions);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    // Fetch all competitions to find the most recent one
    const unsub = onSnapshot(collection(db, "competitions"), (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CompetitionData));
        // Sort by createdAt (latest first)
        const sorted = docs.sort((a, b) => {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        setCompetition(sorted[0]);
      } else {
        setCompetition(null);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "competitions"), where("status", "==", "finished")), (snapshot) => {
      const winners = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          compTitle: data.title,
          winnerName: data.winnerName,
          winnerGrade: data.winnerGrade,
          winnerSection: data.winnerSection,
          prizeImageUrl: data.prizeImageUrl,
          winnerPhotoUrl: data.winnerPhotoUrl, // Fetch photo URL
          date: data.endTime || data.createdAt
        } as PastWinner;
      });
      setPastWinners(winners.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Generate some mock top students for "Honor Roll"
    const unsub = onSnapshot(collection(db, "students"), (snapshot) => {
      const studs = snapshot.docs.map(d => d.data());
      setTopStudents(studs.slice(0, 10)); // Take first 10 for display
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (competition && student) {
      const checkStatus = async () => {
        const answerDoc = await getDoc(doc(db, `competitions/${competition.id}/answers`, student.uid));
        if (answerDoc.exists()) {
          setSubmitted(true);
          setAnswer(answerDoc.data().answerText);
        } else {
          setSubmitted(false);
          setAnswer("");
        }
      };
      checkStatus();
    }
  }, [competition?.id, student?.uid]);

  useEffect(() => {
    if (!competition || competition.status !== "active" || !competition.endTime) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(competition.endTime!).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("00:00");
        clearInterval(timer);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [competition]);

  useEffect(() => {
    if (competition?.status === "drawing") {
      const loadQualified = async () => {
         const q = query(collection(db, `competitions/${competition.id}/answers`), where("isCorrect", "==", true));
         const snap = await getDocs(q);
         const students = snap.docs.map(d => ({ id: d.id, name: d.data().studentName }));
         setQualifiedStudents(students);
      };
      loadQualified();
    }
  }, [competition?.status, competition?.id]);

  const handleSendAnswer = async () => {
    const finalAnswer = competition?.questionType === "multi" ? multiAnswers.join(", ") : answer;
    if (!finalAnswer || !competition || submitted) return;
    try {
      await setDoc(doc(db, `competitions/${competition.id}/answers`, student.uid), {
        studentId: student.uid,
        studentName: student.name,
        grade: student.grade || "غير محدد",
        section: student.section || "غير محدد",
        answerText: finalAnswer,
        timestamp: new Date().toISOString(),
        isCorrect: false,
        reviewed: false
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleMultiOption = (opt: string) => {
    setMultiAnswers(prev => 
      prev.includes(opt) ? prev.filter(a => a !== opt) : [...prev, opt]
    );
  };

  if (isAdmin) {
    return <AdminView />;
  }

  if (!competition) {
    return (
      <div className="min-h-screen flex flex-col p-5 gap-4">
        <header className="h-20 flex justify-between items-center bg-[rgba(20,20,35,0.8)] border border-neon-cyan/20 rounded-xl px-8 shadow-2xl" dir="rtl">
          <div className="flex items-center gap-4">
            <img 
              src={LOGO_URL} 
              alt="Logo" 
              className="w-10 h-auto drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]" 
              referrerPolicy="no-referrer"
            />
            <div className="text-right">
              <div className="font-bold text-base">{student.name}</div>
              <div className="text-[12px] opacity-60">
                {student.grade} - فصل: {student.section}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <span className="text-sm opacity-80">الحالة: متصل</span>
            <span className="bg-green-500/20 text-green-500 text-[11px] font-bold px-3 py-1 rounded">بث مباشر</span>
          </div>
        </header>

        <div className="flex-grow flex flex-col items-center justify-center text-center p-6 bg-dark-surface/30 rounded-3xl border border-white/5">
          <Clock className="w-20 h-20 text-white/20 mb-6" />
          <h2 className="text-3xl font-bold text-white/40">لا توجد مسابقات جارية حالياً</h2>
          <p className="text-white/30 mt-2">يرجى الانتظار حتى تبدأ الإدارة المسابقة</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-5 gap-4">
      {/* Header / Top Nav */}
      <header className="h-20 flex justify-between items-center bg-[rgba(20,20,35,0.8)] border border-neon-cyan/20 rounded-xl px-8 shadow-2xl" dir="rtl">
        <div className="flex items-center gap-4">
          <img 
            src={LOGO_URL} 
            alt="Logo" 
            className="w-10 h-auto drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]" 
            referrerPolicy="no-referrer"
          />
          <div className="text-right">
            <div className="font-bold text-base">{student.name}</div>
            <div className="text-[12px] opacity-60">
              {student.grade} - فصل: {student.section}
            </div>
          </div>
        </div>

        {(competition.prizeImageUrl || competition.title) && (
          <div className="hidden md:flex items-center gap-4 bg-accent-gold/10 px-5 py-2 rounded-[50px] border border-accent-gold max-w-[40%]">
            <Trophy className="w-6 h-6 text-accent-gold flex-shrink-0" />
            <div className="flex items-center gap-2 overflow-hidden">
              {competition.prizeImageUrl && (
                <img 
                  src={competition.prizeImageUrl} 
                  alt="Prize" 
                  className="w-8 h-8 rounded-full object-cover border border-accent-gold/50"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="font-bold text-accent-gold truncate text-sm">الجائزة: {competition.title}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-5">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">الحالة</span>
            <span className="text-green-500 text-xs font-bold flex items-center gap-1">
              متصل الآن
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            </span>
          </div>
          
          <button 
            onClick={() => {
              auth.signOut();
              localStorage.removeItem("eduwin_student");
              window.location.reload();
            }}
            className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-red-500 hover:bg-red-500/10 transition-all border border-white/5"
            title="تسجيل الخروج"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex flex-row-reverse items-center justify-center gap-2 p-1 bg-dark-surface/50 backdrop-blur-md rounded-2xl border border-white/5 w-fit mx-auto">
        <button 
          onClick={() => setActiveTab("live")}
          className={cn(
            "flex flex-row-reverse items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all text-sm",
            activeTab === "live" ? "bg-neon-cyan text-black shadow-[0_0_15px_rgba(0,243,255,0.3)]" : "text-white/40 hover:text-white/70"
          )}
        >
          <TrendingUp className="w-4 h-4" />
          البث المباشر
        </button>
        <button 
          onClick={() => setActiveTab("honor")}
          className={cn(
            "flex flex-row-reverse items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all text-sm",
            activeTab === "honor" ? "bg-neon-purple text-white shadow-[0_0_15px_rgba(188,19,254,0.3)]" : "text-white/40 hover:text-white/70"
          )}
        >
          <Award className="w-4 h-4" />
          لوحة الشرف
        </button>
        <button 
          onClick={() => setActiveTab("hall")}
          className={cn(
            "flex flex-row-reverse items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all text-sm",
            activeTab === "hall" ? "bg-accent-gold text-black shadow-[0_0_15px_rgba(255,215,0,0.3)]" : "text-white/40 hover:text-white/70"
          )}
        >
          <Medal className="w-4 h-4" />
          أبطال المسابقات
        </button>
      </nav>

      {/* Live Winners Ticker */}
      <div className="bg-black/40 border-y border-white/5 overflow-hidden py-2">
        <motion.div 
          animate={{ x: [1000, -2000] }}
          transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
          className="whitespace-nowrap flex gap-10"
        >
          {pastWinners.length > 0 ? pastWinners.map((w, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <Star className="w-4 h-4 text-accent-gold animate-spin-slow" />
              <span className="text-white/60">مبروك للبطل:</span>
              <span className="text-neon-cyan font-bold">{w.winnerName}</span>
              <span className="text-white/20">|</span>
              <span className="text-white/60">الفائز بمسابقة:</span>
              <span className="text-accent-gold font-bold">{w.compTitle}</span>
            </div>
          )) : (
            <div className="flex items-center gap-3 text-sm">
              <Star className="w-4 h-4 text-accent-gold" />
              <span className="text-white/40">مرحباً بكم في مسابقة عماد الدين زنكي المتوسطة.. بالتوفيق لجميع الأبطال!</span>
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "live" && (
          <motion.div 
            key="live-tab"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex-grow grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4"
          >
        {/* Sidebar */}
        <aside className="bg-dark-surface rounded-2xl border border-white/5 p-5 flex flex-col gap-5 order-2 lg:order-1">
          <div className="bg-black rounded-xl p-5 text-center border-2 border-neon-cyan shadow-[0_0_15px_rgba(0,243,255,0.3)]">
            <span className="text-[12px] uppercase text-neon-cyan tracking-[2px] mb-1 block">الوقت المتبقي</span>
            <div className="text-5xl font-bold digital-font text-neon-cyan neon-glow-cyan">{timeLeft}</div>
          </div>

          <div>
            <h3 className="text-[14px] text-neon-purple uppercase mb-4 tracking-[1px] font-bold text-right">إحصائيات المسابقة</h3>
            <ul className="space-y-3">
              <li className="flex flex-row-reverse justify-between py-3 border-b border-white/5 text-sm">
                <span>الطلاب المشاركين</span>
                <span className="text-neon-cyan font-bold">1,248</span>
              </li>
              <li className="flex flex-row-reverse justify-between py-3 border-b border-white/5 text-sm">
                <span>إجابات صحيحة</span>
                <span className="text-neon-cyan font-bold">452</span>
              </li>
            </ul>
          </div>

          <div className="mt-auto bg-white/5 p-4 rounded-xl text-xs leading-relaxed text-right border border-neon-purple/20">
            <strong className="text-neon-purple block mb-1">تنبيه الإدارة:</strong>
            سيتم تفعيل السحب الآلي فور انتهاء العداد. تأكد من صحة إجابتك قبل الإرسال.
          </div>
        </aside>

        {/* Main Stage */}
        <main className="flex flex-col gap-4 order-1 lg:order-2">
          <AnimatePresence mode="wait">
            {competition.status === "active" && (
              <motion.div
                key="active"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-grow flex flex-col bg-dark-surface/30 backdrop-blur-xl rounded-[40px] border border-white/5 p-10 shadow-2xl relative overflow-hidden"
              >
                {/* Visual Accent */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/5 rounded-full blur-[80px] -mr-32 -mt-32" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-neon-cyan/5 rounded-full blur-[80px] -ml-32 -mb-32" />

                <div className="relative z-10 flex flex-col items-center">
                  <div className="inline-flex items-center gap-3 bg-neon-purple/10 text-neon-purple px-5 py-2 rounded-full text-xs font-black uppercase tracking-[3px] border border-neon-purple/20 mb-8">
                    <div className="w-2 h-2 rounded-full bg-neon-purple animate-pulse" />
                    المسابقة جارية الآن
                  </div>
                  
                  {competition.questionImageUrl && (
                    <motion.div 
                      layoutId="q-img"
                      className="relative mb-10 group"
                    >
                      <div className="absolute inset-0 bg-neon-cyan/20 blur-2xl opacity-0 group-hover:opacity-100 transition-all" />
                      <img 
                        src={competition.questionImageUrl} 
                        alt="Question" 
                        className="max-h-[350px] w-auto rounded-3xl border-4 border-white/5 shadow-2xl relative z-10 transform transition-transform group-hover:scale-[1.02]"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  )}

                  <h3 className="text-3xl md:text-4xl font-black leading-tight mb-12 max-w-[900px] text-center text-white selection:bg-neon-cyan selection:text-black">
                    {competition.question}
                  </h3>

                  {!submitted ? (
                    <div className="w-full max-w-[800px] flex flex-col gap-8">
                      {/* Interactive Answer Area */}
                      <div className="p-8 bg-black/40 rounded-[32px] border border-white/10 shadow-inner">
                        {competition.questionType === "text" && (
                          <div className="flex flex-col gap-4">
                            <label className="text-xs font-bold text-white/30 uppercase tracking-widest text-right">أدخل إجابتك بدقة</label>
                            <input
                              type="text"
                              value={answer}
                              onChange={(e) => setAnswer(e.target.value)}
                              placeholder="أجب هنا..."
                              className="w-full bg-white/5 border-2 border-white/5 rounded-2xl px-6 py-5 text-white text-xl outline-none focus:border-neon-purple transition-all text-right shadow-[0_0_20px_rgba(0,0,0,0.3)]"
                            />
                          </div>
                        )}

                        {(competition.questionType === "mcq" || competition.questionType === "multi") && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {competition.options?.map((opt, i) => {
                              const isSelected = competition.questionType === "multi" ? multiAnswers.includes(opt) : answer === opt;
                              return (
                                <button
                                  key={i}
                                  onClick={() => competition.questionType === "multi" ? toggleMultiOption(opt) : setAnswer(opt)}
                                  className={cn(
                                    "p-5 rounded-2xl border-2 transition-all text-lg font-black text-right relative overflow-hidden group",
                                    isSelected 
                                      ? "border-neon-cyan bg-neon-cyan/20 text-white shadow-[0_0_20px_rgba(0,243,255,0.2)]" 
                                      : "border-white/5 bg-white/5 text-white/40 hover:bg-white/10 hover:border-white/20"
                                  )}
                                >
                                  {isSelected && (
                                    <motion.div 
                                      layoutId="check-bg"
                                      className="absolute left-0 top-0 bottom-0 w-1 bg-neon-cyan" 
                                    />
                                  )}
                                  <span className="relative z-10">{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-4">
                        <button
                          onClick={() => setIsConfirming(true)}
                          disabled={competition.questionType === "multi" ? multiAnswers.length === 0 : !answer}
                          className="w-full md:w-auto bg-white text-black font-black py-5 px-16 rounded-2xl hover:bg-neon-purple hover:text-white transition-all transform hover:scale-[1.05] active:scale-[0.95] shadow-2xl disabled:opacity-30 disabled:grayscale text-xl uppercase tracking-widest"
                        >
                          تأكيد وإرسال المشاركة
                        </button>
                        <p className="text-[10px] text-white/20 uppercase tracking-[2px]">بمجرد الإرسال لن تتمكن من تعديل الإجابة</p>
                      </div>
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-green-500/10 border-2 border-green-500/20 p-12 rounded-[40px] text-center max-w-[600px] relative overflow-hidden"
                    >
                      <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-500/10 rounded-full blur-3xl" />
                      <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
                      <h4 className="text-3xl font-black text-white mb-4">تم الإرسال بنجاح!</h4>
                      <p className="text-white/50 text-lg leading-relaxed">
                        شكراً لك يا بطل. إجابتك الآن في مرحلة التدقيق. <br/>اربط حزام الأمان، السحب سيبدأ قريباً!
                      </p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {competition.status === "drawing" && (
              <motion.div
                key="drawing"
                className="flex-grow flex flex-col items-center justify-center p-10 bg-dark-bg/60 backdrop-blur-3xl rounded-[40px] border border-neon-purple/20 shadow-2xl overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-neon-purple/5 to-transparent pointer-events-none" />
                
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="w-24 h-24 border-4 border-neon-purple border-t-transparent rounded-full mb-8 shadow-[0_0_30px_rgba(188,19,254,0.4)]"
                />
                
                <h2 className="text-4xl md:text-5xl font-black text-white mb-2 text-center">ترقّبوا بطل المسابقة!</h2>
                <p className="text-neon-purple font-bold tracking-[3px] uppercase text-xs mb-12">لحظات تفصلنا عن السحب العشوائي</p>
                
                <div className="w-full max-w-2xl h-32 md:h-40 bg-black/80 rounded-[40px] border-2 border-white/10 flex items-center justify-center relative overflow-hidden group">
                  <div className="absolute inset-y-0 left-0 w-24 md:w-40 bg-gradient-to-r from-black via-transparent to-transparent z-10" />
                  <div className="absolute inset-y-0 right-0 w-24 md:w-40 bg-gradient-to-l from-black via-transparent to-transparent z-10" />
                  <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black to-transparent z-10" />
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black to-transparent z-10" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-neon-cyan z-20 shadow-[0_0_30px_var(--neon-cyan)]" />

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={shuffleIndex}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -20, opacity: 0 }}
                      className="text-3xl md:text-6xl font-black text-white px-10 text-center break-words"
                    >
                      {qualifiedNames.length > 0 ? qualifiedNames[shuffleIndex] : "؟؟؟؟؟؟"}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="mt-12 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-neon-purple animate-ping" />
                  <span className="text-white/40 font-bold uppercase tracking-widest text-[10px]">جاري تدوير القرص الآن</span>
                </div>
              </motion.div>
            )}

            {competition.status === "finished" && (
              <motion.div
                key="finished"
                className="flex-grow flex flex-col items-center justify-center space-y-8"
              >
                <div className="relative bg-dark-surface p-10 md:p-16 rounded-[50px] border-4 border-accent-gold text-center shadow-[0_0_50px_rgba(255,215,0,0.1)] w-full max-w-2xl">
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#050508] p-4 rounded-full border-4 border-accent-gold">
                    <Trophy className="w-16 h-16 text-accent-gold neon-glow-purple" />
                  </div>
                  
                  <h1 className="text-xl text-accent-gold font-bold mb-6 mt-4 uppercase tracking-[2px]">الفائز بالمسابقة</h1>
                  
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-5xl md:text-7xl font-black neon-glow-cyan mb-8 uppercase break-words px-4"
                  >
                    {competition.winnerName}
                  </motion.div>

                  <div className="inline-flex flex-col items-center gap-4 bg-accent-gold/5 border border-accent-gold/20 p-6 rounded-3xl w-full">
                    <span className="text-white/40 text-sm uppercase tracking-wider">الجائزة المستلمة:</span>
                    <div className="flex flex-col items-center gap-3">
                      {competition.prizeImageUrl && (
                        <img 
                          src={competition.prizeImageUrl} 
                          alt="Prize" 
                          className="w-32 h-32 md:w-48 md:h-48 rounded-2xl object-cover border-2 border-accent-gold shadow-lg"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <h4 className="text-2xl font-bold text-accent-gold">{competition.title}</h4>
                    </div>
                  </div>

                  {competition.note && (
                    <div className="mt-8 p-4 bg-white/5 rounded-xl text-white/60 text-sm italic">
                      {competition.note}
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={() => window.location.reload()}
                  className="px-10 py-4 border-2 border-neon-cyan text-neon-cyan font-bold rounded-full hover:bg-neon-cyan hover:text-dark-bg transition-all neon-border-cyan group"
                >
                  <span className="flex items-center gap-2">
                    الرجوع للرئيسية
                    <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </motion.div>
    )}

        {activeTab === "honor" && (
          <motion.div
            key="honor-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-grow flex flex-col gap-6"
          >
            <div className="bg-dark-surface p-10 rounded-[40px] border border-neon-purple/20 text-center relative overflow-hidden backdrop-blur-xl">
               <div className="absolute top-0 right-0 w-96 h-96 bg-neon-purple/5 rounded-full blur-[100px] -mr-48 -mt-48" />
               <Award className="w-20 h-20 text-neon-purple mx-auto mb-6 drop-shadow-[0_0_15px_rgba(188,19,254,0.5)]" />
               <h2 className="text-5xl font-black text-white mb-2">لوحة الشرف</h2>
               <p className="text-white/40 text-lg uppercase tracking-widest">أكثر الطلاب تميزاً وتفاعلاً في المنصة</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
               {topStudents.map((s, idx) => (
                 <motion.div
                   key={idx}
                   whileHover={{ y: -10 }}
                   className="bg-dark-surface p-6 rounded-[32px] border border-white/5 flex flex-row-reverse items-center gap-6 group relative overflow-hidden"
                 >
                   <div className="absolute top-0 right-0 w-1 h-full bg-neon-purple opacity-0 group-hover:opacity-100 transition-all" />
                   <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-3xl font-black text-neon-purple">
                     {idx + 1}
                   </div>
                   <div className="flex-grow text-right">
                     <h4 className="text-xl font-bold group-hover:text-neon-purple transition-colors">{s.name}</h4>
                     <p className="text-white/40 text-sm">{s.grade} - فصل: {s.section}</p>
                   </div>
                   {idx < 3 && <Trophy className={cn("w-6 h-6", idx === 0 ? "text-accent-gold" : idx === 1 ? "text-gray-400" : "text-amber-700")} />}
                 </motion.div>
               ))}
            </div>
          </motion.div>
        )}

        {activeTab === "hall" && (
          <motion.div
            key="hall-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-grow flex flex-col gap-6"
          >
            <div className="bg-dark-surface p-10 rounded-[40px] border border-accent-gold/20 text-center relative overflow-hidden backdrop-blur-xl">
               <div className="absolute top-0 right-0 w-96 h-96 bg-accent-gold/5 rounded-full blur-[100px] -mr-48 -mt-48" />
               <Medal className="w-20 h-20 text-accent-gold mx-auto mb-6 drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]" />
               <h2 className="text-5xl font-black text-white mb-2">أبطال المسابقات</h2>
               <p className="text-white/40 text-lg uppercase tracking-widest">تاريخ الفوز والتميز في مدرسة عماد الدين زنكي</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
               {pastWinners.length > 0 ? pastWinners.map((w, idx) => (
                 <motion.div 
                   key={idx}
                   whileHover={{ y: -5 }}
                   className="bg-dark-surface rounded-[40px] border border-white/5 overflow-hidden flex flex-col group shadow-2xl"
                 >
                    <div className="relative h-64 w-full overflow-hidden">
                       <img 
                         src={w.winnerPhotoUrl || w.prizeImageUrl || "https://picsum.photos/seed/winner/800/600"} 
                         alt="Honoring" 
                         className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                         referrerPolicy="no-referrer"
                       />
                       <div className="absolute inset-0 bg-gradient-to-t from-dark-surface via-transparent to-transparent" />
                       <div className="absolute bottom-6 right-6">
                         <div className="bg-accent-gold text-black px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                           {w.compTitle}
                         </div>
                       </div>
                    </div>
                    
                    <div className="p-8 text-right">
                       <h3 className="text-3xl font-black mb-2 text-white">{w.winnerName}</h3>
                       <div className="flex flex-row-reverse items-center justify-end gap-3 text-white/40 text-sm">
                          <Trophy className="w-4 h-4 text-accent-gold" />
                          <span>بطل المسابقة</span>
                          <span>•</span>
                          <span>{w.winnerGrade}</span>
                          <span>•</span>
                          <span>فصل: {w.winnerSection}</span>
                       </div>
                    </div>
                 </motion.div>
               )) : (
                 <div className="col-span-full py-20 text-center text-white/20 italic">
                   يتم تجميع أسماء الأبطال حالياً...
                 </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer / Ad Bar */}
      <footer className="h-[100px] bg-gradient-to-r from-transparent via-neon-cyan/5 to-transparent border-t border-white/5 flex items-center justify-center gap-10 text-sm opacity-60 tracking-wider">
        {competition.adImageUrl && (
          <div className="flex flex-row-reverse items-center gap-4">
             <span>مساحة إعلانية: {competition.title}</span>
             <a href={competition.adLink} target="_blank" rel="noreferrer" className="text-neon-cyan font-bold">سجل الآن</a>
          </div>
        )}
      </footer>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-dark-surface border border-neon-purple/30 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl"
            >
              <AlertCircle className="w-16 h-16 text-neon-purple mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-4">تأكيد الإرسال</h3>
              <p className="text-white/60 mb-8 text-lg">هل أنت متأكد من رغبتك في إرسال الإجابة؟ لا يمكنك التعديل بعد الإرسال.</p>
              
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setIsConfirming(false);
                    handleSendAnswer();
                  }}
                  className="flex-1 bg-neon-purple text-white font-bold py-4 rounded-xl hover:opacity-90 transition-all shadow-[0_0_20px_rgba(188,19,254,0.3)]"
                >
                  نعم، متأكد
                </button>
                <button
                  onClick={() => setIsConfirming(false)}
                  className="flex-1 bg-white/5 text-white font-bold py-4 rounded-xl hover:bg-white/10 transition-all"
                >
                  تراجع
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WinnerDrawingZone({ answers, onFinish, onCancel }: { answers: any[], onFinish: (winner: any, fallback: boolean) => void, onCancel: () => void }) {
  const [drawing, setDrawing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let qualified = answers.filter(a => a.isCorrect);
    if (qualified.length === 0) {
      qualified = answers;
      setIsFallback(true);
    }
    setCandidates(qualified);
  }, [answers]);

  useEffect(() => {
    let interval: any;
    if (drawing && candidates.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % candidates.length);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [drawing, candidates]);

  const startSelecting = () => {
    if (candidates.length === 0) {
      alert("لا يوجد متسابقون");
      return;
    }
    setDrawing(true);
    setTimeout(() => {
      setDrawing(false);
      const winIdx = Math.floor(Math.random() * candidates.length);
      setCurrentIndex(winIdx);
      onFinish(candidates[winIdx], isFallback);
    }, 15000); // 15 seconds as requested
  };

  return (
    <div className="p-8 text-center space-y-6">
      <div className="flex flex-col items-center gap-2">
        <div className="bg-neon-purple/20 text-neon-purple px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-neon-purple/20">
          مرحلة السحب التفاعلي
        </div>
        <h3 className="text-xl font-bold">تحديد بطل المسابقة</h3>
      </div>

      <div className="h-40 bg-black/40 rounded-3xl border border-white/10 flex items-center justify-center relative overflow-hidden group">
        <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/60 to-transparent z-10" />
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/60 to-transparent z-10" />
        
        {candidates.length > 0 ? (
          <motion.div 
            key={currentIndex}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-3xl md:text-5xl font-black text-white px-6 break-words"
          >
            {candidates[currentIndex]?.studentName}
          </motion.div>
        ) : (
          <div className="text-white/20 italic">في انتظار مشاركات صحيحة...</div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={startSelecting}
          disabled={drawing || candidates.length === 0}
          className="w-full py-5 bg-neon-cyan text-dark-bg font-black rounded-2xl hover:scale-[1.02] transition-all shadow-[0_0_30px_rgba(0,243,255,0.3)] disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {drawing ? <Clock className="animate-spin" /> : <Trophy />}
          <span>{drawing ? "جاري البحث عن الفائز..." : "بدء السحب العشوائي"}</span>
        </button>
        
        {!drawing && (
          <button
            onClick={onCancel}
            className="text-white/20 hover:text-white/40 text-xs font-bold transition-all"
          >
            إلغاء السحب والعودة
          </button>
        )}
      </div>

      <div className="pt-4 border-t border-white/5">
        <div className="flex justify-between items-center flex-row-reverse text-[10px] text-white/40">
          <span>عدد المؤهلين: {candidates.length}</span>
          {isFallback && <span className="text-orange-500">سحب احتياطي (الكل)</span>}
        </div>
      </div>
    </div>
  );
}

function AdminView({ userProfile }: { userProfile?: StudentProfile }) {
  const [competition, setCompetition] = useState<CompetitionData | null>(null);
  const [finishedCompetitions, setFinishedCompetitions] = useState<CompetitionData[]>([]);
  const [stats, setStats] = useState({ totalAnswers: 0, correctAnswers: 0, totalStudents: 0 });
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "competitions"), where("status", "==", "finished")), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as CompetitionData));
      setFinishedCompetitions(docs.sort((a, b) => new Date(b.endTime || 0).getTime() - new Date(a.endTime || 0).getTime()));
    });
    return () => unsub();
  }, []);

  const handleHonorPhotoUpload = async (compId: string, file: File) => {
    if (!file) return;
    setLoading(true);
    try {
      // Create a canvas to resize image (keep it under Firestore 1MB limit)
      const reader = new FileReader();
      reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scale = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const base64 = canvas.toDataURL('image/jpeg', 0.7);
          await setDoc(doc(db, "competitions", compId), { winnerPhotoUrl: base64 }, { merge: true });
          alert("تم رفع صورة التكريم بنجاح!");
          setLoading(false);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };
  
  const handleImageUpload = (file: File, callback: (url: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const deleteCompetition = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذه المسابقة وكل البيانات المتعلقة بها؟")) {
      setLoading(true);
      try {
        const answersSnap = await getDocs(collection(db, `competitions/${id}/answers`));
        const deletePromises = answersSnap.docs.map(d => deleteDoc(doc(db, `competitions/${id}/answers`, d.id)));
        await Promise.all(deletePromises);
        await deleteDoc(doc(db, "competitions", id));
        alert("تم الحذف بنجاح");
      } catch (err) {
        console.error(err);
        alert("خطأ في الحذف");
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("eduwin_student");
    let manualId = "";
    if (saved) {
      const p = JSON.parse(saved);
      manualId = p.uid;
    }

    // Functions moved to component scope

    const checkAdmin = async (uid: string) => {
      if (!uid) return false;
      const adminDoc = await getDoc(doc(db, "admins", uid));
      if (adminDoc.exists()) return true;
      
      const saved = localStorage.getItem("eduwin_student");
      if (saved) {
        const p = JSON.parse(saved);
        const q = query(collection(db, "admins"), where("nationalId", "==", p.nationalId));
        const snap = await getDocs(q);
        return !snap.empty;
      }
      return false;
    };

    const unsub = onAuthStateChanged(auth, async (user) => {
      let isAdm = false;
      if (user) {
        isAdm = await checkAdmin(user.uid);
      }
      
      // If auth check failed, check manual/local ID
      if (!isAdm && manualId) {
        isAdm = await checkAdmin(manualId);
      }
      
      setIsAdmin(isAdm);
    });
    return () => unsub();
  }, []);

  const copyStudentLink = () => {
    const baseUrl = window.location.origin;
    navigator.clipboard.writeText(baseUrl);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const [options, setOptions] = useState<{ id: string; text: string; isCorrect: boolean }[]>([
    { id: "1", text: "", isCorrect: false }
  ]);
  const [newComp, setNewComp] = useState({
    title: "",
    question: "",
    questionType: "text" as QuestionType,
    questionImageUrl: "",
    prizeImageUrl: "",
    adImageUrl: "",
    adLink: "",
    correctAnswer: ""
  });

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, { id: Date.now().toString(), text: "", isCorrect: false }]);
    }
  };

  const removeOption = (id: string) => {
    if (options.length > 1) {
      setOptions(options.filter(o => o.id !== id));
    }
  };

  const updateOptionText = (id: string, text: string) => {
    setOptions(options.map(o => o.id === id ? { ...o, text } : o));
  };

  const toggleOptionCorrect = (id: string) => {
    if (newComp.questionType === "mcq") {
      setOptions(options.map(o => ({ ...o, isCorrect: o.id === id })));
    } else {
      setOptions(options.map(o => o.id === id ? { ...o, isCorrect: !o.isCorrect } : o));
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "competitions"), (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CompetitionData));
        // Sort by createdAt descending
        const sorted = docs.sort((a, b) => {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        setCompetition(sorted[0]);
      } else {
        setCompetition(null);
      }
    });

    return () => unsub();
  }, []);

  const [answers, setAnswers] = useState<any[]>([]);

  useEffect(() => {
    // Listen for total students count
    const unsubStudents = onSnapshot(collection(db, "students"), (snapshot) => {
      setStats(prev => ({ ...prev, totalStudents: snapshot.docs.length }));
    });

    if (competition) {
      const unsubAnswers = onSnapshot(collection(db, `competitions/${competition.id}/answers`), (snapshot) => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setAnswers(docs);
        setStats(prev => ({
          ...prev,
          totalAnswers: docs.length,
          correctAnswers: docs.filter((a: any) => a.isCorrect).length
        }));
      });
      return () => {
        unsubStudents();
        unsubAnswers();
      };
    }
    return () => unsubStudents();
  }, [competition?.id]);

  const toggleCorrect = async (answerId: string, current: boolean) => {
    if (!competition) return;
    await setDoc(doc(db, `competitions/${competition.id}/answers`, answerId), { isCorrect: !current, reviewed: true }, { merge: true });
  };

  const handleStartComp = async () => {
    if (!newComp.title || !newComp.question) {
      alert("يرجى إكمال عنوان المسابقة والسؤال");
      return;
    }
    
    setLoading(true);
    try {
      const compId = "comp_" + Date.now();
      const endTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      
      const finalOptions = (newComp.questionType === "mcq" || newComp.questionType === "multi") 
        ? options.filter(o => o.text.trim() !== "").map(o => o.text.trim()) 
        : [];
      
      const correctOnes = options.filter(o => o.isCorrect).map(o => o.text.trim());
      const finalCorrectAnswer = newComp.questionType === "text" 
        ? newComp.correctAnswer 
        : correctOnes.join(", ");

      await setDoc(doc(db, "competitions", compId), {
        ...newComp,
        options: finalOptions,
        correctAnswer: finalCorrectAnswer,
        status: "active",
        endTime,
        createdAt: new Date().toISOString()
      });
      
      // Reset form
      setNewComp({
        title: "",
        question: "",
        questionType: "text",
        questionImageUrl: "",
        prizeImageUrl: "",
        adImageUrl: "",
        adLink: "",
        correctAnswer: ""
      });
      setOptions([{ id: "1", text: "", isCorrect: false }]);
      
    } catch (err) {
      console.error(err);
      alert("خطأ في حفظ المسابقة: " + (err instanceof Error ? err.message : "يرجى التحقق من الصلاحيات"));
    } finally {
      setLoading(false);
    }
  };

  const handleStartDraw = async () => {
    if (!competition) return;
    if (confirm("هل أنت متأكد من بدء السحب وإغلاق المشاركة؟")) {
      await setDoc(doc(db, "competitions", competition.id), { status: "drawing" }, { merge: true });
    }
  };

  const finalizeWinner = async (winner: any, isFallback: boolean) => {
    if (!competition) return;
    try {
      await setDoc(doc(db, "competitions", competition.id), {
        status: "finished",
        winnerId: winner.studentId,
        winnerName: winner.studentName,
        winnerGrade: winner.grade,
        winnerSection: winner.section,
        note: isFallback ? "تم السحب من جميع المشاركين لعدم وجود إجابة صحيحة" : ""
      }, { merge: true });

      confetti({
        particleCount: 200,
        spread: 120,
        origin: { y: 0.6 },
        colors: ["#00f3ff", "#bc13fe", "#ffd700"]
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="bg-dark-surface p-10 rounded-[40px] border border-red-500/30 text-center max-w-md shadow-2xl">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]" />
          <h2 className="text-3xl font-black text-white mb-4">وصول مرفوض</h2>
          <p className="text-white/40 mb-8 leading-relaxed">ليس لديك صلاحيات الوصول لصفحة الإدارة. يرجى تسجيل الدخول بحساب مسؤول من الصفحة الرئيسية.</p>
          <button 
            onClick={() => window.location.href = "/"} 
            className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold hover:bg-white/10 transition-all"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  if (isAdmin === null) return <LoadingScreen />;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-10 space-y-10" dir="rtl">
      {/* Admin Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-dark-surface/50 p-6 rounded-3xl border border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-neon-cyan/10 rounded-2xl border border-neon-cyan/20">
            <LayoutDashboard className="w-8 h-8 text-neon-cyan" />
          </div>
          <div className="text-right">
            <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">
              {userProfile ? userProfile.name : "لوحة التحكم"}
            </h1>
            <p className="text-neon-cyan text-sm font-bold mt-1">● مدير المسابقة</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={copyStudentLink}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-neon-cyan text-dark-bg font-bold transition-all hover:shadow-[0_0_20px_rgba(0,243,255,0.4)]"
          >
            {copying ? <Check className="w-5 h-5" /> : <ExternalLink className="w-5 h-5" />}
            {copying ? "تم نسخ الرابط" : "نسخ رابط الطلاب"}
          </button>

          <button 
            onClick={() => {
              auth.signOut();
              localStorage.removeItem("eduwin_student");
              window.location.href = "/";
            }}
            className="p-3 rounded-2xl bg-white/5 text-white/40 hover:text-red-500 hover:bg-red-500/10 transition-all border border-white/5"
            title="تسجيل الخروج"
          >
            <X className="w-6 h-6" />
          </button>

          <img 
            src={LOGO_URL} 
            alt="Logo" 
            className="w-16 h-auto drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        {/* Left Column: Stats & Setup */}
        <div className="xl:col-span-8 space-y-10">
          
          {/* Stats Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-dark-surface p-6 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-neon-cyan/5 rounded-bl-full -mr-12 -mt-12 transition-all group-hover:scale-150" />
               <Users className="w-8 h-8 text-neon-cyan mb-4 relative z-10" />
               <div className="text-4xl font-black text-white relative z-10">{stats.totalAnswers}</div>
               <div className="text-white/40 text-xs font-bold uppercase tracking-widest relative z-10">مشاركو المسابقة</div>
            </div>
            
            <div className="bg-dark-surface p-6 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-bl-full -mr-12 -mt-12 transition-all group-hover:scale-150" />
               <CheckCircle className="w-8 h-8 text-green-500 mb-4 relative z-10" />
               <div className="text-4xl font-black text-white relative z-10">{stats.correctAnswers}</div>
               <div className="text-white/40 text-xs font-bold uppercase tracking-widest relative z-10">إجابات صحيحة</div>
            </div>

            <div className="bg-dark-surface p-6 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-neon-purple/5 rounded-bl-full -mr-12 -mt-12 transition-all group-hover:scale-150" />
               <TrendingUp className="w-8 h-8 text-neon-purple mb-4 relative z-10" />
               <div className="text-4xl font-black text-white relative z-10">
                {stats.totalStudents > 0 ? Math.round((stats.totalAnswers / stats.totalStudents) * 100) : 0}%
               </div>
               <div className="text-white/40 text-xs font-bold uppercase tracking-widest relative z-10">نسبة التفاعل</div>
            </div>

            <div className="bg-dark-surface p-6 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-accent-gold/5 rounded-bl-full -mr-12 -mt-12 transition-all group-hover:scale-150" />
               <Users className="w-8 h-8 text-accent-gold mb-4 relative z-10" />
               <div className="text-4xl font-black text-white relative z-10">{stats.totalStudents}</div>
               <div className="text-white/40 text-xs font-bold uppercase tracking-widest relative z-10">إجمالي الطلاب</div>
            </div>
          </div>

          {/* Assets Management Section */}
          <section className="bg-dark-surface p-8 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden">
             <div className="flex flex-row-reverse justify-between items-center mb-8">
               <h2 className="text-xl font-black flex items-center gap-4">
                 <span className="bg-neon-cyan/10 text-neon-cyan px-4 py-1 rounded-lg text-sm border border-neon-cyan/20">إدارة الأصول</span>
                 الإعلانات وتكريم الأبطال
               </h2>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-black/20 p-6 rounded-3xl border border-white/5">
                   <h3 className="text-sm font-bold text-white/40 mb-4 text-right flex flex-row-reverse items-center gap-2">
                     <ExternalLink className="w-4 h-4 text-neon-purple" />
                     الإعلان الحالي
                   </h3>
                   {competition?.adImageUrl ? (
                     <div className="space-y-4">
                       <img src={competition.adImageUrl} className="w-full h-32 object-cover rounded-xl border border-white/10" alt="Ad" />
                       <button 
                         onClick={async () => {
                           if(confirm("حذف صورة الإعلان؟")) {
                             await setDoc(doc(db, "competitions", competition.id), { adImageUrl: "", adLink: "" }, { merge: true });
                           }
                         }}
                         className="w-full py-2 bg-red-500/10 text-red-500 text-xs font-bold rounded-lg border border-red-500/20"
                       >
                         حذف الإعلان
                       </button>
                     </div>
                   ) : (
                     <div className="h-32 flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl text-white/10 text-xs italic">لا يوجد إعلان نشط</div>
                   )}
                </div>

                <div className="bg-black/20 p-6 rounded-3xl border border-white/5">
                   <h3 className="text-sm font-bold text-white/40 mb-4 text-right flex flex-row-reverse items-center gap-2">
                     <Trophy className="w-4 h-4 text-accent-gold" />
                     صورة الفائز (للتكريم)
                   </h3>
                   {competition?.winnerPhotoUrl ? (
                     <div className="space-y-4">
                       <img src={competition.winnerPhotoUrl} className="w-full h-32 object-cover rounded-xl border border-white/10" alt="Winner" />
                       <button 
                         onClick={async () => {
                           if(confirm("حذف صورة التكريم؟")) {
                             await setDoc(doc(db, "competitions", competition.id), { winnerPhotoUrl: "" }, { merge: true });
                           }
                         }}
                         className="w-full py-2 bg-red-500/10 text-red-500 text-xs font-bold rounded-lg border border-red-500/20"
                       >
                         حذف صورة التكريم
                       </button>
                     </div>
                   ) : (
                     <div className="h-32 flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl text-white/10 text-xs italic">بانتظار التقاط صورة البطل</div>
                   )}
                </div>
             </div>
          </section>

          {/* Creation Form Section */}
          <section className="bg-dark-surface p-8 md:p-10 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-purple to-transparent opacity-50" />
            
            <h2 className="text-2xl font-black mb-10 flex items-center gap-4 justify-end">
              <span className="bg-neon-purple/10 text-neon-purple px-4 py-1 rounded-lg text-sm border border-neon-purple/20">المرحلة الأولى</span>
              إعداد المسابقة الجديدة
            </h2>

            <div className="space-y-10">
              {/* Title & Question */}
              <div className="space-y-6">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ضع عنواناً حماسياً للمسابقة..."
                    value={newComp.title}
                    onChange={(e) => setNewComp({ ...newComp, title: e.target.value })}
                    className="w-full bg-white/5 border-2 border-white/5 rounded-2xl px-6 py-5 outline-none focus:border-neon-purple transition-all text-right text-lg placeholder:text-white/20"
                  />
                </div>
                <textarea
                  placeholder="اكتب نص السؤال هنا بدقة..."
                  value={newComp.question}
                  onChange={(e) => setNewComp({ ...newComp, question: e.target.value })}
                  className="w-full bg-white/5 border-2 border-white/5 rounded-2xl px-6 py-5 outline-none focus:border-neon-purple transition-all min-h-[150px] text-right text-lg placeholder:text-white/20"
                />
              </div>

              {/* Advanced Config */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-black/20 rounded-3xl border border-white/5">
                <div className="space-y-4">
                  <label className="text-sm font-bold text-white/40 block text-right">نوع السؤال</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: "text", label: "سؤال مقالي", icon: Send },
                      { id: "mcq", label: "خيار فردي", icon: CheckCircle },
                      { id: "multi", label: "خيارات متعددة", icon: LayoutDashboard },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setNewComp({ ...newComp, questionType: t.id as QuestionType })}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border transition-all text-right",
                          newComp.questionType === t.id 
                            ? "bg-neon-purple/20 border-neon-purple text-white shadow-[0_0_15px_rgba(188,19,254,0.1)]" 
                            : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                        )}
                      >
                        <t.icon className={cn("w-5 h-5", newComp.questionType === t.id ? "text-neon-purple" : "text-white/20")} />
                        <span className="font-bold">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-bold text-white/40 block text-right">المرفقات البصرية</label>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex flex-row-reverse items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/5">
                      <Camera className="w-5 h-5 text-neon-cyan" />
                      <label className="flex-grow cursor-pointer text-right text-xs font-bold text-white/60 py-2">
                        {newComp.questionImageUrl ? "تم اختيار صورة السؤال ✓" : "رفع صورة السؤال (من الجهاز/كاميرا)"}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && handleImageUpload(e.target.files[0], (url) => setNewComp(prev => ({ ...prev, questionImageUrl: url })))} />
                      </label>
                    </div>
                    <div className="flex flex-row-reverse items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/5">
                      <Trophy className="w-5 h-5 text-accent-gold" />
                      <label className="flex-grow cursor-pointer text-right text-xs font-bold text-white/60 py-2">
                        {newComp.prizeImageUrl ? "تم اختيار صورة الجائزة ✓" : "رفع صورة الجائزة (من الجهاز/كاميرا)"}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && handleImageUpload(e.target.files[0], (url) => setNewComp(prev => ({ ...prev, prizeImageUrl: url })))} />
                      </label>
                    </div>
                    <div className="flex flex-row-reverse items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/5">
                      <ExternalLink className="w-5 h-5 text-neon-purple" />
                      <label className="flex-grow cursor-pointer text-right text-xs font-bold text-white/60 py-2">
                        {newComp.adImageUrl ? "تم اختيار صورة الإعلان ✓" : "رفع صورة إعلانية (من الجهاز/كاميرا)"}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && handleImageUpload(e.target.files[0], (url) => setNewComp(prev => ({ ...prev, adImageUrl: url })))} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Options Setup (Smart Management) */}
              {(newComp.questionType === "mcq" || newComp.questionType === "multi") && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-row-reverse">
                    <h3 className="text-lg font-bold text-neon-cyan">خيارات الإجابة والتحقق</h3>
                    <div className="text-xs text-white/40">يمكنك إضافة حتى 6 خيارات وتحديد الإجابات الصحيحة</div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence>
                      {options.map((opt, idx) => (
                        <motion.div
                          key={opt.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="flex items-center gap-2 group"
                        >
                          <button
                            onClick={() => removeOption(opt.id)}
                            className="p-3 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          
                          <div className="flex-grow flex items-center bg-white/5 rounded-xl border border-white/10 overflow-hidden focus-within:border-neon-cyan transition-all">
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => updateOptionText(opt.id, e.target.value)}
                              placeholder={`الخيار ${idx + 1}...`}
                              className="flex-grow bg-transparent px-4 py-4 outline-none text-right text-white"
                            />
                            <button
                              onClick={() => toggleOptionCorrect(opt.id)}
                              className={cn(
                                "px-5 h-full flex items-center justify-center transition-all border-l border-white/10",
                                opt.isCorrect ? "bg-green-500 text-black" : "bg-black/40 text-white/20 hover:text-green-500"
                              )}
                              title="تحديد كإجابة صحيحة"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {options.length < 6 && (
                      <button
                        onClick={addOption}
                        className="flex items-center justify-center gap-3 p-4 border-2 border-dashed border-white/10 rounded-xl text-white/40 hover:border-neon-cyan hover:text-neon-cyan transition-all"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="font-bold">إضافة خيار جديد</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Manual Correct Answer (For Text type) */}
              {newComp.questionType === "text" && (
                <div className="space-y-4">
                   <label className="text-sm font-bold text-white/40 block text-right">الإجابة النموذجية المرجعية</label>
                   <input
                    type="text"
                    placeholder="ما هي الكلمة المفتاحية للإجابة الصحيحة؟"
                    value={newComp.correctAnswer}
                    onChange={(e) => setNewComp({ ...newComp, correctAnswer: e.target.value })}
                    className="w-full bg-white/5 border-2 border-white/5 rounded-2xl px-6 py-5 outline-none focus:border-white/20 text-right"
                  />
                </div>
              )}

              {/* Ads & Links */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 bg-neon-cyan/5 rounded-3xl border border-neon-cyan/10">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-neon-cyan/60 uppercase tracking-widest block text-right">المحتوى الإعلاني</span>
                  <input
                    type="text"
                    placeholder="رابط صورة للإعلان الجانبي"
                    value={newComp.adImageUrl}
                    onChange={(e) => setNewComp({ ...newComp, adImageUrl: e.target.value })}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 outline-none focus:border-neon-cyan text-right text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-bold text-neon-cyan/60 uppercase tracking-widest block text-right">رابط توجيه</span>
                   <input
                    type="text"
                    placeholder="رابط صفحة أو فيديو (يفتح عند الضغط)"
                    value={newComp.adLink}
                    onChange={(e) => setNewComp({ ...newComp, adLink: e.target.value })}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 outline-none focus:border-neon-cyan text-right text-sm"
                  />
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartComp}
                disabled={loading || competition?.status === "active"}
                className="w-full group relative overflow-hidden bg-white text-black font-black py-6 rounded-2xl hover:bg-neon-cyan transition-all shadow-2xl disabled:opacity-50 disabled:grayscale"
              >
                <div className="flex items-center justify-center gap-4 relative z-10 text-xl uppercase tracking-[2px]">
                  <span>{loading ? "جاري الإطلاق..." : "بدء المسابقة فوراً"}</span>
                  <div className={cn("w-3 h-3 rounded-full bg-neon-purple shadow-[0_0_10px_var(--neon-purple)]", competition?.status === "active" ? "animate-ping" : "invisible")} />
                </div>
              </button>
            </div>
          </section>

          {/* Winner Photos Management */}
          <section className="bg-dark-surface p-10 rounded-[40px] border border-white/5 shadow-2xl space-y-8 mt-10">
            <div className="flex flex-row-reverse justify-between items-center">
               <div className="flex flex-row-reverse items-center gap-4">
                  <div className="p-4 bg-accent-gold/10 rounded-2xl border border-accent-gold/20">
                    <Camera className="w-6 h-6 text-accent-gold" />
                  </div>
                  <div className="text-right">
                    <h2 className="text-2xl font-black text-white">إدارة صور التكريم</h2>
                    <p className="text-white/40 text-sm">أضف صور تكريم الفائزين للمشاركة في لوحة الشرف</p>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {finishedCompetitions.length > 0 ? finishedCompetitions.map(comp => (
                <div key={comp.id} className="p-6 bg-white/5 rounded-3xl border border-white/5 flex flex-col gap-4">
                   <div className="flex justify-between items-start flex-row-reverse">
                      <div className="text-right">
                        <div className="text-[10px] text-accent-gold font-bold uppercase tracking-widest">{comp.title}</div>
                        <div className="text-lg font-black text-white">{comp.winnerName}</div>
                      </div>
                      <div className="text-[10px] text-white/20">{new Date(comp.endTime || "").toLocaleDateString('ar-SA')}</div>
                   </div>

                   {comp.winnerPhotoUrl ? (
                     <div className="relative group rounded-2xl overflow-hidden aspect-video border border-white/10">
                        <img src={comp.winnerPhotoUrl} alt="Honoring" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-3 transition-all">
                           <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-lg font-bold text-xs shadow-xl hover:bg-neon-cyan transition-colors">
                             تغيير الصورة
                             <input 
                               type="file" 
                               accept="image/*" 
                               capture="environment" 
                               className="hidden" 
                               onChange={(e) => e.target.files && handleHonorPhotoUpload(comp.id, e.target.files[0])}
                             />
                           </label>
                           <button 
                             onClick={async () => {
                               if(confirm("حذف صورة التكريم لهذا البطل؟")) {
                                 await setDoc(doc(db, "competitions", comp.id), { winnerPhotoUrl: "" }, { merge: true });
                               }
                             }}
                             className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-xl hover:bg-red-600 transition-colors"
                           >
                             حذف الصورة
                           </button>
                        </div>
                     </div>
                   ) : (
                     <label className="cursor-pointer w-full aspect-video border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-accent-gold/40 hover:bg-accent-gold/5 transition-all text-white/20 group">
                        <Camera className="w-8 h-8 group-hover:text-accent-gold transition-colors" />
                        <span className="text-xs font-bold">اضغط لالتقاط أو رفع صورة التكريم</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment" 
                          className="hidden" 
                          onChange={(e) => e.target.files && handleHonorPhotoUpload(comp.id, e.target.files[0])}
                        />
                     </label>
                   )}
                </div>
              )) : (
                <div className="col-span-full py-10 text-center text-white/20 italic">لا توجد مسابقات منتهية بعد</div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Active Comp & Answers */}
        <div className="xl:col-span-4 space-y-10">
          
          {/* Active Competition Mini Preview */}
          {competition ? (
            <div className="bg-dark-surface rounded-[32px] border border-white/10 shadow-xl overflow-hidden">
               <div className="p-6 bg-gradient-to-br from-neon-purple/20 to-transparent border-b border-white/5 flex flex-row-reverse justify-between items-center">
                  <h3 className="font-black text-neon-purple uppercase tracking-widest text-sm">المسابقة الحالية</h3>
                  <div className={cn("w-2 h-2 rounded-full", competition.status === 'active' ? "bg-green-500 shadow-[0_0_10px_var(--green-500)]" : "bg-orange-500")} />
               </div>
               
               {competition.status === 'drawing' ? (
                 <WinnerDrawingZone 
                   answers={answers} 
                   onFinish={(winner, fallback) => finalizeWinner(winner, fallback)} 
                   onCancel={async () => {
                     await setDoc(doc(db, "competitions", competition.id), { status: "active" }, { merge: true });
                   }}
                 />
               ) : (
                 <div className="p-8 text-right space-y-6">
                    <div>
                      <div className="flex flex-row-reverse justify-between items-center mb-2">
                        <h4 className="text-xl font-bold">{competition.title}</h4>
                        <button 
                          onClick={() => deleteCompetition(competition.id)}
                          className="p-2 text-white/20 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-white/40 text-sm line-clamp-2">{competition.question}</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleStartDraw}
                        disabled={loading || competition.status !== "active"}
                        className="w-full py-5 bg-neon-purple text-white font-black rounded-2xl hover:opacity-90 shadow-lg disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center gap-3"
                      >
                        <Trophy className="w-6 h-6" />
                        <span>بدء مرحلة السحب</span>
                      </button>
                      
                      {competition.status === "finished" && (
                         <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl text-center">
                            <div className="text-xs text-green-500/60 font-bold mb-1 uppercase">الفائز الأخير</div>
                            <div className="text-xl font-black text-green-500">{competition.winnerName}</div>
                            <div className="text-[10px] text-white/40">{competition.winnerGrade} - {competition.winnerSection}</div>
                         </div>
                      )}
                    </div>
                 </div>
               )}
            </div>
          ) : (
            <div className="bg-white/5 order-dashed border-2 border-white/10 p-10 rounded-[32px] text-center italic text-white/20">
              لا توجد مسابقات نشطة حالياً
            </div>
          )}

          {/* Real-time Answers Feed */}
          <div className="bg-dark-surface rounded-[32px] border border-white/10 shadow-xl overflow-hidden flex flex-col max-h-[700px]">
             <div className="p-6 bg-white/5 border-b border-white/10 flex flex-row-reverse justify-between items-center">
                <h3 className="font-black text-neon-cyan uppercase tracking-widest text-sm">أحدث الإجابات</h3>
                <span className="bg-neon-cyan/20 text-neon-cyan text-[10px] px-2 py-1 rounded-md font-bold">{answers.length} مشارك</span>
             </div>
             
             <div className="flex-grow overflow-y-auto custom-scrollbar divide-y divide-white/5">
                {answers.length === 0 ? (
                  <div className="p-20 text-center flex flex-col items-center gap-4 text-white/10">
                    <CheckCircle className="w-12 h-12" />
                    <span className="font-bold">في انتظار أول مشاركة...</span>
                  </div>
                ) : (
                  [...answers].reverse().map((a: any) => (
                    <motion.div 
                      layout
                      key={a.id} 
                      className="p-5 hover:bg-white/[0.02] transition-colors flex items-center justify-between group flex-row-reverse"
                    >
                       <div className="text-right space-y-2">
                          <div className="flex flex-row-reverse items-center gap-2">
                             <span className="font-black text-white">{a.studentName}</span>
                             <div className="flex gap-1 flex-row-reverse">
                                <span className="bg-white/5 px-2 py-0.5 rounded text-[10px] text-white/40">{a.grade}</span>
                                <span className="bg-neon-purple/10 px-2 py-0.5 rounded text-[10px] text-neon-purple">{a.section}</span>
                             </div>
                          </div>
                          <div className="text-sm bg-black/40 p-3 rounded-xl border border-white/5 inline-block text-white/70 min-w-[200px]">
                            {a.answerText}
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-2">
                         <button
                           onClick={async () => {
                             if(confirm("حذف هذه الإجابة؟")) {
                               await deleteDoc(doc(db, `competitions/${competition.id}/answers`, a.id));
                             }
                           }}
                           className="p-3 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                         >
                           <Trash2 className="w-5 h-5" />
                         </button>
                         <button
                           onClick={() => toggleCorrect(a.id, a.isCorrect)}
                           className={cn(
                             "flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all border-2",
                             a.isCorrect 
                               ? "bg-green-500 border-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]" 
                               : "bg-white/5 border-white/10 text-white/20 hover:border-green-500 hover:text-green-500"
                           )}
                         >
                           <Check className="w-6 h-6" />
                         </button>
                       </div>
                    </motion.div>
                  ))
                )}
             </div>
          </div>

        </div>
      </div>
      
      {/* --- History / Archive Section --- */}
      <section className="bg-dark-surface p-10 rounded-[40px] border border-white/5 shadow-2xl mt-10">
          <h2 className="text-2xl font-black mb-8 text-right flex flex-row-reverse items-center gap-4">
            <History className="w-8 h-8 text-white/20" />
            أرشيف المسابقات السابقة
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {finishedCompetitions.map((comp) => (
               <div key={comp.id} className="bg-black/40 p-6 rounded-3xl border border-white/5 hover:border-white/10 transition-all group relative">
                   <div className="flex flex-row-reverse justify-between items-center mb-4">
                      <h4 className="font-bold text-white text-right">{comp.title}</h4>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCompetition(comp.id);
                        }} 
                        className="text-white/10 hover:text-red-500 transition-colors"
                        title="حذف المسابقة بالكامل"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                   
                   {comp.winnerPhotoUrl && (
                     <div className="mb-4 relative group/img overflow-hidden rounded-xl border border-white/5 aspect-video">
                       <img src={comp.winnerPhotoUrl} className="w-full h-full object-cover" alt="Winner" />
                       <button 
                         onClick={async (e) => {
                           e.stopPropagation();
                           if(confirm("حذف صورة التكريم لهذه المسابقة؟")) {
                             await setDoc(doc(db, "competitions", comp.id), { winnerPhotoUrl: "" }, { merge: true });
                           }
                         }}
                         className="absolute inset-0 bg-red-500/90 text-white opacity-0 group-hover/img:opacity-100 transition-all flex flex-col items-center justify-center gap-2 font-black text-[10px]"
                       >
                         <Trash2 className="w-5 h-5" />
                         حذف صورة البطل
                       </button>
                     </div>
                   )}

                   <div className="flex flex-row-reverse justify-between items-center text-[10px] text-white/20">
                      <span>{new Date(comp.endTime || "").toLocaleDateString('ar-SA')}</span>
                      {comp.winnerName && <span className="text-neon-cyan font-bold">البطل: {comp.winnerName}</span>}
                   </div>
               </div>
             ))}
             {finishedCompetitions.length === 0 && (
               <div className="col-span-full py-20 text-center text-white/10 italic border-2 border-dashed border-white/5 rounded-3xl">لا توجد مسابقات في الأرشيف</div>
             )}
          </div>
      </section>
    </div>
  );
}

export default function App() {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Suppress Vite HMR WebSocket errors which are expected in this environment
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && (
          event.reason.message?.includes("WebSocket") || 
          event.reason.message?.includes("vite")
      )) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handleRejection);

    const saved = localStorage.getItem("eduwin_student");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        setStudent(p);
      } catch (e) {
        console.error("Failed to parse saved student", e);
      }
    }

    const checkAdminStatus = async (uid: string) => {
      if (!uid) return false;
      try {
        const adminDoc = await getDoc(doc(db, "admins", uid));
        return adminDoc.exists();
      } catch (e) {
        console.error("Error checking admin status", e);
        return false;
      }
    };

    const updateAdminStatus = async (uid?: string) => {
      const isAdm = await checkAdminStatus(uid || "");
      setIsAdmin(isAdm);
      setLoading(false);
    };

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check admin by Firebase UID
        const isAdm = await checkAdminStatus(user.uid);
        setIsAdmin(isAdm);

        // Sync student data if missing
        if (!student) {
          const sDoc = await getDoc(doc(db, "students", user.uid));
          if (sDoc.exists()) {
            const sData = sDoc.data() as StudentProfile;
            setStudent(sData);
            localStorage.setItem("eduwin_student", JSON.stringify(sData));
          }
        }
      } else {
        // Fallback to manual student UID if no Firebase user
        const saved = localStorage.getItem("eduwin_student");
        if (saved) {
          const p = JSON.parse(saved);
          const isAdm = await checkAdminStatus(p.uid);
          setIsAdmin(isAdm);
        } else {
          setIsAdmin(false);
        }
      }
      setLoading(false);
    });

    // Emergency timeout
    const timeout = setTimeout(() => setLoading(false), 5000);

    return () => {
      unsub();
      clearTimeout(timeout);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [student?.uid]); // Re-run if student ID changes (e.g. login)

  if (loading) return <LoadingScreen />;

  return (
    <Router>
      <div className="min-h-screen bg-dark-bg selection:bg-neon-cyan selection:text-dark-bg">
        <Routes>
          <Route path="/" element={
            !student ? <LoginPage onLogin={setStudent} /> : (
              isAdmin ? <AdminView userProfile={student} /> : <StudentInterface student={student} />
            )
          } />
          <Route path="/control-center-edu-2026" element={<AdminView />} />
        </Routes>
      </div>
    </Router>
  );
}
