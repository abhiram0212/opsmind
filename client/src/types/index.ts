export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'DETECTED' | 'INVESTIGATING' | 'MITIGATING' | 'RESOLVED' | 'FAILED';
export interface Incident {
  id: string; incidentNumber: string; title: string; description: string; severity: Severity;
  status: IncidentStatus; service: string; environment: string; symptoms: string[]; detectedAt: string;
  resolvedAt: string | null; rootCause: string | null; resolution: string | null; recoveryTime: number | null;
  aiAssisted: boolean; confidence: number; createdAt: string; updatedAt: string;
}
export interface Memory {
  id: string; incidentId: string | null; type: string; title: string; content: string; rootCause: string;
  successfulActions: string[]; failedActions: string[]; lessonsLearned: string[]; services: string[];
  tags: string[]; confidence: number; createdAt: string;
}
export interface Service {
  id: string; name: string; status: string; latency: number; errorRate: number; cpu: number;
  memory: number; uptime: number; lastIncident: string | null;
}
export interface RunbookStep { id: string; title: string; description: string; risk: string; requiresApproval: boolean; status: string }
export interface Runbook {
  id: string; name: string; description: string; service: string; severity: string; steps: RunbookStep[];
  riskLevel: string; successRate: number; usageCount: number; averageRecoveryTime: number;
}
export interface Event { id: string; timestamp: string; eventType: string; message: string; source: string; severity: string }
export interface Action {
  id: string; action: string; reason: string; status: string; requiresApproval: boolean;
  approvedBy: string | null; executedAt: string | null; result: string | null;
}
export interface Investigation {
  evidence: { errorRate: number; latency: number; cpu: number; memory: number; databaseConnections: { used: number; limit: number }; recentDeployment: string; affectedServices: string[]; recentLogs: string[] };
  matches: Array<{ memory: Memory; similarity: number; reason: string }>;
  likelyCause: string; reasoning: string; recommendation: string;
  plan: Array<{ id: string; title: string; status: string; evidence: string }>;
  runbook: Runbook | null; action: { description: string; reason: string; successRate: number };
  activity: Array<{ status: string; message: string }>;
}
export interface DashboardData {
  metrics: { activeIncidents: number; resolvedToday: number; averageMttr: number; memoryCount: number; aiAssisted: number; runbookSuccessRate: number };
  incidents: Incident[]; memories: Memory[]; services: Service[]; provider: string;
}