import { Badge } from "@/components/ui/badge";
import { HeatBadge } from "@/components/LeadRow";
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
}

export function MobileLeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="border-b border-border/20 px-3 py-3 active:bg-muted/30 transition-colors cursor-pointer"
    >
      {/* Top row: Heat badge + Business name + AT&T upgrade */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <HeatBadge classification={lead.heatClassification} score={lead.conversionScore} googleBusinessStatus={lead.googleBusinessStatus} businessStatusOverride={lead.businessStatusOverride} />
          </div>
          <h3 className="font-semibold text-sm truncate">{lead.bizName}</h3>
          <p className="text-[11px] text-muted-foreground truncate">
            {lead.customer} · {lead.city}, {lead.state}
          </p>
        </div>
        <div className="shrink-0 mt-0.5">
          {lead.attFiberAvailable === true ? (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5">
              🔵 Fiber
            </Badge>
          ) : lead.attAirAvailable === true ? (
            <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-[10px] px-1.5">
              📡 Air
            </Badge>
          ) : lead.ispLastChecked ? (
            <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground/60 border-muted-foreground/20">
              None
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Badge row: Speed, Phone, Internet */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-mono ${getSpeedColor(lead.speedTier)}`}>
          {lead.speedTier || "—"}
        </Badge>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getPhoneColor(lead.phoneType, lead.hasPots)}`}>
          {lead.hasPots && "☎ "}{lead.phoneType || "—"}
        </Badge>
        {lead.internetType && (
          <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
            {lead.internetType}
          </span>
        )}
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${getStatusColor(lead.leadStatus)}`}>
          {lead.leadStatus.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Bottom row: ISP + phone */}
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-2">
          {lead.inferredIsp ? (
            <span className={`text-[10px] font-medium ${lead.inferredIsp.includes("AT&T") ? "text-blue-400" : "text-rose-400"}`}>
              {lead.inferredIsp.includes("AT&T") ? "🔵" : "🔴"} {lead.inferredIsp}
            </span>
          ) : lead.likelyIsp ? (
            <span className="text-[10px] text-muted-foreground truncate">
              ⚡ {lead.likelyIsp.replace("Top: ", "").split("(")[0].trim()}
            </span>
          ) : null}
        </div>
        <a
          href={`tel:${lead.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[11px] text-blue-400 active:text-blue-300"
        >
          📞 {lead.phone}
        </a>
      </div>
    </div>
  );
}

function getSpeedColor(tier?: string): string {
  switch (tier) {
    case "1.5M-25M": return "border-red-500/40 text-red-400 bg-red-500/10";
    case "45M-50M": return "border-orange-500/40 text-orange-400 bg-orange-500/10";
    case "75M-100M": return "border-yellow-500/40 text-yellow-400 bg-yellow-500/10";
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
    default: return "border-muted-foreground/30 text-muted-foreground";
  }
}
