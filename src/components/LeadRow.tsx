import { Badge } from "@/components/ui/badge";
import type { Id } from "../../convex/_generated/dataModel";

interface Lead {
  _id: Id<"leads">;
  bizName: string;
  customer: string;
  phone: string;
  city: string;
  state: string;
  zip: string;
  speedTier?: string;
  phoneType?: string;
  internetType?: string;
  tvService?: string;
  hasPots: boolean;
  leadStatus: string;
  attFiberAvailable?: boolean;
  attAirAvailable?: boolean;
  ispProviderCount?: number;
  ispData?: string;
  ispLastChecked?: string;
  inferredIsp?: string;
  inferredIspSource?: string;
  likelyIsp?: string;
  likelyIspConfidence?: string;
  conversionScore?: number;
  heatClassification?: string;
  googleBusinessStatus?: string;
  businessStatusOverride?: string;
  lastRetentionDate?: string;
  claimedBy?: Id<"users">;
  claimedByName?: string;
  claimedAt?: string;
}

export function HeatBadge({ classification, score, googleBusinessStatus, businessStatusOverride }: { classification?: string; score?: number; googleBusinessStatus?: string; businessStatusOverride?: string }) {
  // Show closed indicator if permanently closed AND not overridden
  if (googleBusinessStatus === "CLOSED_PERMANENTLY" && businessStatusOverride !== "open_verified") {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-500/25 text-gray-400 border border-gray-500/40">
          <span>❌</span>
          <span>Closed (Verify)</span>
        </div>
        {score !== undefined && (
          <span className="text-[10px] font-mono font-bold text-gray-500">{score}</span>
        )}
      </div>
    );
  }
  // If overridden to open, show verified badge alongside heat
  if (googleBusinessStatus === "CLOSED_PERMANENTLY" && businessStatusOverride === "open_verified") {
    const config = getHeatConfig(classification);
    return (
      <div className="flex items-center gap-1.5">
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${config.bg} ${config.text} border ${config.border}`}>
          <span>{config.icon}</span>
          <span>{classification || "—"}</span>
        </div>
        <span className="text-[9px] text-green-400" title="Manually verified as open">✅</span>
        {score !== undefined && (
          <span className={`text-[10px] font-mono font-bold ${config.text}`}>{score}</span>
        )}
      </div>
    );
  }
  const config = getHeatConfig(classification);
  return (
    <div className="flex items-center gap-1.5">
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${config.bg} ${config.text} border ${config.border}`}>
        <span>{config.icon}</span>
        <span>{classification || "—"}</span>
      </div>
      {score !== undefined && (
        <span className={`text-[10px] font-mono font-bold ${config.text}`}>{score}</span>
      )}
    </div>
  );
}

function getHeatConfig(classification?: string) {
  switch (classification) {
    case "Lock":
      return { icon: "🔒", bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/40" };
    case "Fire":
      return { icon: "🔥", bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/40" };
    case "Hot":
      return { icon: "🔴", bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/40" };
    case "Warm":
      return { icon: "🟡", bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/30" };
    case "Cold":
      return { icon: "🔵", bg: "bg-blue-500/15", text: "text-blue-300", border: "border-blue-500/30" };
    default:
      return { icon: "⚪", bg: "bg-muted/30", text: "text-muted-foreground", border: "border-muted-foreground/30" };
  }
}

/** Format a date string (e.g. "Dec 1, 2023" or ISO) into a short display */
function formatRetentionDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr; // return raw if unparseable
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

/** How many days ago was this date? */
function daysAgo(dateStr?: string): number | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function getRetentionColor(dateStr?: string): string {
  const days = daysAgo(dateStr);
  if (days === null) return "text-muted-foreground";
  if (days > 365) return "text-red-400";       // Over 1 year — stale
  if (days > 180) return "text-amber-400";      // 6+ months
  return "text-emerald-400";                     // Recent
}

export function LeadRow({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const speedColor = getSpeedColor(lead.speedTier);
  const phoneColor = getPhoneColor(lead.phoneType, lead.hasPots);
  const statusColor = getStatusColor(lead.leadStatus);
  const retentionColor = getRetentionColor(lead.lastRetentionDate);

  return (
    <tr
      onClick={onClick}
      className="border-b border-border/20 hover:bg-muted/30 cursor-pointer transition-colors group"
    >
      {/* Heat Score */}
      <td className="px-3 py-3">
        <HeatBadge classification={lead.heatClassification} score={lead.conversionScore} googleBusinessStatus={lead.googleBusinessStatus} businessStatusOverride={lead.businessStatusOverride} />
      </td>

      {/* Business */}
      <td className="px-4 py-3 max-w-[220px]">
        <div className="truncate font-medium text-sm group-hover:text-blue-400 transition-colors">
          {lead.bizName}
        </div>
        <div className="text-xs text-muted-foreground truncate">{lead.customer} · {lead.phone}</div>
      </td>

      {/* Location */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-sm">{lead.city}, {lead.state}</div>
        <div className="text-xs text-muted-foreground">{lead.zip}</div>
      </td>

      {/* Last Retention */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className={`text-sm font-mono ${retentionColor}`}>
          {formatRetentionDate(lead.lastRetentionDate)}
        </div>
        {daysAgo(lead.lastRetentionDate) !== null && (
          <div className="text-[10px] text-muted-foreground">
            {daysAgo(lead.lastRetentionDate)}d ago
          </div>
        )}
      </td>

      {/* Claimed By */}
      <td className="px-4 py-3 whitespace-nowrap">
        {lead.claimedByName ? (
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
              {lead.claimedByName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-blue-400 font-medium truncate max-w-[80px]">{lead.claimedByName}</span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground/40">Unclaimed</span>
        )}
      </td>

      {/* Speed Tier */}
      <td className="px-4 py-3">
        <Badge variant="outline" className={`text-[11px] px-2 py-0.5 font-mono ${speedColor}`}>
          {lead.speedTier || "—"}
        </Badge>
      </td>

      {/* Phone */}
      <td className="px-4 py-3">
        <Badge variant="outline" className={`text-[11px] px-2 py-0.5 ${phoneColor}`}>
          {lead.hasPots && "☎ "}{lead.phoneType || "—"}
        </Badge>
      </td>

      {/* AT&T Upgrade */}
      <td className="px-4 py-3 text-center">
        {lead.attFiberAvailable === true ? (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[11px]">
            🔵 Fiber
          </Badge>
        ) : lead.attAirAvailable === true ? (
          <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-[11px]">
            📡 Air
          </Badge>
        ) : lead.ispLastChecked ? (
          <Badge variant="outline" className="text-[11px] text-muted-foreground border-muted-foreground/30">
            None
          </Badge>
        ) : (
          <span className="text-[11px] text-muted-foreground/50">...</span>
        )}
      </td>

      {/* Current ISP */}
      <td className="px-4 py-3">
        {lead.inferredIsp ? (
          <Badge
            variant="outline"
            className={`text-[11px] px-2 py-0.5 ${
              lead.inferredIsp.includes("AT&T")
                ? "border-blue-500/40 text-blue-400 bg-blue-500/10"
                : "border-rose-500/40 text-rose-400 bg-rose-500/10"
            }`}
          >
            {lead.inferredIsp.includes("AT&T") ? "🔵" : "🔴"} {lead.inferredIsp}
          </Badge>
        ) : lead.likelyIsp ? (
          <span className="text-[10px] text-muted-foreground">
            {lead.likelyIsp.startsWith("AT&T Only") ? "🔵 AT&T Only" : `⚡ ${lead.likelyIsp.replace("Top: ", "")}`}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground/50">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge variant="outline" className={`text-[11px] px-2 py-0.5 capitalize ${statusColor}`}>
          {lead.leadStatus.replace(/_/g, " ")}
        </Badge>
      </td>
    </tr>
  );
}

function getSpeedColor(tier?: string): string {
  switch (tier) {
    case "1.5M-25M": return "border-red-500/40 text-red-400 bg-red-500/10";
    case "45M-50M": return "border-orange-500/40 text-orange-400 bg-orange-500/10";
    case "75M-100M": return "border-yellow-500/40 text-yellow-400 bg-yellow-500/10";
    case "100M+": return "border-emerald-500/40 text-emerald-400 bg-emerald-500/10";
    case "DSL (Unknown Speed)": return "border-red-500/40 text-red-400 bg-red-500/10";
    default: return "border-muted-foreground/30 text-muted-foreground";
  }
}

function getPhoneColor(type?: string, hasPots?: boolean): string {
  if (hasPots) return "border-amber-500/40 text-amber-400 bg-amber-500/10";
  if (type === "VOIP") return "border-blue-500/40 text-blue-400 bg-blue-500/10";
  return "border-muted-foreground/30 text-muted-foreground";
}

function getStatusColor(status: string): string {
  switch (status) {
    case "new": return "border-blue-500/40 text-blue-400";
    case "calling": return "border-yellow-500/40 text-yellow-400";
    case "contact": return "border-emerald-500/40 text-emerald-400";
    case "closer_calling": return "border-purple-500/40 text-purple-400";
    case "closer_contact": return "border-purple-500/40 text-purple-400";
    case "verified": return "border-emerald-500/40 text-emerald-400";
    case "closer_verified": return "border-emerald-500/40 text-emerald-400";
    default: return "border-muted-foreground/30 text-muted-foreground";
  }
}
