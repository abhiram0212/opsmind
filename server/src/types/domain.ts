export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'DETECTED' | 'INVESTIGATING' | 'MITIGATING' | 'RESOLVED' | 'FAILED';
export type ServiceStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'MAINTENANCE';
export type MemoryType = 'INCIDENT' | 'ROOT_CAUSE' | 'RESOLUTION' | 'RUNBOOK' | 'LESSON';

export interface Incident {
  id: string; incidentNumber: string; title: string; description: string; severity: Severity;
  status: IncidentStatus; service: string; environment: string; symptoms: string[];
  detectedAt: string; resolvedAt: string | null; rootCause: string | null; resolution: string | null;
  recoveryTime: number | null; aiAssisted: boolean; confidence: number; createdAt: string;
  updatedAt: string;
}

export interface Memory {
  id: string; incidentId: string | null; type: MemoryType; title: string; content: string;
  rootCause: string; successfulActions: string[]; failedActions: string[]; lessonsLearned: string[];
  services: string[]; tags: string[]; confidence: number; createdAt: string;
}

export interface Service {
  id: string; name: string; status: ServiceStatus; latency: number; errorRate: number;
  cpu: number; memory: number; uptime: number; lastIncident: string | null;
}

export interface RunbookStep {
  id: string; title: string; description: string; risk: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresApproval: boolean; status: 'PENDING' | 'COMPLETE';
}

export interface Runbook {
  id: string; name: string; description: string; service: string; severity: Severity;
  steps: RunbookStep[]; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; successRate: number;
  usageCount: number; averageRecoveryTime: number; createdAt: string; updatedAt: string;
}

export interface AgentAction {
  id: string; incidentId: string; action: string; reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTING' | 'SUCCESS' | 'FAILED';
  requiresApproval: boolean; approvedBy: string | null; executedAt: string | null; result: string | null;
}

export interface ApiSuccess<T> { success: true; data: T }
export interface ApiFailure { success: false; error: { code: string; message: string } }