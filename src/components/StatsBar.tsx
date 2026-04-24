import { Wifi, Phone, Zap, Signal, Globe, XCircle } from "lucide-react";

interface FilterCounts {
  totalLeads: number;
  potsCount: number;
  enrichedCount: number;
  attFiberCount: number;
  attAirCount: number;
  closedCount: number;
  speedTiers: { value: string; count: number }[];
  phoneTypes: { value: string; count: number }[];
  states: { value: string; count: number }[];
}

interface FilteredStats {
  total: number;
  pots: number;
  lowSpeed: number;
  fiber: number;
  air: number;
  states: number;
  closed: number;
}

export function StatsBar({
  filterCounts,
  filteredStats,
  isFiltered,
}: {
  filterCounts: FilterCounts | undefined;
  filteredStats?: FilteredStats;
  isFiltered?: boolean;
}) {
  if (!filterCounts) {
    return (
      <div className="px-3 md:px-6 py-2 md:py-3 border-b border-border/30 bg-card/20">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Loading stats...
        </div>
      </div>
    );
  }

  // Use filtered stats if available and filters are active, otherwise global
  const showFiltered = isFiltered && filteredStats;
  const totalLeads = showFiltered ? filteredStats!.total : filterCounts.totalLeads;
  const potsCount = showFiltered ? filteredStats!.pots : filterCounts.potsCount;
  const lowSpeed = showFiltered ? filteredStats!.lowSpeed : (filterCounts.speedTiers.find(s => s.value === "1.5M-25M")?.count || 0);
  const fiberCount = showFiltered ? filteredStats!.fiber : filterCounts.attFiberCount;
  const airCount = showFiltered ? filteredStats!.air : filterCounts.attAirCount;
  const closedCount = showFiltered ? filteredStats!.closed : (filterCounts.closedCount || 0);

  const stats = [
    {
      label: showFiltered ? "Filtered Leads" : "Total Leads",
      value: totalLeads.toLocaleString(),
      icon: <Signal className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-400" />,
      color: "text-blue-400",
    },
    {
      label: "POTS Lines",
      value: potsCount.toLocaleString(),
      icon: <Phone className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-400" />,
      color: "text-amber-400",
    },
    {
      label: "Low Speed (≤25M)",
      value: lowSpeed.toLocaleString(),
      icon: <Wifi className="h-3.5 w-3.5 md:h-4 md:w-4 text-red-400" />,
      color: "text-red-400",
    },
    {
      label: "Fiber Eligible",
      value: fiberCount.toLocaleString(),
      icon: <Zap className="h-3.5 w-3.5 md:h-4 md:w-4 text-emerald-400" />,
      color: "text-emerald-400",
    },
    {
      label: "Air Eligible",
      value: airCount.toLocaleString(),
      icon: <Globe className="h-3.5 w-3.5 md:h-4 md:w-4 text-sky-400" />,
      color: "text-sky-400",
    },
    {
      label: "Confirmed Closed",
      value: closedCount.toLocaleString(),
      icon: <XCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-gray-400" />,
      color: "text-gray-400",
    },
  ];

  return (
    <div className="px-3 md:px-6 py-2 md:py-3 border-b border-border/30 bg-card/20">
      {/* Desktop: horizontal row, evenly spaced */}
      <div className="hidden md:flex items-center justify-between">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
              {stat.icon}
            </div>
            <div>
              <div className={`text-base font-bold tabular-nums leading-tight ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider leading-tight">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: compact 3x2 grid */}
      <div className="md:hidden grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-1.5">
            <div className="h-6 w-6 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
              {stat.icon}
            </div>
            <div className="min-w-0">
              <div className={`text-sm font-bold tabular-nums leading-tight ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-[8px] text-muted-foreground uppercase tracking-wider leading-tight truncate">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
