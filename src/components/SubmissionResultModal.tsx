import { X } from "lucide-react";
import { rupiah, formatDateTime } from "@/lib/format";
import type { Submission } from "@/hooks/useAuth";

function pill(status?: string) {
  if (status === "Good") return "bg-success-soft text-success border-success/30";
  if (status === "Disabled" || status === "Not exist") return "bg-destructive/10 text-destructive border-destructive/30";
  if (status === "Verif") return "bg-info-soft text-info border-info/30";
  return "bg-warning-soft text-warning border-warning/30";
}

export function SubmissionResultModal({ sub, onClose }: { sub: Submission; onClose: () => void }) {
  const rows = sub.emailResults || [];
  const stats = sub.stats || {};
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="panel-card rounded-3xl p-6 w-full max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-foreground">Detail Hasil Pengecekan</h3>
            <p className="text-[10px] text-muted-foreground">{formatDateTime(sub.createdAt)} • {rows.length} data</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-surface-2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Stat label="Good" value={stats.good || 0} cls="text-success" />
          <Stat label="Disabled" value={stats.disabled || 0} cls="text-destructive" />
          <Stat label="Verif" value={stats.verif || 0} cls="text-info" />
          <Stat label="Not exist" value={stats.notExist || 0} cls="text-muted-foreground" />
        </div>

        <div className="p-3 rounded-2xl bg-success-soft border border-success/30 flex justify-between text-xs">
          <span className="text-muted-foreground">Saldo diterima</span>
          <span className="font-black text-success">{rupiah(sub.creditedRp || 0)}</span>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Belum ada rincian email.</p>
          ) : (
            rows.map((r, i) => (
              <div key={`${r.email}-${i}`} className="flex items-center gap-3 p-3 rounded-xl bg-surface/60 border border-border">
                <span className="text-[10px] text-muted-foreground w-6">{i + 1}.</span>
                <span className="text-xs font-mono text-foreground truncate flex-1">{r.email}</span>
                <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${pill(r.status)}`}>
                  {(r.status || "Proses").toUpperCase()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="p-3 rounded-2xl bg-surface/60 border border-border text-center">
      <p className={`text-lg font-black ${cls}`}>{value}</p>
      <p className="text-[9px] uppercase font-bold text-muted-foreground">{label}</p>
    </div>
  );
}
