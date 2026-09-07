export interface FindingsAccountRow {
  customerName: string;
  escalatedCases: number;
  breachedCases: number;
}

export interface FindingsData {
  periodDays: number;
  totalEscalated: number;
  exceededTarget: number;
  avgEngineeringMinutes: number | null;
  topAccounts: FindingsAccountRow[];
}
