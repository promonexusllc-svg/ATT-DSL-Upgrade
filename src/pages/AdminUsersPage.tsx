import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, UserX, UserCheck, Crown, RefreshCw } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

export function AdminUsersPage() {
  const currentUser = useQuery(api.users.currentUserProfile);
  const allUsers = useQuery(api.users.listAllUsers);
  const approveUser = useMutation(api.users.approveUser);
  const deactivateUser = useMutation(api.users.deactivateUser);
  const setUserRole = useMutation(api.users.setUserRole);
  const bootstrapAdmin = useMutation(api.users.bootstrapAdmin);

  // If not admin, show bootstrap option or access denied
  if (currentUser && currentUser.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md mx-auto p-8">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground">
            You need admin privileges to view this page.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              const result = await bootstrapAdmin();
              if (result.success) {
                window.location.reload();
              } else {
                alert(result.message);
              }
            }}
          >
            <Crown className="h-4 w-4 mr-2" />
            Become Admin (first-time setup)
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Only works if no admin exists yet.
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage active users and control access to the lead database
            </p>
          </div>
          <Badge variant="outline" className="text-xs px-3 py-1 border-emerald-500/40 text-emerald-400">
            <ShieldCheck className="h-3 w-3 mr-1.5" />
            Admin
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-border/50 bg-card">
            <p className="text-2xl font-bold">{allUsers?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </div>
          <div className="p-4 rounded-xl border border-border/50 bg-card">
            <p className="text-2xl font-bold text-emerald-400">{allUsers?.filter(u => u.isApproved).length || 0}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="p-4 rounded-xl border border-border/50 bg-card">
            <p className="text-2xl font-bold text-amber-400">{allUsers?.filter(u => !u.isApproved).length || 0}</p>
            <p className="text-xs text-muted-foreground">Pending / Deactivated</p>
          </div>
        </div>

        {/* Users Table */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30 bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Joined</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {allUsers?.map((user) => {
                const isCurrentUser = user._id === currentUser._id;
                return (
                  <tr key={user._id} className="border-b border-border/20 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                          user.role === "admin" ? "bg-purple-600" : user.isApproved ? "bg-blue-600" : "bg-gray-500"
                        }`}>
                          {(user.name || user.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {user.name || "—"}
                            {isCurrentUser && <span className="text-[10px] text-muted-foreground ml-1.5">(you)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{user.email || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[11px] capitalize ${
                          user.role === "admin"
                            ? "border-purple-500/40 text-purple-400"
                            : "border-blue-500/40 text-blue-400"
                        }`}
                      >
                        {user.role === "admin" && <Crown className="h-2.5 w-2.5 mr-1" />}
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {user.isApproved ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[11px]">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[11px]">
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(user._creationTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isCurrentUser && (
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle approve/deactivate */}
                          {user.isApproved ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => deactivateUser({ userId: user._id })}
                            >
                              <UserX className="h-3 w-3 mr-1" />
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                              onClick={() => approveUser({ userId: user._id })}
                            >
                              <UserCheck className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                          )}
                          {/* Toggle role */}
                          {user.role === "rep" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                              onClick={() => setUserRole({ userId: user._id, role: "admin" })}
                            >
                              <Crown className="h-3 w-3 mr-1" />
                              Make Admin
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => setUserRole({ userId: user._id, role: "rep" })}
                            >
                              Demote to Rep
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!allUsers || allUsers.length === 0) && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
