import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Wallet,
  Send,
  History,
  Users,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Clock3,
  MessageCircle,
  Gift,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { rupiah, formatDate } from "@/lib/format";
import { WithdrawModal } from "@/components/WithdrawModal";
import { LoginCard } from "@/components/LoginCard";
import { SubmissionResultModal } from "@/components/SubmissionResultModal";
import type { Submission } from "@/hooks/useAuth";

export function HomePage() {
  const { user, userDoc, balance, submissions, withdrawals } = useAuth();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [detail, setDetail] = useState<Submission | null>(null);
  const [promo, setPromo] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem("promo_ref_seen")) return;
    const t = setTimeout(() => setPromo(true), 1200);
    return () => clearTimeout(t);
  }, [user]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalSubmitted = submissions.reduce((sum, s) => sum + (s.count || 0), 0);
  const totalEarned = submissions.reduce((sum, s) => sum + (s.creditedRp || 0), 0);
  const pendingSubmissions = submissions.filter((s) => s.status === "Proses").length;

  if (!user) {
    return <LoginCard />;
  }

  return (
    <div className={`space-y-6 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-warning-soft border border-warning/30 flex items-center gap-3">
          <Clock3 className="w-5 h-5 text-warning shrink-0" />
          <p className="text-[11px] text-foreground font-bold">
            Jam kerja penarikan & setoran: <span className="text-warning">08:00 - 22:00 WIB</span> setiap hari.
          </p>
        </div>
        <a
          href="https://whatsapp.com/channel/"
          target="_blank"
          rel="noreferrer"
          className="p-4 rounded-2xl bg-success-soft border border-success/30 flex items-center gap-3 hover:bg-success/20 transition"
        >
          <MessageCircle className="w-5 h-5 text-success shrink-0" />
          <p className="text-[11px] text-foreground font-bold">
            Gabung <span className="text-success">Komunitas Resmi WhatsApp</span> untuk info & update terbaru.
          </p>
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 panel-card p-6 sm:p-8 rounded-3xl border-l-4 border-l-brand relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-brand/20 rounded-full blur-3xl" />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Saldo</p>
            <h1 className="text-3xl sm:text-4xl font-black text-gradient-brand tracking-tight">{rupiah(balance)}</h1>
            <p className="text-xs text-muted-foreground mt-2">{userDoc?.name || user.email}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => setWithdrawOpen(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-brand text-primary-foreground hover:bg-brand/90 glow-brand transition flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" /> Tarik Saldo
              </button>
              <Link
                to="/stor"
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold panel-card text-foreground hover:bg-surface-2 transition flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> Stor Gmail
              </Link>
            </div>
          </div>
        </div>

        <div className="panel-card p-5 rounded-3xl border-l-4 border-l-success flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Gmail Disetor</p>
            <p className="text-3xl font-black text-success">{totalSubmitted}</p>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[10px] text-muted-foreground">Total hasil diterima</p>
            <p className="text-lg font-bold text-foreground">{rupiah(totalEarned)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Clock} value={pendingSubmissions} label="Menunggu" color="text-warning" bg="bg-warning-soft" />
        <StatCard icon={CheckCircle2} value={submissions.filter((s) => s.status === "Berhasil").length} label="Berhasil" color="text-success" bg="bg-success-soft" />
        <StatCard icon={AlertCircle} value={submissions.filter((s) => s.status === "Ditolak").length} label="Ditolak" color="text-destructive" bg="bg-destructive/10" />
        <StatCard icon={TrendingUp} value={withdrawals.filter((w) => w.status === "Berhasil").length} label="Withdrawal" color="text-info" bg="bg-info-soft" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="panel-card rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Riwayat Setoran</h2>
            <Link to="/stor" className="text-[10px] font-bold text-brand flex items-center gap-1 hover:underline">
              Lihat semua <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {submissions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Belum ada setoran.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {submissions.slice(0, 10).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setDetail(s)}
                  className="w-full text-left p-3.5 rounded-2xl bg-surface/60 border border-border flex items-center justify-between hover:bg-surface-2/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-surface-2 text-brand">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{s.count} Gmail</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(s.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-success">{rupiah(s.creditedRp || s.totalRp || 0)}</p>
                    <span className={`text-[10px] font-bold uppercase ${statusText(s.status)}`}>{s.status || "Proses"}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel-card rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Riwayat Withdrawal</h2>
          </div>
          {withdrawals.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Belum ada withdrawal.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {withdrawals.slice(0, 10).map((w) => (
                <div key={w.id} className="p-3.5 rounded-2xl bg-surface/60 border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-surface-2 text-warning">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{w.walletType}</p>
                      <p className="text-[10px] text-muted-foreground">{w.walletNumber}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-warning">{rupiah(w.amount || 0)}</p>
                    <span className={`text-[10px] font-bold uppercase ${statusText(w.status)}`}>{w.status || "Proses"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
      {detail && <SubmissionResultModal sub={detail} onClose={() => setDetail(null)} />}

      {promo && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="panel-card rounded-3xl p-6 w-full max-w-sm text-center space-y-4 relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-violet/30 rounded-full blur-3xl" />
            <button
              onClick={() => {
                sessionStorage.setItem("promo_ref_seen", "1");
                setPromo(false);
              }}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-surface-2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="relative space-y-3">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-violet-soft border border-violet/30 flex items-center justify-center">
                <Gift className="w-7 h-7 text-violet" />
              </div>
              <h3 className="text-base font-black text-gradient-brand">Bonus Referral 50%</h3>
              <p className="text-xs text-muted-foreground">
                Ajak teman lewat link referral kamu. Saat teman menerima pembayaran pertama, kamu dapat bonus 50%
                dari nilai pembayaran itu.
              </p>
              <Link
                to="/referral"
                onClick={() => {
                  sessionStorage.setItem("promo_ref_seen", "1");
                  setPromo(false);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-brand via-violet to-pink text-primary-foreground glow-brand"
              >
                <Users className="w-4 h-4" /> Ambil Link Referral
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, value, label, color, bg }: { icon: typeof Clock; value: number; label: string; color: string; bg: string }) {
  return (
    <div className="panel-card p-4 rounded-2xl flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${bg} ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl font-black text-foreground">{value}</p>
        <p className="text-[10px] text-muted-foreground font-bold uppercase">{label}</p>
      </div>
    </div>
  );
}

function statusText(status?: string) {
  switch (status) {
    case "Berhasil":
    case "Sukses":
    case "Good": return "text-success";
    case "Ditolak":
    case "Gagal":
    case "Disabled": return "text-destructive";
    default: return "text-warning";
  }
}
