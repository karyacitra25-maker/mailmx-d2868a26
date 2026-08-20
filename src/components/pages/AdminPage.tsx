import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  increment as fsIncrement,
} from "firebase/firestore";
import { toast } from "sonner";
import {
  Shield,
  Users,
  Share2,
  Inbox,
  Wallet,
  Check,
  X,
  Pencil,
  List,
  Copy,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Search,
} from "lucide-react";
import { getDb } from "@/lib/firebase";
import { useAuth, type Submission, type UserDoc, type Withdrawal, type ReferralEntry } from "@/hooks/useAuth";
import { rupiah, formatDate, formatDateTime } from "@/lib/format";
import { pushNotification } from "@/lib/notifications";

type AdminUser = UserDoc & { id: string; ip?: string };
type Section = "users" | "referrals" | "submissions" | "withdrawals";
const EMAIL_STATUSES = ["Proses", "Good", "Disabled", "Verif", "Not exist"] as const;

function rateFor(good: number) {
  if (good >= 30) return 6000;
  if (good >= 20) return 5500;
  if (good >= 10) return 5000;
  if (good >= 1) return 4500;
  return 0;
}

function statusPill(status?: string) {
  if (status === "Good" || status === "Berhasil" || status === "Sukses")
    return "bg-success-soft text-success border-success/30";
  if (status === "Disabled" || status === "Ditolak" || status === "Gagal" || status === "Not exist")
    return "bg-destructive/10 text-destructive border-destructive/30";
  if (status === "Verif") return "bg-info-soft text-info border-info/30";
  return "bg-warning-soft text-warning border-warning/30";
}

export function AdminPage() {
  const { user, isAdmin } = useAuth();
  const [section, setSection] = useState<Section>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [search, setSearch] = useState("");
  const [openDates, setOpenDates] = useState<Record<string, boolean>>({});
  const [openSubId, setOpenSubId] = useState<string | null>(null);
  const [balanceTarget, setBalanceTarget] = useState<AdminUser | null>(null);
  const [refTarget, setRefTarget] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const db = getDb();
    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserDoc) })) as AdminUser[];
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setUsers(list);
      },
      (err) => console.warn("Admin users:", err),
    );
    const unsubSubs = onSnapshot(
      query(collection(db, "submissions")),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Submission, "id">) }));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setSubmissions(list);
      },
      (err) => console.warn("Admin subs:", err),
    );
    const unsubWd = onSnapshot(
      query(collection(db, "withdrawals")),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Withdrawal, "id">) }));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setWithdrawals(list);
      },
      (err) => console.warn("Admin wd:", err),
    );
    return () => {
      unsubUsers();
      unsubSubs();
      unsubWd();
    };
  }, [user, isAdmin]);

  const pendingSub = submissions.filter((s) => !s.status || s.status === "Proses").length;
  const pendingWd = withdrawals.filter((w) => !w.status || w.status === "Proses").length;

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q),
    );
  }, [users, search]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = q
      ? submissions.filter(
          (s) =>
            (s.userName || "").toLowerCase().includes(q) || (s.userEmail || "").toLowerCase().includes(q),
        )
      : submissions;
    const map = new Map<string, Submission[]>();
    items.forEach((s) => {
      const key = formatDate(s.createdAt);
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [submissions, search]);

  const openSub = submissions.find((s) => s.id === openSubId) || null;

  if (!user || !isAdmin) {
    return (
      <div className="panel-card rounded-3xl p-8 text-center">
        <Shield className="w-10 h-10 text-destructive mx-auto mb-2" />
        <h1 className="text-lg font-bold text-destructive">Akses Ditolak</h1>
        <p className="text-xs text-muted-foreground">Halaman ini hanya untuk admin.</p>
      </div>
    );
  }

  async function saveBalance(uid: string, newBalance: number, delta: number) {
    try {
      await updateDoc(doc(getDb(), "users", uid), { balance: newBalance });
      if (delta > 0) {
        await pushNotification(uid, {
          type: "balance",
          title: "Saldo masuk",
          message: `Saldo kamu bertambah ${rupiah(delta)}.`,
          amount: delta,
        });
      }
      toast.success("Saldo diperbarui.");
      setBalanceTarget(null);
    } catch (err) {
      toast.error("Gagal: " + (err as Error).message);
    }
  }

  async function updateWithdrawStatus(w: Withdrawal, status: "Sukses" | "Gagal") {
    try {
      const db = getDb();
      await updateDoc(doc(db, "withdrawals", w.id), { status });
      if (status === "Gagal" && w.uid && (w.amount || 0) > 0) {
        await updateDoc(doc(db, "users", w.uid), { balance: fsIncrement(w.amount || 0) });
      }
      await pushNotification(w.uid, {
        type: "withdraw",
        title: status === "Sukses" ? "Penarikan berhasil" : "Penarikan ditolak",
        message:
          status === "Sukses"
            ? `Dana ${rupiah(w.amount)} sudah dikirim ke ${w.walletType} ${w.walletNumber}.`
            : `Penarikan ${rupiah(w.amount)} ditolak, saldo dikembalikan.`,
        amount: w.amount || 0,
      });
      toast.success("Status penarikan diperbarui.");
    } catch (err) {
      toast.error("Gagal: " + (err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-destructive/10 text-destructive border border-destructive/30">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-black text-foreground">Admin Panel</h1>
          <p className="text-[10px] text-muted-foreground">Kelola user, referral, setoran, dan penarikan.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <NavBtn active={section === "users"} onClick={() => setSection("users")} icon={Users} label="Users" count={users.length} />
        <NavBtn active={section === "referrals"} onClick={() => setSection("referrals")} icon={Share2} label="Referral" />
        <NavBtn active={section === "submissions"} onClick={() => setSection("submissions")} icon={Inbox} label="Setoran" count={pendingSub} danger />
        <NavBtn active={section === "withdrawals"} onClick={() => setSection("withdrawals")} icon={Wallet} label="Penarikan" count={pendingWd} danger />
      </div>

      {(section === "users" || section === "submissions") && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau email..."
            className="form-input w-full pl-11 pr-4 py-3 rounded-2xl text-xs text-foreground"
          />
        </div>
      )}

      {section === "users" && (
        <section className="panel-card rounded-3xl p-4 sm:p-6 space-y-2">
          {filteredUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Tidak ada user.</p>
          ) : (
            filteredUsers.map((u) => {
              const refs = u.referrals || [];
              const bonusGiven = refs.filter((r) => r.bonusGiven).length;
              const totalBonus = refs.reduce((s, r) => s + (r.bonusEarned || 0), 0);
              return (
                <div key={u.id} className="p-4 rounded-2xl bg-surface/60 border border-border flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-brand/10 text-brand border border-brand/30 flex items-center justify-center font-black text-xs shrink-0">
                      {(u.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{u.name || "Tanpa nama"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{u.email}</p>
                      <p className="text-[10px] text-muted-foreground">Gabung {formatDate(u.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-success-soft text-success border border-success/30">
                      {rupiah(u.balance)}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-violet-soft text-violet border border-violet/30">
                      {bonusGiven}/{refs.length} ref • {rupiah(totalBonus)}
                    </span>
                    <button
                      onClick={() => setBalanceTarget(u)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-brand/10 text-brand border border-brand/30 hover:bg-brand/20 inline-flex items-center gap-1.5"
                    >
                      <Pencil className="w-3 h-3" /> Edit Saldo
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {section === "referrals" && (
        <section className="panel-card rounded-3xl p-4 sm:p-6 space-y-2">
          {users.filter((u) => (u.referrals || []).length > 0).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Belum ada user yang mengundang.</p>
          ) : (
            users
              .filter((u) => (u.referrals || []).length > 0)
              .map((u) => {
                const refs = u.referrals || [];
                const bonusGiven = refs.filter((r) => r.bonusGiven).length;
                const totalBonus = refs.reduce((s, r) => s + (r.bonusEarned || 0), 0);
                return (
                  <div key={u.id} className="p-4 rounded-2xl bg-surface/60 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{u.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground">{refs.length} Teman</span>
                      <span className="text-[10px] font-bold text-success">{bonusGiven} Sudah bonus</span>
                      <span className="text-[10px] font-bold text-violet">{rupiah(totalBonus)}</span>
                      <button
                        onClick={() => setRefTarget(u)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-info-soft text-info border border-info/30 inline-flex items-center gap-1.5"
                      >
                        <List className="w-3 h-3" /> Detail
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </section>
      )}

      {section === "submissions" &&
        (openSub ? (
          <SubmissionDetail sub={openSub} onBack={() => setOpenSubId(null)} />
        ) : (
          <section className="space-y-3">
            {grouped.length === 0 ? (
              <p className="panel-card rounded-3xl p-8 text-xs text-muted-foreground text-center">Belum ada setoran.</p>
            ) : (
              grouped.map(([dateKey, items]) => {
                const isOpen = search.trim() !== "" || openDates[dateKey];
                const totalData = items.reduce((s, i) => s + (i.emailResults?.length || i.count || 0), 0);
                return (
                  <div key={dateKey} className="panel-card rounded-3xl overflow-hidden">
                    <button
                      onClick={() => setOpenDates((p) => ({ ...p, [dateKey]: !p[dateKey] }))}
                      className="w-full flex justify-between items-center p-4 hover:bg-surface-2/60 transition"
                    >
                      <span className="flex items-center gap-2 text-xs font-bold text-foreground">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-brand" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        📅 {dateKey}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {items.length} User • {totalData} Data
                      </span>
                    </button>
                    {isOpen && (
                      <div className="p-4 border-t border-border space-y-2">
                        {items.map((s) => (
                          <div key={s.id} className="p-4 rounded-2xl bg-surface/60 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground flex items-center gap-2 truncate">
                                👤 {s.userName}
                                <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${statusPill(s.status)}`}>
                                  {!s.status || s.status === "Proses" ? "MENUNGGU" : s.status === "Good" ? "SELESAI" : s.status.toUpperCase()}
                                </span>
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {s.userEmail} • {s.emailResults?.length || s.count || 0} data
                              </p>
                            </div>
                            <button
                              onClick={() => setOpenSubId(s.id)}
                              className="px-4 py-2 rounded-xl text-[10px] font-extrabold bg-brand text-primary-foreground hover:bg-brand/90 whitespace-nowrap"
                            >
                              BUKA SETORAN
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        ))}

      {section === "withdrawals" && (
        <section className="panel-card rounded-3xl p-4 sm:p-6 space-y-2">
          {withdrawals.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Belum ada penarikan.</p>
          ) : (
            withdrawals.map((w) => (
              <div key={w.id} className="p-4 rounded-2xl bg-surface/60 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {w.walletType || "DANA"} • {w.walletNumber || "-"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{formatDateTime(w.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-success">{rupiah(w.amount)}</span>
                  <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${statusPill(w.status)}`}>
                    {(w.status || "Proses").toUpperCase()}
                  </span>
                  <button
                    onClick={() => updateWithdrawStatus(w, "Sukses")}
                    className="p-2 rounded-lg bg-success/20 text-success hover:bg-success/30"
                    title="Tandai sukses"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => updateWithdrawStatus(w, "Gagal")}
                    className="p-2 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30"
                    title="Tolak & kembalikan saldo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {balanceTarget && (
        <BalanceModal target={balanceTarget} onClose={() => setBalanceTarget(null)} onSave={saveBalance} />
      )}
      {refTarget && <ReferralModal target={refTarget} onClose={() => setRefTarget(null)} />}
    </div>
  );
}

function NavBtn({
  active,
  onClick,
  icon: Icon,
  label,
  count,
  danger,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  label: string;
  count?: number;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-3 rounded-2xl text-[11px] font-bold flex items-center justify-between gap-2 border transition ${
        active
          ? "bg-brand text-primary-foreground border-brand glow-brand"
          : "panel-card text-muted-foreground border-border hover:text-foreground"
      }`}
    >
      <span className="flex items-center gap-2">
        <Icon className="w-4 h-4" /> {label}
      </span>
      {!!count && (
        <span
          className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
            danger ? "bg-destructive text-primary-foreground" : "bg-surface-2 text-foreground"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function SubmissionDetail({ sub, onBack }: { sub: Submission; onBack: () => void }) {
  const [rows, setRows] = useState(() =>
    (sub.emailResults || []).map((r) => ({ email: r.email, status: r.status || "Proses" })),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRows((sub.emailResults || []).map((r) => ({ email: r.email, status: r.status || "Proses" })));
  }, [sub.id]);

  const good = rows.filter((r) => r.status === "Good").length;
  const total = good * rateFor(good);

  function copyAll() {
    navigator.clipboard.writeText(rows.map((r) => r.email).join("\n"));
    toast.success("Semua email disalin.");
  }

  async function save() {
    const proses = rows.filter((r) => r.status === "Proses").length;
    if (proses > 0 && !confirm(`Masih ada ${proses} data berstatus "Proses". Tetap simpan?`)) return;
    setBusy(true);
    try {
      const db = getDb();
      const disabled = rows.filter((r) => r.status === "Disabled").length;
      const verif = rows.filter((r) => r.status === "Verif").length;
      const notExist = rows.filter((r) => r.status === "Not exist").length;
      const overall = good > 0 ? "Good" : disabled + verif + notExist > 0 ? "Disabled" : "Proses";

      const subRef = doc(db, "submissions", sub.id);
      const fresh = await getDoc(subRef);
      const alreadyCredited = fresh.exists() ? fresh.data()['isCredited'] === true : false;

      await updateDoc(subRef, {
        emailResults: rows,
        stats: { good, disabled, verif, notExist },
        status: overall,
        creditedRp: total,
        isCredited: true,
      });

      if (sub.uid) {
        const userRef = doc(db, "users", sub.uid);
        const beforeSnap = await getDoc(userRef);
        const before = beforeSnap.exists() ? (beforeSnap.data() as UserDoc & { referralBonusGiven?: boolean }) : {};

        if (!alreadyCredited && total > 0) {
          await updateDoc(userRef, { balance: fsIncrement(total) });
          await pushNotification(sub.uid, {
            type: "balance",
            title: "Saldo masuk",
            message: `${good} Gmail Good disetujui. Saldo bertambah ${rupiah(total)}.`,
            amount: total,
          });
        }

        // Bonus referral 50% dari pembayaran pertama.
        if (!alreadyCredited && total > 0 && before.referredBy && !before.referralBonusGiven) {
          const bonus = Math.floor(total * 0.5);
          const referrerRef = doc(db, "users", before.referredBy);
          const referrerSnap = await getDoc(referrerRef);
          if (referrerSnap.exists() && bonus > 0) {
            await updateDoc(userRef, { balance: fsIncrement(-bonus), referralBonusGiven: true });
            await updateDoc(referrerRef, { balance: fsIncrement(bonus) });
            const refs: ReferralEntry[] = referrerSnap.data()['referrals'] || [];
            const newRefs = refs.map((r) =>
              r.uid === sub.uid
                ? { ...r, bonusEarned: (r.bonusEarned || 0) + bonus, bonusGiven: true, bonusDate: Date.now() }
                : r,
            );
            await updateDoc(referrerRef, { referrals: newRefs });
            await pushNotification(before.referredBy, {
              type: "referral",
              title: "Bonus referral diterima",
              message: `Teman yang kamu undang menyelesaikan setoran pertama. Bonus ${rupiah(bonus)} masuk ke saldo.`,
              amount: bonus,
            });
          } else {
            await updateDoc(userRef, { referralBonusGiven: true });
          }
        }

        // Rekap total akumulasi ke data referral pengundang.
        const subsSnap = await getDocs(query(collection(db, "submissions"), where("uid", "==", sub.uid)));
        let accGood = 0;
        let accSubmitted = 0;
        subsSnap.forEach((s) => {
          const d = s.data();
          accGood += d['stats']?.good || 0;
          accSubmitted += d['count'] || (d['emailResults'] ? d['emailResults'].length : 0);
        });
        const afterSnap = await getDoc(userRef);
        const referredBy = afterSnap.exists() ? (afterSnap.data() as UserDoc).referredBy : null;
        if (referredBy) {
          const referrerRef = doc(db, "users", referredBy);
          const referrerSnap = await getDoc(referrerRef);
          if (referrerSnap.exists()) {
            const refs: ReferralEntry[] = referrerSnap.data()['referrals'] || [];
            const newRefs = refs.map((r) =>
              r.uid === sub.uid ? { ...r, totalGood: accGood, totalSubmitted: accSubmitted } : r,
            );
            await updateDoc(referrerRef, { referrals: newRefs });
          }
        }
      }

      toast.success(`Tersimpan. Good: ${good} • ${rupiah(total)} dicatat.`);
      onBack();
    } catch (err) {
      toast.error("Gagal menyimpan: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel-card rounded-3xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onBack} className="text-[11px] font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <button onClick={copyAll} className="px-3 py-2 rounded-xl text-[10px] font-bold bg-info-soft text-info border border-info/30 inline-flex items-center gap-1.5">
          <Copy className="w-3 h-3" /> Salin Semua Email
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <InfoBox label="User" value={sub.userName || "-"} />
        <InfoBox label="Total Data" value={String(rows.length)} />
        <InfoBox label="WhatsApp" value={(sub as { waNumber?: string }).waNumber || "-"} />
        <InfoBox label="Password" value={(sub as { password?: string }).password || "-"} />
      </div>

      <div className="space-y-2 max-h-[26rem] overflow-y-auto custom-scrollbar pr-1">
        {rows.map((r, i) => (
          <div key={`${r.email}-${i}`} className="flex items-center gap-3 p-3 rounded-xl bg-surface/60 border border-border">
            <span className="text-[10px] text-muted-foreground w-6 shrink-0">{i + 1}.</span>
            <span className="text-xs font-mono text-foreground truncate flex-1">{r.email}</span>
            <select
              value={r.status}
              onChange={(e) =>
                setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, status: e.target.value } : row)))
              }
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border outline-none cursor-pointer ${statusPill(r.status)}`}
            >
              {EMAIL_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-surface text-foreground">
                  {s}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-border flex-wrap">
        <p className="text-xs text-muted-foreground">
          Good <span className="font-black text-success">{good}</span> • Rate {rupiah(rateFor(good))}/akun •
          Total <span className="font-black text-success">{rupiah(total)}</span>
        </p>
        <button
          onClick={save}
          disabled={busy}
          className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-brand via-violet to-pink text-primary-foreground glow-brand disabled:opacity-60"
        >
          {busy ? "Menyimpan..." : "Simpan Hasil"}
        </button>
      </div>
    </section>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-2xl bg-surface/60 border border-border">
      <p className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs font-bold text-foreground truncate">{value}</p>
    </div>
  );
}

function BalanceModal({
  target,
  onClose,
  onSave,
}: {
  target: AdminUser;
  onClose: () => void;
  onSave: (uid: string, newBalance: number, delta: number) => Promise<void>;
}) {
  const current = target.balance || 0;
  const [mode, setMode] = useState<"add" | "set">("add");
  const [nominal, setNominal] = useState("");
  const parsed = parseInt(nominal || "0", 10) || 0;
  const preview = mode === "add" ? current + parsed : parsed;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="panel-card rounded-3xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-sm font-black text-foreground">Edit Saldo</h3>
          <p className="text-[10px] text-muted-foreground font-mono">{target.email}</p>
        </div>
        <div className="p-3 rounded-2xl bg-surface/60 border border-border flex justify-between text-xs">
          <span className="text-muted-foreground">Saldo saat ini</span>
          <span className="font-bold text-foreground">{rupiah(current)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["add", "set"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`py-2 rounded-xl text-[11px] font-bold border ${
                mode === m ? "bg-brand text-primary-foreground border-brand" : "bg-surface/60 text-muted-foreground border-border"
              }`}
            >
              {m === "add" ? "Tambah" : "Set Nilai"}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={nominal}
          onChange={(e) => setNominal(e.target.value)}
          placeholder="Nominal"
          className="form-input w-full px-4 py-3 rounded-xl text-xs text-foreground"
        />
        <div className="p-3 rounded-2xl bg-success-soft border border-success/30 flex justify-between text-xs">
          <span className="text-muted-foreground">Saldo akhir</span>
          <span className="font-black text-success">{rupiah(preview)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-surface-2 text-muted-foreground">
            Batal
          </button>
          <button
            onClick={() => onSave(target.id, preview, preview - current)}
            className="flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-brand text-primary-foreground glow-brand"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

function ReferralModal({ target, onClose }: { target: AdminUser; onClose: () => void }) {
  const refs = target.referrals || [];
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="panel-card rounded-3xl p-6 w-full max-w-lg space-y-3" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-sm font-black text-foreground">Detail Referral</h3>
          <p className="text-[10px] text-muted-foreground font-mono">
            {target.name} ({target.email})
          </p>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
          {refs.map((r, i) => (
            <div key={r.uid || i} className="p-3 rounded-2xl bg-surface/60 border border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">Teman {i + 1} • {r.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  Setor {r.totalSubmitted || 0} • Good {r.totalGood || 0}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-black text-violet">{rupiah(r.bonusEarned || 0)}</p>
                <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${statusPill(r.bonusGiven ? "Good" : "Proses")}`}>
                  {r.bonusGiven ? "BONUS DITERIMA" : "BELUM SETOR"}
                </span>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full py-2.5 rounded-xl text-xs font-bold bg-surface-2 text-muted-foreground">
          Tutup
        </button>
      </div>
    </div>
  );
}
