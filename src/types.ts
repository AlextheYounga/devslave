export interface JobData {
  id: number;
  type: string;
  payload: any; // JsonValue from Prisma
  status: string;
  priority: number;
  retries: number;
  createdAt: Date;
  updatedAt: Date;
}
