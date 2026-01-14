export interface AiArgs {
  doctorId?: number;
  date?: string;
  time?: string;
  reason?: string;
  patientName?: string;
  appointmentId?: number;
  suggestedSlots?: string[];
  step?: 'date' | 'time' | 'name' | 'confirmed' | 'awaiting_confirmation';
  [key: string]: any;
}
