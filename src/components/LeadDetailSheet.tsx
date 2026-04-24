import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { X, Phone, Mail, MapPin, Globe, Zap, ExternalLink, ClipboardList, Building2, TrendingUp, AlertTriangle, Star, MessageSquare } from "lucide-react";

export function LeadDetailSheet({
  leadId,
  onClose,
}: {
  leadId: Id<"leads">;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const lead = useQuery(api.leads.getById, { id: leadId });
  const updateField = useMutation(api.leads.updateField);

  if (!lead) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full md:w-[480px] bg-card border-l border-border overflow-y-auto animate-in slide-in-from-right">
          <div className="p-6 flex items-center justify-center h-full">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        </div>
      </div>
    );
  }

  // Parse ISP data
  let providers: any[] = [];
  if (lead.ispData) {
    try {
      providers = JSON.parse(lead.ispData);
    } catch {}
  }

  // Parse all packages into readable list
  const packages = lead.allPackages.split(", ").filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:w-[520px] bg-card border-l border-border overflow-y-auto animate-in slide-in-from-right">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border p-3 md:p-4 flex items-start justify-between">
          <div className="min-w-0 mr-2">
            <h2 className="text-base md:text-lg font-bold truncate">{lead.bizName}</h2>
            <p className="text-xs md:text-sm text-muted-foreground truncate">{lead.customer}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-3 md:p-4 space-y-4 md:space-y-5">
          {/* Quick Actions - Mobile */}
          <div className="flex gap-2 md:hidden">
            <a href={`tel:${lead.phone}`} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white py-2.5 text-sm font-medium active:bg-blue-700">
              <Phone className="h-4 w-4" /> Call
            </a>
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-muted text-foreground py-2.5 text-sm font-medium active:bg-muted/80 border border-border">
                <Mail className="h-4 w-4" /> Email
              </a>
            )}
          </div>

          {/* Conversion Score */}
          {lead.conversionScore !== undefined && (
            <div className={`p-3 rounded-xl border ${
              lead.heatClassification === "Lock" ? "bg-emerald-500/10 border-emerald-500/30" :
              lead.heatClassification === "Fire" ? "bg-orange-500/10 border-orange-500/30" :
              lead.heatClassification === "Hot" ? "bg-red-500/10 border-red-500/30" :
              lead.heatClassification === "Warm" ? "bg-yellow-500/10 border-yellow-500/30" :
              "bg-blue-500/10 border-blue-500/30"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`text-2xl`}>
                    {lead.heatClassification === "Lock" ? "🔒" :
                     lead.heatClassification === "Fire" ? "🔥" :
                     lead.heatClassification === "Hot" ? "🔴" :
                     lead.heatClassification === "Warm" ? "🟡" : "🔵"}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${
                      lead.heatClassification === "Lock" ? "text-emerald-400" :
                      lead.heatClassification === "Fire" ? "text-orange-400" :
                      lead.heatClassification === "Hot" ? "text-red-400" :
                      lead.heatClassification === "Warm" ? "text-yellow-400" : "text-blue-300"
                    }`}>{lead.heatClassification}</p>
                    <p className="text-[10px] text-muted-foreground">Conversion Classification</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-black tabular-nums ${
                    lead.heatClassification === "Lock" ? "text-emerald-400" :
                    lead.heatClassification === "Fire" ? "text-orange-400" :
                    lead.heatClassification === "Hot" ? "text-red-400" :
                    lead.heatClassification === "Warm" ? "text-yellow-400" : "text-blue-300"
                  }`}>{lead.conversionScore}</p>
                  <p className="text-[10px] text-muted-foreground">/ 100</p>
                </div>
              </div>
            </div>
          )}

          {/* Track in Pipeline Button */}
          <button
            onClick={() => navigate(`/pipeline?lead=${leadId}`)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 active:bg-blue-600/30 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <ClipboardList className="h-4 w-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-blue-400">Track in Pipeline</p>
                <p className="text-[10px] text-muted-foreground">Log calls, notes & follow-ups</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lead.pipelineStatus && lead.pipelineStatus !== "no_contact" && (
                <Badge className="text-[10px]">{lead.pipelineStatus.replace(/_/g, " ")}</Badge>
              )}
              {lead.totalAttempts ? (
                <span className="text-[10px] text-muted-foreground">{lead.totalAttempts} calls</span>
              ) : null}
              <span className="text-muted-foreground group-hover:text-blue-400 transition-colors">→</span>
            </div>
          </button>

          {/* Contact */}
          <Section title="Contact">
            <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Owner/DM Cell" value={lead.phone} />
            {lead.secondaryPhone && (
              <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone 2" value={lead.secondaryPhone} />
            )}
            {lead.businessPhone && (
              <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Business Phone" value={lead.businessPhone} />
            )}
            {lead.email && (
              <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={lead.email} />
            )}
            <InfoRow
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Address"
              value={`${lead.address}${lead.address2 ? ` ${lead.address2}` : ""}, ${lead.city}, ${lead.state} ${lead.zip}`}
            />
          </Section>

          <Separator />

          {/* Current Services */}
          <Section title="Current Services (at Retention)">
            <div className="grid grid-cols-2 gap-3">
              <DetailBadge label="Speed Tier" value={lead.speedTier || "Unknown"} color={getSpeedBadgeColor(lead.speedTier)} />
              <DetailBadge label="Phone Type" value={lead.phoneType || "None"} color={lead.hasPots ? "amber" : "blue"} />
              <DetailBadge label="Internet" value={lead.internetType || "Unknown"} color="purple" />
              <DetailBadge label="TV Service" value={lead.tvService || "None"} color="teal" />
            </div>
            {lead.hasPots && (
              <div className="mt-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-400 font-medium">⚡ POTS Line Detected — AT&T is discontinuing copper lines</p>
              </div>
            )}
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">All Packages</p>
              <div className="flex flex-wrap gap-1.5">
                {packages.map((pkg, i) => (
                  <span key={i} className="text-[11px] bg-muted/50 px-2 py-1 rounded border border-border/50">
                    {pkg}
                  </span>
                ))}
              </div>
            </div>
          </Section>

          <Separator />

          {/* AT&T Upgrade Eligibility */}
          <Section title="AT&T Upgrade Eligibility">
            {lead.ispLastChecked ? (
              <div className="space-y-2">
                {lead.attFiberAvailable ? (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-400">AT&T Fiber Available</span>
                    </div>
                    <p className="text-xs text-emerald-400/80 mt-1">This address can be upgraded to AT&T Fiber <span className="text-emerald-400/50">(FCC-Reported)</span></p>
                  </div>
                ) : lead.attAirAvailable ? (
                  <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-sky-400" />
                      <span className="text-sm font-semibold text-sky-400">AT&T Internet Air Available</span>
                    </div>
                    <p className="text-xs text-sky-400/80 mt-1">No Fiber, but Internet Air (Fixed Wireless) is available <span className="text-sky-400/50">(FCC-Reported)</span></p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm text-muted-foreground">No AT&T Fiber or Air availability detected at this address</p>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">Source: FCC Broadband Map (Nov 2025) · {lead.ispLastChecked}</p>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm text-muted-foreground">ISP availability check pending</p>
              </div>
            )}
          </Section>

          <Separator />

          {/* Current/Inferred ISP */}
          {(lead.inferredIsp || lead.likelyIsp) && (
            <>
              <Section title="Current ISP Intelligence">
                {lead.inferredIsp && (
                  <div className={`p-3 rounded-lg border ${
                    lead.inferredIsp.includes("AT&T")
                      ? "bg-blue-500/10 border-blue-500/20"
                      : "bg-rose-500/10 border-rose-500/20"
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {lead.inferredIsp.includes("AT&T") ? "🔵" : "🔴"} Confirmed: {lead.inferredIsp}
                      </span>
                    </div>
                    {lead.inferredIspSource && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Source: {lead.inferredIspSource.replace("email:", "Email domain @")}
                      </p>
                    )}
                  </div>
                )}
                {lead.likelyIsp && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border mt-2">
                    <p className="text-sm font-medium">⚡ Top Competitor: {lead.likelyIsp.replace("Top: ", "")}</p>
                    {lead.likelyIspConfidence && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Confidence: {lead.likelyIspConfidence === "high" ? "●●● High" : lead.likelyIspConfidence === "medium" ? "●●○ Medium" : "●○○ Low"}
                      </p>
                    )}
                  </div>
                )}
              </Section>
              <Separator />
            </>
          )}

          {/* ISP Availability */}
          <Section title="Available ISPs at This Address">
            {providers.length > 0 ? (
              <div className="space-y-2">
                {providers.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/50">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.technology}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-blue-400">{p.max_download_mbps} Mbps</p>
                      <p className="text-[10px] text-muted-foreground">↓ Down / {p.max_upload_mbps} ↑ Up</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : lead.ispLastChecked ? (
              <p className="text-sm text-muted-foreground">No ISP data available</p>
            ) : (
              <p className="text-sm text-muted-foreground">ISP lookup pending — data will appear once enrichment runs</p>
            )}
          </Section>

          <Separator />

          {/* Business Intelligence */}
          {(lead.bizType || lead.googleRating || lead.googleBusinessStatus) && (
            <>
              <Section title="Business Intelligence">
                <div className="space-y-2">
                  {/* Google Verification */}
                  {lead.googleBusinessStatus && (
                    <div className={`p-3 rounded-lg border ${
                      lead.businessStatusOverride === "open_verified"
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : lead.googleBusinessStatus === "OPERATIONAL"
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : lead.googleBusinessStatus === "CLOSED_PERMANENTLY"
                        ? "bg-red-500/10 border-red-500/20"
                        : "bg-amber-500/10 border-amber-500/20"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span className="text-sm font-semibold">
                            {lead.businessStatusOverride === "open_verified"
                              ? "✅ Open (Verified)"
                              : lead.googleBusinessStatus === "OPERATIONAL" ? "✅ Verified Open" :
                             lead.googleBusinessStatus === "CLOSED_PERMANENTLY" ? "❌ Reported Closed (Verify)" :
                             lead.googleBusinessStatus === "CLOSED_TEMPORARILY" ? "⚠️ Temporarily Closed" :
                             lead.googleBusinessStatus}
                          </span>
                        </div>
                        {/* Override button for closed businesses */}
                        {lead.googleBusinessStatus === "CLOSED_PERMANENTLY" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-6 text-[10px] px-2 ${lead.businessStatusOverride === "open_verified" ? "text-amber-400 hover:text-amber-300" : "text-green-400 hover:text-green-300"}`}
                            onClick={() => updateField({
                              id: leadId,
                              field: "businessStatusOverride",
                              value: lead.businessStatusOverride === "open_verified" ? undefined : "open_verified",
                            })}
                          >
                            {lead.businessStatusOverride === "open_verified" ? "↩ Undo" : "✅ Mark Open"}
                          </Button>
                        )}
                        {lead.googleRating && (
                          <div className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                            <span className="text-sm font-bold text-yellow-400">{lead.googleRating}</span>
                            {lead.googleReviewCount && (
                              <span className="text-[10px] text-muted-foreground">({lead.googleReviewCount})</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {lead.bizType && (
                      <DetailBadge label="Business Type" value={lead.bizType} color="purple" />
                    )}
                    {lead.businessPhone && (
                      <div className="p-2 rounded-md border bg-blue-500/10 border-blue-500/20 text-blue-400">
                        <p className="text-[10px] uppercase tracking-wider opacity-70">Business Phone</p>
                        <p className="text-sm font-semibold">{lead.businessPhone}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Section>
              <Separator />
            </>
          )}

          {/* Market Intelligence */}
          {(lead.zipMedianIncome || lead.zipPopulation || lead.fccTotalComplaints !== undefined) && (
            <>
              <Section title="Market Intelligence">
                <div className="space-y-3">
                  {/* Census Demographics */}
                  {(lead.zipMedianIncome || lead.zipPopulation || lead.zipInternetPct) && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <TrendingUp className="h-3 w-3" /> Census Data (ZIP {lead.zip})
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {lead.zipMedianIncome && (
                          <div>
                            <p className="text-[10px] text-muted-foreground">Median Income</p>
                            <p className="text-sm font-bold text-emerald-400">${(lead.zipMedianIncome / 1000).toFixed(0)}K</p>
                          </div>
                        )}
                        {lead.zipPopulation && (
                          <div>
                            <p className="text-[10px] text-muted-foreground">Population</p>
                            <p className="text-sm font-bold">{lead.zipPopulation.toLocaleString()}</p>
                          </div>
                        )}
                        {lead.zipInternetPct && (
                          <div>
                            <p className="text-[10px] text-muted-foreground">Internet %</p>
                            <p className="text-sm font-bold text-blue-400">{lead.zipInternetPct}%</p>
                          </div>
                        )}
                      </div>
                      {(lead.zipBizCount || lead.zipBizEmployees) && (
                        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/30">
                          {lead.zipBizCount && (
                            <div>
                              <p className="text-[10px] text-muted-foreground">Businesses in ZIP</p>
                              <p className="text-sm font-bold">{lead.zipBizCount.toLocaleString()}</p>
                            </div>
                          )}
                          {lead.zipBizEmployees && (
                            <div>
                              <p className="text-[10px] text-muted-foreground">Employees in ZIP</p>
                              <p className="text-sm font-bold">{lead.zipBizEmployees.toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* FCC Complaints */}
                  {lead.fccTotalComplaints !== undefined && lead.fccTotalComplaints > 0 && (
                    <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3" /> FCC Complaints (ZIP {lead.zip})
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Speed</p>
                          <p className="text-sm font-bold text-orange-400">{lead.fccSpeedComplaints || 0}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Availability</p>
                          <p className="text-sm font-bold text-orange-400">{lead.fccAvailComplaints || 0}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Total</p>
                          <p className="text-sm font-bold text-orange-300">{lead.fccTotalComplaints}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-orange-400/60 mt-1">Higher complaints = more frustrated customers in area</p>
                    </div>
                  )}

                  {/* Reddit Sentiment */}
                  {lead.redditSentiment && (() => {
                    try {
                      const posts = JSON.parse(lead.redditSentiment);
                      if (posts.length === 0) return null;
                      return (
                        <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                          <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <MessageSquare className="h-3 w-3" /> Reddit ISP Sentiment ({lead.city})
                          </p>
                          <div className="space-y-1.5">
                            {posts.slice(0, 3).map((post: any, i: number) => (
                              <a
                                key={i}
                                href={post.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-xs hover:text-indigo-300 transition-colors"
                              >
                                <div className="flex items-start gap-2">
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">r/{post.subreddit}</span>
                                  <span className="text-indigo-300/80 line-clamp-1">{post.title}</span>
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-auto">▲{post.score}</span>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      );
                    } catch { return null; }
                  })()}
                </div>
              </Section>
              <Separator />
            </>
          )}

          {/* Lead Info */}
          <Section title="Lead Details">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Status:</span> <span className="capitalize">{lead.leadStatus.replace(/_/g, " ")}</span></div>
              <div><span className="text-muted-foreground">FG Status:</span> {lead.fgStatus || "—"}</div>
              <div><span className="text-muted-foreground">FG Dept:</span> {lead.fgDepartment || "—"}</div>
              <div><span className="text-muted-foreground">Rep:</span> {lead.rep || "—"}</div>
              <div><span className="text-muted-foreground">Lead Rep:</span> {lead.leadRep || "—"}</div>
              <div><span className="text-muted-foreground">Calls:</span> {lead.callAttempts}</div>
              <div><span className="text-muted-foreground">Callable:</span> {lead.callable ? "Yes" : "No"}</div>
              <div><span className="text-muted-foreground">Bad Phone:</span> {lead.badPhone ? "Yes" : "No"}</div>
              <div><span className="text-muted-foreground">Language:</span> {lead.language || "EN"}</div>
              <div><span className="text-muted-foreground">ID:</span> {lead.externalId}</div>
            </div>
          </Section>

          {/* Map Link */}
          {lead.lat && lead.lng && (
            <>
              <Separator />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View on Google Maps
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <span className="text-muted-foreground text-xs">{label}</span>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

function DetailBadge({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    red: "bg-red-500/10 border-red-500/20 text-red-400",
    orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    teal: "bg-teal-500/10 border-teal-500/20 text-teal-400",
  };
  return (
    <div className={`p-2 rounded-md border ${colorMap[color] || colorMap.blue}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function getSpeedBadgeColor(tier?: string): string {
  switch (tier) {
    case "1.5M-25M": return "red";
    case "45M-50M": return "orange";
    case "75M-100M": return "yellow";
    case "100M+": return "emerald";
    default: return "blue";
  }
}
