// Mirrors the backend's admin DTOs (lungdi_backend/src/admin/dto/*.ts). Kept
// hand-written rather than generated — the backend has no OpenAPI client
// generation step wired up yet, and this surface is small enough that
// duplicating the shapes costs less than adding a codegen step for v1.

export type AccountStatus =
  | "active"
  | "deactivated"
  | "deleted"
  | "suspended"
  | "banned";

export type VerificationStatus =
  | "not_started"
  | "processing"
  | "verified"
  | "failed";

export type ReportStatus = "pending" | "reviewed" | "action_taken" | "dismissed";

// ---- Auth ----

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  lastLoginAt: string | null;
}

export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  admin: AdminProfile;
}

// ---- Users ----

export interface AdminUserListItem {
  id: string;
  name: string | null;
  phoneNumber: string;
  email: string | null;
  status: AccountStatus;
  verificationStatus: VerificationStatus;
  profileComplete: boolean;
  profilePictureSmallUrl: string | null;
  createdAt: string;
}

export interface AdminUserListResponse {
  users: AdminUserListItem[];
  nextCursor: string | null;
}

export interface AdminPhoto {
  id: string;
  url: string;
  status: string;
  order: number;
  createdAt: string;
}

export interface AdminCurrentSubscription {
  status: string;
  billingCycle: string;
  paymentProvider: string;
  autoRenew: boolean;
  expiryDate: string;
  planName: string;
}

export interface AdminUserCounts {
  connections: number;
  reportsFiled: number;
  reportsAgainst: number;
  blocksMade: number;
  blocksReceived: number;
}

export interface AdminUserDetail {
  id: string;
  phoneNumber: string;
  email: string | null;
  name: string | null;
  gender: string | null;
  interestedIn: string | null;
  dateOfBirth: string | null;
  designation: string | null;
  bio: string | null;
  profilePictureUrl: string | null;
  verificationStatus: VerificationStatus;
  profileComplete: boolean;
  status: AccountStatus;
  suspendedUntil: string | null;
  statusReason: string | null;
  statusChangedAt: string | null;
  createdAt: string;
  photos: AdminPhoto[];
  interests: string[];
  counts: AdminUserCounts;
  currentSubscription: AdminCurrentSubscription | null;
}

// ---- Moderation ----

export interface AdminReportListItem {
  id: string;
  reporterId: string;
  reporterName: string | null;
  reportedId: string;
  reportedName: string | null;
  reportedProfilePictureSmallUrl: string | null;
  reason: string;
  status: ReportStatus;
  createdAt: string;
}

export interface AdminReportListResponse {
  reports: AdminReportListItem[];
  nextCursor: string | null;
}

export interface AdminReportDetail extends AdminReportListItem {
  details: string | null;
  conversationId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
  reportsAgainstCount: number;
}

// ---- Ops ----

export interface AdminRealtimeStats {
  onlineUsers: number;
  openSockets: number;
  socketNodes: number;
  socketStatsCached: boolean;
}

export interface AdminQueueStats {
  name: string;
  counts: Record<string, number>;
  recentFailures: { id: string; failedReason: string | null; timestamp: number }[];
}

export interface AdminSystemStats {
  pid: number;
  uptimeSeconds: number;
  nodeVersion: string;
  memory: { rssBytes: number; heapUsedBytes: number; heapTotalBytes: number };
  db: { totalCount: number; idleCount: number; waitingCount: number };
  redis: { usedMemoryBytes: number | null; connectedClients: number | null };
}

// ---- Metrics ----

export interface AdminOverview {
  totalUsers: number;
  newUsersInRange: number;
  activeSubscriptions: number;
  pendingReports: number;
  verifiedUsers: number;
  profileCompleteUsers: number;
  activeDevices24h: number;
  loginsInRange: number;
  estimatedMrrPaise: number;
}

export interface AdminTimeseriesPoint {
  date: string;
  count: number;
}

export type TimeseriesMetric = "signups" | "logins" | "messages" | "newSubscriptions";

export interface AdminFunnel {
  registered: number;
  profileComplete: number;
  verified: number;
  subscribed: number;
}

// ---- Plans ----

export interface AdminPlan {
  id: string;
  name: string;
  price3Month: number;
  price6Month: number;
  price12Month: number;
  currency: string;
  features: string[];
  active: boolean;
  razorpayPlanId3Month: string | null;
  razorpayPlanId6Month: string | null;
  razorpayPlanId12Month: string | null;
  appleProductId3Month: string | null;
  appleProductId6Month: string | null;
  appleProductId12Month: string | null;
  createdAt: string;
}

export interface CreatePlanInput {
  name: string;
  price3Month: number;
  price6Month: number;
  price12Month: number;
  currency?: string;
  features?: string[];
  razorpayPlanId3Month?: string;
  razorpayPlanId6Month?: string;
  razorpayPlanId12Month?: string;
  appleProductId3Month?: string;
  appleProductId6Month?: string;
  appleProductId12Month?: string;
}

export type UpdatePlanInput = Partial<CreatePlanInput> & { active?: boolean };

// ---- Payment provider settings (Razorpay/Apple IAP kill-switch) ----

export interface AdminPaymentProviderSetting {
  provider: "razorpay" | "apple";
  enabled: boolean;
  updatedAt: string;
}

// ---- Interests ----

export interface AdminInterest {
  id: string;
  name: string;
  category: string | null;
  type: "hobby" | "interest";
  userCount: number;
}

// ---- Broadcast ----

export interface AdminAudienceFilter {
  status?: AccountStatus[];
  verification?: VerificationStatus[];
}

export interface AdminBroadcastResult {
  broadcastId: string;
  audienceSize: number;
}

// ---- Audit log ----

export interface AdminAuditLogEntry {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

export interface AdminAuditLogListResponse {
  entries: AdminAuditLogEntry[];
  nextCursor: string | null;
}
