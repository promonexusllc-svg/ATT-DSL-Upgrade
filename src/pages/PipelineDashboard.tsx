import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Lock,
  LogOut,
  Phone as PhoneIcon,
  PhoneCall,
  MessageSquare,
  Clock,
  TrendingUp,
  User,
  ChevronRight,
  Calendar,
  BarChart3,
  ClipboardList,
  Bell,
  Eye,
  EyeOff,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Id } from "../../convex/_generated/dataModel";

const TOKEN_KEY = "att_pipeline_token";

// Pipeline status definitions
const PIPELINE_STAGES = [
  { key: "no_contact", label: "No Contact", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", emoji: "⬜" },
  { key: "attempted", label: "Attempted", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", emoji: "📞" },
  { key: "contacted", label: "Contacted", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", emoji: "🗣️" },
  { key: "interested", label: "Interested", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", emoji: "✨" },
  { key: "not_interested", label: "Not Interested", color: "bg-red-500/20 text-red-400 border-red-500/30", emoji: "❌" },
  { key: "verified", label: "Verified", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", emoji: "✅" },
  { key: "converted", label: "Converted", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", emoji: "🏆" },
];

const CALL_OUTCOMES = [
  { value: "no_answer", label: "No Answer", icon: "📵" },
  { value: "voicemail", label: "Left Voicemail", icon: "📨" },
  { value: "busy", label: "Busy", icon: "🔴" },
  { value: "wrong_number", label: "Wrong Number", icon: "❌" },
  { value: "spoke_contact", label: "Spoke to Contact", icon: "🗣️" },
  { value: "left_message", label: "Left Message", icon: "💬" },
  { value: "callback_scheduled", label: "Callback Scheduled", icon: "📅" },
];

function getStage(key: string) {
  return PIPELINE_STAGES.find((s) => s.key === key) || PIPELINE_STAGES[0];
}

export function PipelineDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) || "");
  const [activeTab, setActiveTab] = useState<"overview" | "followups" | "activity">("overview");
  const [selectedLeadId, setSelectedLeadId] = useState<Id<"leads"> | null>(
    (searchParams.get("lead") as Id<"leads">) || null
  );
  const [dateRange, setDateRange] = useState("all");

  // Auth queries
  const setupStatus = useQuery(api.pipeline.checkSetupStatus);
  const isValid = useQuery(api.pipeline.verifySession, token ? { token } : "skip");

  // If token invalid, clear it
  useEffect(() => {
    if (isValid === false && token) {
      localStorage.removeItem(TOKEN_KEY);
      setToken("");
    }
  }, [isValid, token]);

  const handleAuth = (newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
  };

  // Not authenticated - show login
  if (!token || isValid === false) {
    return <LoginPage setupStatus={setupStatus} onAuth={handleAuth} onBack={() => navigate("/")} />;
  }

  // Loading auth check
  if (isValid === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-8 w-8 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <ClipboardList className="h-3.5 w-3.5 md:h-4 md:w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-lg font-bold tracking-tight truncate">My Pipeline</h1>
              <p className="text-[10px] md:text-xs text-muted-foreground">Personal Performance Tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="h-8 w-[100px] md:w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 gap-1.5 text-xs text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-border/30">
          {[
            { key: "overview" as const, label: "Overview", icon: <BarChart3 className="h-3.5 w-3.5" /> },
            { key: "followups" as const, label: "Follow-Ups", icon: <Bell className="h-3.5 w-3.5" /> },
            { key: "activity" as const, label: "Activity", icon: <ClipboardList className="h-3.5 w-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto">
        {activeTab === "overview" && (
          <OverviewTab token={token} dateRange={dateRange} onSelectLead={setSelectedLeadId} />
        )}
        {activeTab === "followups" && (
          <FollowUpsTab token={token} onSelectLead={setSelectedLeadId} />
        )}
        {activeTab === "activity" && (
          <ActivityTab token={token} onSelectLead={setSelectedLeadId} />
        )}
      </div>

      {/* Lead Action Sheet */}
      {selectedLeadId && (
        <LeadActionSheet
          token={token}
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
        />
      )}
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────

function LoginPage({
  setupStatus,
  onAuth,
  onBack,
}: {
  setupStatus: { isSetUp: boolean } | undefined;
  onAuth: (token: string) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useMutation(api.pipeline.login);
  const createPasswordMutation = useMutation(api.pipeline.createPassword);

  const isSetup = setupStatus?.isSetUp === false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSetup) {
        // Creating password
        if (password !== confirmPassword) {
          setError("Passwords don't match");
          setLoading(false);
          return;
        }
        const result = await createPasswordMutation({ email: email.trim(), password });
        if (result.success) {
          onAuth(result.token);
        } else {
          setError(result.error);
        }
      } else {
        // Logging in
        const result = await loginMutation({ email: email.trim(), password });
        if (result.success) {
          onAuth(result.token);
        } else {
          setError(result.error);
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold">Pipeline Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSetup ? "Create your password to get started" : "Sign in to access your pipeline"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="mt-1.5 h-10 bg-card"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {isSetup ? "Create Password" : "Password"}
            </label>
            <div className="relative mt-1.5">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSetup ? "Create a secure password" : "Enter your password"}
                className="h-10 bg-card pr-10"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {isSetup && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Confirm Password</label>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="mt-1.5 h-10 bg-card"
                required
                minLength={6}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full h-10 bg-blue-600 hover:bg-blue-700" disabled={loading}>
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : isSetup ? (
              "Create Account & Login"
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <button
          onClick={onBack}
          className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground text-center"
        >
          ← Back to Lead Database
        </button>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────

function OverviewTab({
  token,
  dateRange,
  onSelectLead,
}: {
  token: string;
  dateRange: string;
  onSelectLead: (id: Id<"leads">) => void;
}) {
  const metrics = useQuery(api.pipeline.getMetrics, { token, dateRange });
  const pipelineLeads = useQuery(api.pipeline.getPipelineLeads, { token, limit: 20 });

  if (!metrics) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Calls" value={metrics.totalCalls} icon={<PhoneIcon className="h-4 w-4" />} color="blue" />
        <KpiCard label="Contacts Made" value={metrics.contacts} icon={<User className="h-4 w-4" />} color="emerald" />
        <KpiCard label="Contact Rate" value={`${metrics.contactRate}%`} icon={<TrendingUp className="h-4 w-4" />} color="amber" />
        <KpiCard label="Follow-Ups Due" value={metrics.followUpsToday} icon={<Clock className="h-4 w-4" />} color="red" />
      </div>

      {/* Pipeline Funnel */}
      <div className="bg-card rounded-xl border border-border/50 p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-400" />
          Pipeline Funnel
        </h3>
        <div className="space-y-2">
          {PIPELINE_STAGES.map((stage) => {
            const count = metrics.pipeline[stage.key as keyof typeof metrics.pipeline] || 0;
            const maxCount = metrics.totalLeads;
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <span className="text-xs w-28 md:w-36 truncate text-muted-foreground">{stage.emoji} {stage.label}</span>
                <div className="flex-1 h-6 bg-muted/30 rounded-md overflow-hidden relative">
                  <div
                    className={`h-full rounded-md transition-all duration-500 ${stage.color.split(" ")[0]}`}
                    style={{ width: `${Math.max(pct, count > 0 ? 1 : 0)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-xs font-mono font-semibold">
                    {count.toLocaleString()}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Call Outcomes Breakdown */}
      {Object.keys(metrics.outcomes).length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-emerald-400" />
            Call Outcomes
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {CALL_OUTCOMES.map((o) => {
              const count = metrics.outcomes[o.value] || 0;
              if (count === 0) return null;
              return (
                <div key={o.value} className="bg-muted/30 rounded-lg p-2.5 text-center">
                  <div className="text-lg">{o.icon}</div>
                  <div className="text-sm font-bold mt-0.5">{count}</div>
                  <div className="text-[10px] text-muted-foreground">{o.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Pipeline Leads */}
      {pipelineLeads && pipelineLeads.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-4">
          <h3 className="text-sm font-semibold mb-3">Recent Pipeline Activity</h3>
          <div className="space-y-1">
            {pipelineLeads.map((lead: any) => (
              <button
                key={lead._id}
                onClick={() => onSelectLead(lead._id)}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/30 active:bg-muted/50 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{lead.bizName}</p>
                  <p className="text-[11px] text-muted-foreground">{lead.customer} · {lead.city}, {lead.state}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge className={`text-[10px] px-1.5 ${getStage(lead.pipelineStatus || "no_contact").color}`}>
                    {getStage(lead.pipelineStatus || "no_contact").label}
                  </Badge>
                  {lead.totalAttempts > 0 && (
                    <span className="text-[10px] text-muted-foreground">{lead.totalAttempts} calls</span>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {metrics.totalCalls === 0 && (
        <div className="text-center py-12">
          <PhoneCall className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">No calls logged yet</h3>
          <p className="text-sm text-muted-foreground">
            Go to a lead from the database and start logging calls to see your metrics here.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.href = "/"}>
            Browse Leads
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Follow-Ups Tab ───────────────────────────────────────────────

function FollowUpsTab({
  token,
  onSelectLead,
}: {
  token: string;
  onSelectLead: (id: Id<"leads">) => void;
}) {
  const followUps = useQuery(api.pipeline.getFollowUps, { token });

  if (!followUps) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (followUps.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-1">No follow-ups due</h3>
        <p className="text-sm text-muted-foreground">
          Schedule follow-ups when logging calls and they'll appear here when due.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-2">
      <p className="text-xs text-muted-foreground px-1 mb-2">{followUps.length} follow-ups due</p>
      {followUps.map((lead: any) => (
        <button
          key={lead._id}
          onClick={() => onSelectLead(lead._id)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 hover:border-blue-500/30 active:bg-muted/30 transition-colors text-left"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{lead.bizName}</p>
            <p className="text-[11px] text-muted-foreground">{lead.customer} · {lead.phone}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`text-[10px] px-1.5 ${getStage(lead.pipelineStatus || "no_contact").color}`}>
                {getStage(lead.pipelineStatus || "no_contact").label}
              </Badge>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due: {new Date(lead.nextFollowUp).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {lead.attFiberAvailable && <span className="text-[10px]">🔵 Fiber</span>}
            {lead.attAirAvailable && <span className="text-[10px]">📡 Air</span>}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Activity Tab ─────────────────────────────────────────────────

function ActivityTab({
  token,
  onSelectLead,
}: {
  token: string;
  onSelectLead: (id: Id<"leads">) => void;
}) {
  const pipelineLeads = useQuery(api.pipeline.getPipelineLeads, { token, limit: 100 });

  if (!pipelineLeads) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (pipelineLeads.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-1">No activity yet</h3>
        <p className="text-sm text-muted-foreground">Start logging calls to see your activity feed here.</p>
      </div>
    );
  }

  // Group by status
  const grouped: Record<string, any[]> = {};
  for (const lead of pipelineLeads) {
    const status = lead.pipelineStatus || "attempted";
    if (!grouped[status]) grouped[status] = [];
    grouped[status].push(lead);
  }

  return (
    <div className="p-3 md:p-6 space-y-6">
      {PIPELINE_STAGES.filter((s) => grouped[s.key]?.length).map((stage) => (
        <div key={stage.key}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
            {stage.emoji} {stage.label}
            <Badge variant="outline" className="text-[10px] ml-1">{grouped[stage.key].length}</Badge>
          </h3>
          <div className="space-y-1">
            {grouped[stage.key].map((lead: any) => (
              <button
                key={lead._id}
                onClick={() => onSelectLead(lead._id)}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/30 active:bg-muted/50 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{lead.bizName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {lead.customer} · {lead.city}, {lead.state}
                    {lead.totalAttempts > 0 && ` · ${lead.totalAttempts} calls`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {lead.lastContactAt && (
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(lead.lastContactAt).toLocaleDateString()}
                    </span>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Lead Action Sheet (Call Logging + Notes) ─────────────────────

function LeadActionSheet({
  token,
  leadId,
  onClose,
}: {
  token: string;
  leadId: Id<"leads">;
  onClose: () => void;
}) {
  const lead = useQuery(api.leads.getById, { id: leadId });
  const callLogs = useQuery(api.pipeline.getCallLogs, { token, leadId });
  const notes = useQuery(api.pipeline.getNotes, { token, leadId });

  const logCallMutation = useMutation(api.pipeline.logCall);
  const addNoteMutation = useMutation(api.pipeline.addNote);
  const updateStatusMutation = useMutation(api.pipeline.updatePipelineStatus);

  const [showCallForm, setShowCallForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [callOutcome, setCallOutcome] = useState("no_answer");
  const [callNotes, setCallNotes] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleLogCall = async () => {
    setSaving(true);
    try {
      await logCallMutation({
        token,
        leadId,
        outcome: callOutcome,
        duration: callDuration ? parseInt(callDuration) * 60 : undefined,
        notes: callNotes || undefined,
        followUpDate: followUpDate || undefined,
        newStatus: newStatus || undefined,
      });
      setShowCallForm(false);
      setCallOutcome("no_answer");
      setCallNotes("");
      setCallDuration("");
      setFollowUpDate("");
      setNewStatus("");
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await addNoteMutation({ token, leadId, text: noteText.trim() });
      setNoteText("");
      setShowNoteForm(false);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleStatusChange = async (status: string) => {
    await updateStatusMutation({ token, leadId, status });
  };

  if (!lead) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full md:w-[520px] bg-card border-l border-border overflow-y-auto animate-in slide-in-from-right">
          <div className="flex items-center justify-center h-full">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        </div>
      </div>
    );
  }

  const currentStage = getStage(lead.pipelineStatus || "no_contact");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:w-[520px] bg-card border-l border-border overflow-y-auto animate-in slide-in-from-right">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border p-3 md:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base md:text-lg font-bold truncate">{lead.bizName}</h2>
              <p className="text-xs text-muted-foreground">{lead.customer} · {lead.city}, {lead.state}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">✕</Button>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mt-3">
            <a href={`tel:${lead.phone}`} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-white py-2 text-xs font-medium active:bg-blue-700">
              <PhoneIcon className="h-3.5 w-3.5" /> Call {lead.phone}
            </a>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs"
              onClick={() => { setShowCallForm(true); setShowNoteForm(false); }}
            >
              <PhoneCall className="h-3.5 w-3.5" /> Log Call
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => { setShowNoteForm(true); setShowCallForm(false); }}
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="p-3 md:p-4 space-y-4">
          {/* Pipeline Status */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pipeline Status</h3>
            <div className="flex flex-wrap gap-1.5">
              {PIPELINE_STAGES.map((stage) => (
                <button
                  key={stage.key}
                  onClick={() => handleStatusChange(stage.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    currentStage.key === stage.key
                      ? stage.color + " ring-1 ring-current"
                      : "bg-muted/20 text-muted-foreground border-border/50 hover:bg-muted/40"
                  }`}
                >
                  {stage.emoji} {stage.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Call Logging Form */}
          {showCallForm && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 space-y-3">
              <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                <PhoneCall className="h-4 w-4" /> Log a Call
              </h3>

              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Outcome</label>
                <Select value={callOutcome} onValueChange={setCallOutcome}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CALL_OUTCOMES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.icon} {o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Duration (min)</label>
                  <Input
                    type="number"
                    value={callDuration}
                    onChange={(e) => setCallDuration(e.target.value)}
                    placeholder="5"
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Follow-Up Date</label>
                  <Input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Change Status To</label>
                <Select value={newStatus || "none"} onValueChange={(v) => setNewStatus(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No change —</SelectItem>
                    {PIPELINE_STAGES.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.emoji} {s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Notes</label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Call notes..."
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-xs min-h-[60px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs" onClick={handleLogCall} disabled={saving}>
                  {saving ? "Saving..." : "Save Call Log"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCallForm(false)} className="text-xs">Cancel</Button>
              </div>
            </div>
          )}

          {/* Note Form */}
          {showNoteForm && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 space-y-3">
              <h3 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Add Note
              </h3>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Type your note..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs min-h-[80px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 bg-purple-600 hover:bg-purple-700 text-xs" onClick={handleAddNote} disabled={saving || !noteText.trim()}>
                  {saving ? "Saving..." : "Save Note"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNoteForm(false)} className="text-xs">Cancel</Button>
              </div>
            </div>
          )}

          {/* ═══ CALL PREP BRIEF ═══ */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 text-blue-400">
              <ClipboardList className="h-3.5 w-3.5" /> Call Prep Brief
            </h3>

            {/* Conversion Score Banner */}
            {lead.conversionScore !== undefined && (
              <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                lead.heatClassification === "Lock" ? "bg-emerald-500/10 border-emerald-500/30" :
                lead.heatClassification === "Fire" ? "bg-orange-500/10 border-orange-500/30" :
                lead.heatClassification === "Hot" ? "bg-red-500/10 border-red-500/30" :
                lead.heatClassification === "Warm" ? "bg-yellow-500/10 border-yellow-500/30" :
                "bg-blue-500/10 border-blue-500/30"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {lead.heatClassification === "Lock" ? "🔒" :
                     lead.heatClassification === "Fire" ? "🔥" :
                     lead.heatClassification === "Hot" ? "🔴" :
                     lead.heatClassification === "Warm" ? "🟡" : "🔵"}
                  </span>
                  <div>
                    <span className={`text-sm font-bold ${
                      lead.heatClassification === "Lock" ? "text-emerald-400" :
                      lead.heatClassification === "Fire" ? "text-orange-400" :
                      lead.heatClassification === "Hot" ? "text-red-400" :
                      lead.heatClassification === "Warm" ? "text-yellow-400" : "text-blue-300"
                    }`}>{lead.heatClassification}</span>
                    <p className="text-[9px] text-muted-foreground">Conversion Score</p>
                  </div>
                </div>
                <span className={`text-xl font-black tabular-nums ${
                  lead.heatClassification === "Lock" ? "text-emerald-400" :
                  lead.heatClassification === "Fire" ? "text-orange-400" :
                  lead.heatClassification === "Hot" ? "text-red-400" :
                  lead.heatClassification === "Warm" ? "text-yellow-400" : "text-blue-300"
                }`}>{lead.conversionScore}<span className="text-[10px] opacity-50">/100</span></span>
              </div>
            )}

            {/* Account Intel */}
            <div className="bg-muted/15 rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">📋 Account Information</p>
              <InfoRow label="Account #" value={lead.externalId || "—"} />
              <InfoRow label="FastGem ID" value={lead.fastgemId || "—"} />
              <SplitAccountFields leadId={lead._id} rawValue={lead.attAccountNumber} />
              <InfoRow label="Retention Rep" value={lead.rep || "—"} />
              <InfoRow label="Lead Rep" value={lead.leadRep || "—"} />
              <InfoRow label="FG Status" value={lead.fgStatus || "—"} />
              <InfoRow label="FG Department" value={lead.fgDepartment || "—"} />
              <InfoRow label="Language" value={lead.language || "English"} />
            </div>

            {/* Customer Profile */}
            <div className="bg-muted/15 rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">👤 Customer Profile</p>
              <InfoRow label="Business" value={lead.bizName} />
              <InfoRow label="Contact" value={lead.customer} />
              <InfoRow label="Owner/DM Cell" value={lead.phone} isPhone />
              {lead.businessPhone && <InfoRow label="Business Phone" value={lead.businessPhone} isPhone />}
              <InfoRow label="Email" value={lead.email || "—"} />
              <InfoRow label="Address" value={lead.address ? `${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}` : `${lead.city}, ${lead.state} ${lead.zip}`} />
              {lead.bizType && <InfoRow label="Business Type" value={lead.bizType} />}
              {lead.googleBusinessStatus && (
                <InfoRow label="Google Status" value={lead.googleBusinessStatus === "OPERATIONAL" ? `✅ Verified${lead.googleRating ? ` · ⭐ ${lead.googleRating}` : ""}${lead.googleReviewCount ? ` (${lead.googleReviewCount} reviews)` : ""}` : lead.googleBusinessStatus === "CLOSED_PERMANENTLY" ? "❌ Closed Permanently" : lead.googleBusinessStatus} />
              )}
            </div>

            {/* Current Services (at Retention) */}
            <div className="bg-muted/15 rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">📡 Services at Retention</p>
              <InfoRow label="Speed Tier" value={lead.speedTier || "Unknown"} highlight />
              <InfoRow label="Internet Type" value={lead.internetType || "—"} />
              <InfoRow label="Phone Service" value={`${lead.phoneType || "None"}${lead.hasPots ? " (POTS ☎)" : ""}`} />
              <InfoRow label="TV Service" value={lead.tvService || "None"} />
              {lead.allPackages && <InfoRow label="All Packages" value={lead.allPackages} wrap />}
            </div>

            {/* Upgrade Opportunity */}
            <div className={`rounded-lg p-3 space-y-1.5 border ${
              lead.attFiberAvailable ? "bg-emerald-500/5 border-emerald-500/20" :
              lead.attAirAvailable ? "bg-sky-500/5 border-sky-500/20" :
              "bg-muted/15 border-border/30"
            }`}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">🚀 Upgrade Opportunity</p>
              <InfoRow
                label="AT&T Upgrade"
                value={lead.attFiberAvailable ? "🔵 AT&T Fiber Available" : lead.attAirAvailable ? "📡 AT&T Air Available" : lead.ispLastChecked ? "No Fiber/Air at address" : "Pending check"}
                highlight
              />
              {lead.inferredIsp && (
                <InfoRow label="Current ISP" value={`${lead.inferredIsp.includes("AT&T") ? "🔵" : "🔴"} ${lead.inferredIsp} (via ${lead.inferredIspSource?.replace("email:", "@") || "inference"})`} />
              )}
              {!lead.inferredIsp && lead.likelyIsp && (
                <InfoRow label="Likely ISP" value={`⚡ ${lead.likelyIsp} (${lead.likelyIspConfidence || "?"} confidence)`} />
              )}
              {lead.ispProviderCount !== undefined && lead.ispProviderCount > 0 && (
                <InfoRow label="Competitors" value={`${lead.ispProviderCount} ISPs at address`} />
              )}
              {(() => {
                if (!lead.ispData) return null;
                try {
                  const isps = JSON.parse(lead.ispData);
                  if (isps.length === 0) return null;
                  return (
                    <div className="pt-1">
                      <p className="text-[10px] text-muted-foreground mb-1">Available ISPs:</p>
                      <div className="flex flex-wrap gap-1">
                        {isps.slice(0, 6).map((p: any, i: number) => (
                          <span key={i} className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded">{p.name}</span>
                        ))}
                        {isps.length > 6 && <span className="text-[10px] text-muted-foreground">+{isps.length - 6} more</span>}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}
            </div>

            {/* Market Intelligence */}
            {(lead.zipMedianIncome || lead.fccSpeedComplaints !== undefined) && (
              <div className="bg-muted/15 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">📊 Market Intelligence</p>
                {lead.zipMedianIncome && <InfoRow label="Median Income" value={`$${Number(lead.zipMedianIncome).toLocaleString()}`} />}
                {lead.zipInternetPct && <InfoRow label="Internet %" value={`${lead.zipInternetPct}% with internet`} />}
                {lead.zipPopulation && <InfoRow label="ZIP Population" value={Number(lead.zipPopulation).toLocaleString()} />}
                {(lead.fccSpeedComplaints !== undefined || lead.fccAvailComplaints !== undefined) && (
                  <InfoRow label="FCC Complaints" value={`${lead.fccSpeedComplaints || 0} speed · ${lead.fccAvailComplaints || 0} avail in area`} />
                )}
                {lead.redditSentiment && <InfoRow label="Reddit Sentiment" value={lead.redditSentiment} />}
              </div>
            )}

            {/* Pipeline Activity */}
            <div className="bg-muted/15 rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">📞 Pipeline Activity</p>
              <InfoRow label="Status" value={`${currentStage.emoji} ${currentStage.label}`} />
              <InfoRow label="Total Attempts" value={String(lead.totalAttempts || 0)} />
              <InfoRow label="Last Contact" value={lead.lastContactAt ? new Date(lead.lastContactAt).toLocaleString() : "Never"} />
              {lead.nextFollowUp && <InfoRow label="Next Follow-Up" value={new Date(lead.nextFollowUp).toLocaleDateString()} highlight />}
            </div>
          </div>

          <Separator />

          {/* Call History */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Call History {callLogs && callLogs.length > 0 && `(${callLogs.length})`}
            </h3>
            {callLogs && callLogs.length > 0 ? (
              <div className="space-y-2">
                {callLogs.map((log: any) => {
                  const outcome = CALL_OUTCOMES.find((o) => o.value === log.outcome);
                  return (
                    <div key={log._id} className="bg-muted/20 rounded-lg p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{outcome?.icon} {outcome?.label || log.outcome}</span>
                        <span className="text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      {log.duration && (
                        <span className="text-muted-foreground">{Math.round(log.duration / 60)}m</span>
                      )}
                      {log.notes && <p className="text-muted-foreground mt-1">{log.notes}</p>}
                      {log.statusChange && (
                        <Badge className={`mt-1 text-[10px] ${getStage(log.statusChange).color}`}>
                          → {getStage(log.statusChange).label}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No calls logged yet</p>
            )}
          </div>

          <Separator />

          {/* Notes */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Notes {notes && notes.length > 0 && `(${notes.length})`}
            </h3>
            {notes && notes.length > 0 ? (
              <div className="space-y-2">
                {notes.map((note: any) => (
                  <div key={note._id} className="bg-muted/20 rounded-lg p-2.5 text-xs">
                    <p>{note.text}</p>
                    <p className="text-muted-foreground mt-1 text-[10px]">
                      {new Date(note.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No notes yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  return (
    <div className={`rounded-xl border p-3 md:p-4 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider opacity-70">{label}</span>
      </div>
      <div className="text-xl md:text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

// ─── Split Account Numbers (AT&T vs DirecTV) ─────────────────────────

function SplitAccountFields({ leadId, rawValue }: { leadId: any; rawValue?: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(rawValue || "");
  const [saving, setSaving] = useState(false);
  const updateField = useMutation(api.leads.updateField);

  useEffect(() => { setValue(rawValue || ""); }, [rawValue]);

  // Parse tagged format: "att:XXX|dtv:YYY|dish:ZZZ" or fallback to letter heuristic
  const parts = (rawValue || "").split("|").filter(Boolean);
  const isTagged = parts.some(p => /^(att|dtv|dish|other):/.test(p));
  
  let attAccts: string[] = [];
  let dtvAccts: string[] = [];
  
  if (isTagged) {
    const seen = new Set<string>();
    for (const p of parts) {
      const [tag, ...rest] = p.split(":");
      const acct = rest.join(":");
      if (!acct || seen.has(acct)) continue;
      seen.add(acct);
      if (tag === "att" || tag === "other") attAccts.push(acct);
      else if (tag === "dtv" || tag === "dish") dtvAccts.push(acct);
    }
  } else {
    // Fallback: letter-suffix = AT&T, numeric-only = DirecTV
    attAccts = parts.filter(p => /[A-Za-z]/.test(p));
    dtvAccts = parts.filter(p => !/[A-Za-z]/.test(p));
  }

  const save = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await updateField({ id: leadId, field: "attAccountNumber", value: value.trim() });
      setEditing(false);
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs py-0.5">
        <span className="text-muted-foreground shrink-0 min-w-[90px]">Acct #s</span>
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="e.g. 7181023237A|63821292"
            className="bg-background border border-border rounded px-2 py-0.5 text-xs text-right w-[180px] focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <button onClick={save} disabled={saving} className="text-green-400 hover:text-green-300 text-xs font-medium px-1">
            {saving ? "..." : "✓"}
          </button>
          <button onClick={() => { setEditing(false); setValue(rawValue || ""); }} className="text-muted-foreground hover:text-foreground text-xs px-1">
            ✕
          </button>
        </div>
      </div>
    );
  }

  if (!rawValue) {
    return (
      <>
        <div className="flex items-center justify-between gap-3 text-xs py-0.5">
          <span className="text-muted-foreground shrink-0 min-w-[90px]">AT&T Acct #</span>
          <button onClick={() => setEditing(true)} className="text-right group flex items-center gap-1">
            <span className="text-muted-foreground/50 italic">Tap to enter</span>
            <span className="text-muted-foreground/30 group-hover:text-muted-foreground text-[10px]">✎</span>
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs py-0.5">
          <span className="text-muted-foreground shrink-0 min-w-[90px]">DirecTV Acct #</span>
          <span className="text-muted-foreground/50 italic text-right">—</span>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 text-xs py-0.5">
        <span className="text-muted-foreground shrink-0 min-w-[90px]">AT&T Acct #</span>
        <button onClick={() => setEditing(true)} className="text-right group flex items-center gap-1">
          <span className="text-amber-400 font-medium">{attAccts.length > 0 ? attAccts.join(", ") : "—"}</span>
          <span className="text-muted-foreground/30 group-hover:text-muted-foreground text-[10px]">✎</span>
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs py-0.5">
        <span className="text-muted-foreground shrink-0 min-w-[90px]">DirecTV Acct #</span>
        <button onClick={() => setEditing(true)} className="text-right group flex items-center gap-1">
          <span className="text-cyan-400 font-medium">{dtvAccts.length > 0 ? dtvAccts.join(", ") : "—"}</span>
          <span className="text-muted-foreground/30 group-hover:text-muted-foreground text-[10px]">✎</span>
        </button>
      </div>
    </>
  );
}



// ─── Info Row for Call Prep Brief ────────────────────────────────

function InfoRow({ label, value, highlight, isPhone, wrap }: { label: string; value: string; highlight?: boolean; isPhone?: boolean; wrap?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs py-0.5">
      <span className="text-muted-foreground shrink-0 min-w-[90px]">{label}</span>
      {isPhone ? (
        <a href={`tel:${value}`} className="text-blue-400 active:text-blue-300 font-medium text-right">
          {value}
        </a>
      ) : (
        <span className={`text-right ${wrap ? "break-all" : "truncate"} ${highlight ? "font-bold text-foreground" : "text-foreground/90"}`}>
          {value}
        </span>
      )}
    </div>
  );
}
