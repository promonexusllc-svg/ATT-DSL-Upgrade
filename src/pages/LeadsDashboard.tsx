import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Download,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Phone,
  Wifi,
  Tv,
  MapPin,
  Zap,
  Signal,
  Globe,
  Lock,
} from "lucide-react";
import { LeadRow } from "@/components/LeadRow";
import { LeadDetailSheet } from "@/components/LeadDetailSheet";
import { StatsBar } from "@/components/StatsBar";
import { MobileLeadCard } from "@/components/MobileLeadCard";
import type { Id } from "../../convex/_generated/dataModel";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export function LeadsDashboard() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [state, setState] = useState<string | undefined>();
  const [city, setCity] = useState<string | undefined>();
  const [speedTier, setSpeedTier] = useState<string | undefined>();
  const [phoneType, setPhoneType] = useState<string | undefined>();
  const [tvService, setTvService] = useState<string | undefined>();
  const [internetType, setInternetType] = useState<string | undefined>();
  const [leadStatus, setLeadStatus] = useState<string | undefined>();
  const [hasPots, setHasPots] = useState<boolean | undefined>();
  const [attFiber, setAttFiber] = useState<boolean | undefined>();
  const [attAir, setAttAir] = useState<boolean | undefined>();
  const [heatClassification, setHeatClassification] = useState<string | undefined>();
  const [showClosed, setShowClosed] = useState<boolean | undefined>();
  const [sortBy, setSortBy] = useState<string>("recommended");
  const [cursor, setCursor] = useState<string | undefined>();
  const [selectedLeadId, setSelectedLeadId] = useState<Id<"leads"> | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filterArgs = useMemo(
    () => ({
      search: search || undefined,
      state,
      city,
      speedTier,
      phoneType,
      tvService,
      internetType,
      leadStatus,
      hasPots,
      attFiberAvailable: attFiber,
      attAirAvailable: attAir,
      heatClassification,
      showClosed,
      sortBy,
      cursor,
      limit: isMobile ? 25 : 50,
    }),
    [search, state, city, speedTier, phoneType, tvService, internetType, leadStatus, hasPots, attFiber, attAir, heatClassification, showClosed, sortBy, cursor, isMobile]
  );

  const data = useQuery(api.leads.list, filterArgs);
  const filterCounts = useQuery(api.leads.filterCounts);
  const cities = useQuery(api.leads.citiesForState, state ? { state } : "skip");

  // Filtered stats for the stats bar
  const filteredStatsArgs = useMemo(() => ({
    search: search || undefined,
    state,
    city,
    speedTier,
    phoneType,
    tvService,
    internetType,
    leadStatus,
    hasPots,
    attFiberAvailable: attFiber,
    attAirAvailable: attAir,
    heatClassification,
    showClosed,
  }), [search, state, city, speedTier, phoneType, tvService, internetType, leadStatus, hasPots, attFiber, attAir, heatClassification, showClosed]);
  
  const filteredStats = useQuery(api.leads.filteredStats, filteredStatsArgs);

  const activeFilterCount = [state, city, speedTier, phoneType, tvService, internetType, leadStatus, heatClassification, hasPots !== undefined ? "y" : undefined, attFiber !== undefined ? "y" : undefined, attAir !== undefined ? "y" : undefined, showClosed ? "y" : undefined].filter(Boolean).length;

  const clearFilters = useCallback(() => {
    setState(undefined);
    setCity(undefined);
    setSpeedTier(undefined);
    setPhoneType(undefined);
    setTvService(undefined);
    setInternetType(undefined);
    setLeadStatus(undefined);
    setHasPots(undefined);
    setAttFiber(undefined);
    setAttAir(undefined);
    setHeatClassification(undefined);
    setShowClosed(undefined);
    setSearch("");
    setCursor(undefined);
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!data?.leads) return;
    const headers = [
      "Business Name", "Customer", "Phone", "Email", "Address", "City", "State", "Zip",
      "Speed Tier", "Phone Type", "Internet Type", "TV Service", "Has POTS", "Status",
      "All Packages", "Rep", "FG Status", "FG Department",
      "AT&T Fiber", "AT&T Air", "ISP Count",
      "Inferred ISP", "ISP Source", "Likely ISP", "ISP Confidence",
    ];
    const rows = data.leads.map((l: any) => [
      l.bizName, l.customer, l.phone, l.email || "",
      l.address, l.city, l.state, l.zip,
      l.speedTier || "", l.phoneType || "", l.internetType || "", l.tvService || "",
      l.hasPots ? "Yes" : "No", l.leadStatus, l.allPackages,
      l.rep || "", l.fgStatus || "", l.fgDepartment || "",
      l.attFiberAvailable === true ? "Yes" : l.attFiberAvailable === false ? "No" : "Pending",
      l.attAirAvailable === true ? "Yes" : l.attAirAvailable === false ? "No" : "Pending",
      l.ispProviderCount?.toString() || "",
      l.inferredIsp || "", l.inferredIspSource || "", l.likelyIsp || "", l.likelyIspConfidence || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `att-dsl-leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const pageSize = isMobile ? 25 : 50;

  // Filter sidebar content (shared between desktop and mobile drawer)
  const filterContent = (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Filters</h2>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" /> Clear all
            </Button>
          )}
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setShowFilters(false)} className="h-7 w-7 md:hidden">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search business name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCursor(undefined); }}
          className="pl-9 h-9 text-sm bg-background/50"
        />
      </div>

      <Separator />

      <FilterSection icon={<Wifi className="h-3.5 w-3.5" />} label="Speed Tier">
        <Select value={speedTier || "all"} onValueChange={(v) => { setSpeedTier(v === "all" ? undefined : v); setCursor(undefined); }}>
          <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Speeds</SelectItem>
            {filterCounts?.speedTiers.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.value} ({s.count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection icon={<Phone className="h-3.5 w-3.5" />} label="Phone Service">
        <Select value={phoneType || "all"} onValueChange={(v) => { setPhoneType(v === "all" ? undefined : v); setCursor(undefined); }}>
          <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Phone Types</SelectItem>
            {filterCounts?.phoneTypes.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.value} ({s.count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="mt-2">
          <Button
            variant={hasPots === true ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs w-full gap-2"
            onClick={() => { setHasPots(hasPots === true ? undefined : true); setCursor(undefined); }}
          >
            <Zap className="h-3 w-3" />
            POTS Lines Only ({filterCounts?.potsCount || 0})
          </Button>
        </div>
      </FilterSection>

      <FilterSection icon={<Globe className="h-3.5 w-3.5" />} label="Internet Type">
        <Select value={internetType || "all"} onValueChange={(v) => { setInternetType(v === "all" ? undefined : v); setCursor(undefined); }}>
          <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {filterCounts?.internetTypes.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.value} ({s.count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection icon={<Tv className="h-3.5 w-3.5" />} label="TV Service">
        <Select value={tvService || "all"} onValueChange={(v) => { setTvService(v === "all" ? undefined : v); setCursor(undefined); }}>
          <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All TV</SelectItem>
            {filterCounts?.tvServices.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.value} ({s.count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection icon={<MapPin className="h-3.5 w-3.5" />} label="Location">
        <Select value={state || "all"} onValueChange={(v) => { setState(v === "all" ? undefined : v); setCity(undefined); setCursor(undefined); }}>
          <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {filterCounts?.states.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.value} ({s.count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state && cities && cities.length > 0 && (
          <Select value={city || "all"} onValueChange={(v) => { setCity(v === "all" ? undefined : v); setCursor(undefined); }}>
            <SelectTrigger className="h-8 text-xs bg-background/50 mt-2"><SelectValue placeholder="All Cities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.value} ({c.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FilterSection>

      <FilterSection icon={<Signal className="h-3.5 w-3.5" />} label="Lead Status">
        <Select value={leadStatus || "all"} onValueChange={(v) => { setLeadStatus(v === "all" ? undefined : v); setCursor(undefined); }}>
          <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {filterCounts?.leadStatuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.value} ({s.count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      <Separator />

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-blue-400" />
          AT&T Upgrade Eligibility
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={attFiber === true ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => { setAttFiber(attFiber === true ? undefined : true); setAttAir(undefined); setCursor(undefined); }}
          >
            🔵 Fiber ({filterCounts?.attFiberCount || 0})
          </Button>
          <Button
            variant={attAir === true ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => { setAttAir(attAir === true ? undefined : true); setAttFiber(undefined); setCursor(undefined); }}
          >
            📡 Air ({filterCounts?.attAirCount || 0})
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {filterCounts?.enrichedCount || 0} of {filterCounts?.totalLeads || 0} addresses checked
        </p>
      </div>

      <Separator />

      {/* Heat Classification Filter */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          🎯 Conversion Heat
        </h3>
        <div className="grid grid-cols-1 gap-1.5">
          {[
            { value: "Lock", icon: "🔒", label: "Lock", color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
            { value: "Fire", icon: "🔥", label: "Fire", color: "text-orange-400 border-orange-500/40 bg-orange-500/10" },
            { value: "Hot", icon: "🔴", label: "Hot", color: "text-red-400 border-red-500/40 bg-red-500/10" },
            { value: "Warm", icon: "🟡", label: "Warm", color: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10" },
            { value: "Cold", icon: "🔵", label: "Cold", color: "text-blue-300 border-blue-500/40 bg-blue-500/10" },
          ].map((h) => {
            const count = filterCounts?.heatClassifications?.find((c) => c.value === h.value)?.count || 0;
            return (
              <Button
                key={h.value}
                variant={heatClassification === h.value ? "default" : "outline"}
                size="sm"
                className={`h-7 text-xs justify-between ${heatClassification === h.value ? "" : h.color}`}
                onClick={() => { setHeatClassification(heatClassification === h.value ? undefined : h.value); setShowClosed(undefined); setCursor(undefined); }}
              >
                <span>{h.icon} {h.label}</span>
                <span className="text-[10px] opacity-70">{count}</span>
              </Button>
            );
          })}
          {/* Closed indicator */}
          <Button
            variant={showClosed ? "default" : "outline"}
            size="sm"
            className={`h-7 text-xs justify-between ${showClosed ? "bg-red-900/80 hover:bg-red-900" : "text-red-400 border-red-500/40 bg-red-500/5"}`}
            onClick={() => { setShowClosed(showClosed ? undefined : true); setHeatClassification(undefined); setCursor(undefined); }}
          >
            <span>❌ Closed</span>
            <span className="text-[10px] opacity-70">{filterCounts?.closedCount || 0}</span>
          </Button>
        </div>
      </div>

      {/* Mobile: Apply button */}
      {isMobile && (
        <div className="pt-2">
          <Button className="w-full" onClick={() => setShowFilters(false)}>
            Apply Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Zap className="h-3.5 w-3.5 md:h-4 md:w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-lg font-bold tracking-tight truncate">AT&T DSL Upgrade Pipeline</h1>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">Legacy DSL/U-Verse → Fiber/Air Conversion</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-1.5 md:gap-2 h-8 md:h-9 px-2.5 md:px-3 text-xs md:text-sm"
            >
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 w-4 md:h-5 md:w-5 rounded-full p-0 flex items-center justify-center text-[9px] md:text-[10px] bg-blue-600 text-white">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={!data?.leads?.length}
              className="gap-1.5 md:gap-2 h-8 md:h-9 px-2.5 md:px-3 text-xs md:text-sm"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate("/pipeline")}
              className="gap-1.5 md:gap-2 h-8 md:h-9 px-2.5 md:px-3 text-xs md:text-sm bg-blue-600 hover:bg-blue-700"
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">My Pipeline</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <StatsBar
        filterCounts={filterCounts}
        filteredStats={filteredStats && filteredStats.total > 0 ? filteredStats : undefined}
        isFiltered={activeFilterCount > 0 || (search?.trim()?.length || 0) > 0}
      />

      <div className="flex">
        {/* Desktop Filter Sidebar */}
        {showFilters && !isMobile && (
          <aside className="w-72 shrink-0 border-r border-border/50 bg-card/30 overflow-y-auto h-[calc(100vh-140px)] sticky top-[140px] hidden md:block">
            {filterContent}
          </aside>
        )}

        {/* Mobile Filter Drawer (overlay) */}
        {showFilters && isMobile && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
            <div className="absolute inset-y-0 left-0 w-[85vw] max-w-[320px] bg-card border-r border-border overflow-y-auto animate-in slide-in-from-left duration-200">
              {filterContent}
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-hidden min-w-0">
          {/* Results Header */}
          <div className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3 border-b border-border/30 bg-card/20">
            <div className="flex items-center gap-3">
              <span className="text-xs md:text-sm text-muted-foreground">
                {data ? (
                  <>
                    <span className="text-foreground font-semibold">{data.totalCount.toLocaleString()}</span> leads
                    {activeFilterCount > 0 && " (filtered)"}
                  </>
                ) : "Loading..."}
              </span>
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setCursor(undefined); }}>
                <SelectTrigger className="h-7 w-[140px] md:w-[160px] text-[11px] md:text-xs bg-background/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">🎯 Recommended</SelectItem>
                  <SelectItem value="score_desc">Score ↓ High-Low</SelectItem>
                  <SelectItem value="score_asc">Score ↑ Low-High</SelectItem>
                  <SelectItem value="name_asc">Name A-Z</SelectItem>
                  <SelectItem value="name_desc">Name Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={!cursor}
                onClick={() => {
                  const cursorNum = cursor ? parseInt(cursor) : 0;
                  setCursor(cursorNum >= pageSize ? String(cursorNum - pageSize) : undefined);
                }}
                className="h-7 w-7 md:h-7 md:w-auto p-0 md:px-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">
                {cursor ? parseInt(cursor) + 1 : 1}-{Math.min((cursor ? parseInt(cursor) : 0) + pageSize, data?.totalCount || 0)} of {data?.totalCount || 0}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={!data?.nextCursor}
                onClick={() => setCursor(data?.nextCursor || undefined)}
                className="h-7 w-7 md:h-7 md:w-auto p-0 md:px-2"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-muted/30">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Score</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Business</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Location</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Speed Tier</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Phone</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">AT&T Upgrade</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Current ISP</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.leads.map((lead) => (
                  <LeadRow key={lead._id} lead={lead} onClick={() => setSelectedLeadId(lead._id)} />
                ))}
                {data && data.leads.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-muted-foreground">No leads match your filters</td>
                  </tr>
                )}
                {!data && (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                        Loading leads...
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden">
            {data?.leads.map((lead) => (
              <MobileLeadCard key={lead._id} lead={lead} onClick={() => setSelectedLeadId(lead._id)} />
            ))}
            {data && data.leads.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">No leads match your filters</div>
            )}
            {!data && (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                Loading leads...
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Lead Detail Sheet */}
      {selectedLeadId && (
        <LeadDetailSheet leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
      )}
    </div>
  );
}

function FilterSection({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        {icon} {label}
      </h3>
      {children}
    </div>
  );
}
