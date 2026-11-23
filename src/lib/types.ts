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
  lookingFor: string | null;
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
  /** Why they deactivated/deleted, newest first (empty if they never did). */
  exitFeedback: AdminExitFeedback[];
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
  createdAt: string;
}

export interface CreatePlanInput {
  name: string;
  price3Month: number;
  price6Month: number;
  price12Month: number;
  currency?: string;
  features?: string[];
}

export type UpdatePlanInput = Partial<CreatePlanInput> & { active?: boolean };

export type ProviderBillingCycle = "3_month" | "6_month" | "12_month";

export interface AdminRazorpayPlan {
  id: string;
  planId: string;
  planName: string;
  billingCycle: ProviderBillingCycle;
  razorpayPlanId: string;
  price: number;
  currency: string;
  active: boolean;
  createdAt: string;
}

export interface CreateRazorpayPlanInput {
  planId: string;
  billingCycle: ProviderBillingCycle;
  price: number;
  currency?: string;
  /** Omit to have the backend create the plan on Razorpay. */
  razorpayPlanId?: string;
}

export interface AdminIapProduct {
  id: string;
  planId: string;
  planName: string;
  billingCycle: ProviderBillingCycle;
  appleProductId: string;
  price: number;
  currency: string;
  active: boolean;
  createdAt: string;
}

export interface CreateIapProductInput {
  planId: string;
  billingCycle: ProviderBillingCycle;
  appleProductId: string;
  price: number;
  currency?: string;
}

export type UpdateIapProductInput = {
  price?: number;
  currency?: string;
  active?: boolean;
};

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
  // Legacy text grouping; follows the category name when categoryId is set.
  category: string | null;
  categoryId: string | null;
  type: "hobby" | "interest";
  userCount: number;
}

// ---- Interest categories ("What are you into") ----

export interface AdminInterestCategory {
  id: string;
  nameEn: string;
  nameMz: string | null;
  sortOrder: number;
  active: boolean;
  interestCount: number;
}

export interface CreateInterestCategoryInput {
  nameEn: string;
  nameMz?: string;
  sortOrder?: number;
}

export interface UpdateInterestCategoryInput {
  nameEn?: string;
  nameMz?: string | null;
  sortOrder?: number;
  active?: boolean;
}

// ---- Profile fields (profile questions + options) ----

export type ProfileFieldSection =
  | "appearance"
  | "looking_for"
  | "education"
  | "lifestyle"
  | "into"
  | "social"
  | "church"
  | "about";

export interface AdminProfileFieldOption {
  id: string;
  labelEn: string;
  labelMz: string | null;
  allowsText: boolean;
  textLabelEn: string | null;
  textLabelMz: string | null;
  sortOrder: number;
  active: boolean;
  userCount: number;
}

export interface AdminProfileField {
  id: string;
  key: string;
  labelEn: string;
  labelMz: string | null;
  section: ProfileFieldSection;
  multiSelect: boolean;
  userCanHide: boolean;
  required: boolean;
  sortOrder: number;
  active: boolean;
  options: AdminProfileFieldOption[];
}

export interface CreateProfileFieldInput {
  key: string;
  labelEn: string;
  labelMz?: string;
  section: ProfileFieldSection;
  multiSelect?: boolean;
  userCanHide?: boolean;
  required?: boolean;
  sortOrder?: number;
}

export interface UpdateProfileFieldInput {
  labelEn?: string;
  labelMz?: string | null;
  section?: ProfileFieldSection;
  multiSelect?: boolean;
  userCanHide?: boolean;
  required?: boolean;
  sortOrder?: number;
  active?: boolean;
}

export interface ProfileFieldOptionInput {
  labelEn?: string;
  labelMz?: string | null;
  allowsText?: boolean;
  textLabelEn?: string | null;
  textLabelMz?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export interface AdminDesignation {
  id: string;
  name: string;
  active: boolean;
  userCount: number;
}

export interface CreateDesignationInput {
  name: string;
}

export interface UpdateDesignationInput {
  name?: string;
  active?: boolean;
}

export interface AdminRelationshipStatus {
  id: string;
  name: string;
  active: boolean;
  userCount: number;
}

export interface CreateRelationshipStatusInput {
  name: string;
}

export interface UpdateRelationshipStatusInput {
  name?: string;
  active?: boolean;
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

// ---- Payments (ledger) ----

export type PaymentStatus = "succeeded" | "failed" | "refunded";
export type PaymentProvider = "razorpay" | "apple";

export interface AdminPayment {
  id: string;
  userId: string | null;
  userName: string | null;
  userPhone: string | null;
  planName: string | null;
  billingCycle: string | null;
  provider: PaymentProvider;
  status: PaymentStatus;
  /** Minor units (paise). Null when the provider gave no amount. */
  amount: number | null;
  currency: string | null;
  providerPaymentId: string;
  failureCode: string | null;
  failureReason: string | null;
  environment: string | null;
  occurredAt: string;
}

export interface AdminPaymentsListResponse {
  payments: AdminPayment[];
  nextCursor: string | null;
}

export interface AdminPaymentsSummary {
  revenue: {
    currency: string;
    collected: number;
    refunded: number;
    net: number;
  }[];
  byProvider: {
    provider: PaymentProvider;
    currency: string;
    net: number;
    succeeded: number;
    failed: number;
  }[];
  succeededCount: number;
  failedCount: number;
  refundedCount: number;
  /** 0–1, null when there were no attempts. */
  successRate: number | null;
}

export interface AdminRevenuePoint {
  date: string;
  /** Net revenue that day, minor units. */
  amount: number;
}

// ---------------------------------------------------------------------------
// Video calls — GET /admin/calls/* (backend src/admin/admin-calls.*)
// ---------------------------------------------------------------------------

export type CallState =
  | "ringing"
  | "accepted"
  | "connected"
  | "ended"
  | "rejected"
  | "missed"
  | "cancelled"
  | "failed";

export type CallTimeseriesMetric =
  | "calls"
  | "connected"
  | "failed"
  | "minutes"
  | "relay_pct"
  | "avg_rtt"
  | "turn_gb";

export type CallSignalLevel = "ok" | "info" | "warning" | "critical";

export interface AdminCallSignal {
  key: string;
  level: CallSignalLevel;
  title: string;
  detail: string;
}

export interface AdminCallsOverview {
  rangeDays: number;
  calls: {
    attempts: number;
    answered: number;
    connected: number;
    missed: number;
    rejected: number;
    cancelled: number;
    failed: number;
    busy: number;
    uniqueCallers: number;
    liveCalls: number;
  };
  rates: {
    answerRatePct: number | null;
    connectionSuccessPct: number | null;
    failureRatePct: number | null;
  };
  minutes: {
    total: number;
    avgCallSeconds: number | null;
    avgAnswerSeconds: number | null;
  };
  network: {
    reportedCalls: number;
    directPct: number | null;
    relayPct: number | null;
    avgRttMs: number | null;
    p95RttMs: number | null;
    avgPacketLossPct: number | null;
    avgIceSetupMs: number | null;
  };
  turn: {
    usageSyncEnabled: boolean;
    monthEgressGb: number;
    monthIngressGb: number;
    rangeEgressGb: number;
    freeTierGb: number;
    freeTierUsedPct: number;
    projectedMonthEgressGb: number;
    projectedOverageGb: number;
    pricePerGbUsd: number;
    estimatedMonthCostUsd: number;
    lastSyncedAt: string | null;
  };
  signals: AdminCallSignal[];
}

export interface AdminCallsPoint {
  date: string;
  value: number;
}

export interface AdminCallsBreakdown {
  endReasons: { state: CallState; endReason: string | null; count: number }[];
  connectionTypes: {
    connectionType: "direct_host" | "direct_srflx" | "relay" | "unknown";
    networkType: "wifi" | "cellular" | "unknown";
    count: number;
  }[];
  appVersions: {
    appVersion: string;
    reports: number;
    relayPct: number;
    avgRttMs: number | null;
    avgPacketLossPct: number | null;
  }[];
}

export interface AdminCallTopCaller {
  userId: string;
  name: string | null;
  attempts: number;
  connected: number;
  rejectedOrMissed: number;
  totalSeconds: number;
}

export interface AdminCall {
  id: string;
  callerId: string;
  callerName: string | null;
  calleeId: string;
  calleeName: string | null;
  mediaType: "video" | "audio";
  state: CallState;
  endReason: string | null;
  createdAt: string;
  connectedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  relayed: boolean | null;
}

export interface AdminCallsListResponse {
  calls: AdminCall[];
  nextCursor: string | null;
}

export interface AdminCallReport {
  userId: string;
  connectionType: string;
  relayProtocol: string | null;
  networkType: string;
  avgRttMs: number | null;
  packetLossPct: number | null;
  avgBitrateKbps: number | null;
  avgFrameRate: number | null;
  freezeCount: number | null;
  iceSetupMs: number | null;
  bytesSent: number | null;
  bytesReceived: number | null;
  appVersion: string | null;
  osVersion: string | null;
}

export interface AdminCallDetail {
  call: AdminCall;
  reports: AdminCallReport[];
}

// ---------------------------------------------------------------------------
// Leaving reasons — "why are you leaving?" (backend src/admin/admin-exit-reasons.*)
// ---------------------------------------------------------------------------

export type ExitAction = "deactivate" | "delete";

export interface AdminExitReason {
  id: string;
  labelEn: string;
  labelMz: string | null;
  forDeactivate: boolean;
  forDelete: boolean;
  /** The "Other" option: the app shows a free-text box for it. */
  allowsText: boolean;
  sortOrder: number;
  active: boolean;
  /** How many exits chose this reason. */
  usageCount: number;
}

export interface CreateExitReasonInput {
  labelEn: string;
  labelMz?: string;
  forDeactivate?: boolean;
  forDelete?: boolean;
  allowsText?: boolean;
  sortOrder?: number;
}

export interface UpdateExitReasonInput {
  labelEn?: string;
  /** null or "" clears the Mizo label. */
  labelMz?: string | null;
  forDeactivate?: boolean;
  forDelete?: boolean;
  allowsText?: boolean;
  sortOrder?: number;
  active?: boolean;
}

export type TenureBucket =
  | "same_day"
  | "days_1_7"
  | "days_8_30"
  | "days_31_90"
  | "over_90"
  | "unknown";

export interface AdminExitBreakdown {
  rangeDays: number;
  totals: {
    exits: number;
    deactivated: number;
    deleted: number;
    withTypedText: number;
    hadActiveSubscription: number;
    verified: number;
    noConnections: number;
  };
  byReason: {
    reasonLabel: string;
    total: number;
    deactivate: number;
    delete: number;
  }[];
  byTenure: { bucket: TenureBucket; total: number }[];
  series: { date: string; value: number }[];
}

export interface AdminExitFeedback {
  id: string;
  userId: string | null;
  userName: string | null;
  action: ExitAction;
  reasonLabel: string;
  otherText: string | null;
  accountAgeDays: number | null;
  hadActiveSubscription: boolean | null;
  connectionCount: number | null;
  isVerified: boolean | null;
  createdAt: string;
}

export interface AdminExitFeedbackListResponse {
  feedback: AdminExitFeedback[];
  nextCursor: string | null;
}
