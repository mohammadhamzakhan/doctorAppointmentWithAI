import { OpenAiService } from 'src/ai/service/openai.service';
import { DoctorService } from 'src/doctor/doctor.service';

// response to doctor information or any other info about doctor and clinic
export async function respondToDoctorInfo(
  doctorId: number,
  userMessage: string,
  doctorService: DoctorService,
  openAiService: OpenAiService,
): Promise<string> {
  // Get doctor from database
  const doctor = await doctorService.getMyProfile(doctorId);
  if (!doctor) {
    return '⚠️ Sorry, doctor information is not available right now.';
  }

  // Format working hours nicely
  const workingHours = doctor.doctorAvailabilities
    .map((a) => `${a.day}: ${a.startTime} - ${a.endTime}`)
    .join('\n');

  // Build enhanced AI context
  const doctorContext = `
Doctor Name: Dr. ${doctor.name}
Clinic Name: ${doctor.clinicName}
Specialization: ${doctor.specialization}
Working Hours:
${workingHours}
Timezone: ${doctor.timezone}

TASK:
You are a friendly and professional virtual medical assistant. 
Answer the user's questions about the doctor or clinic in a helpful, engaging, and interesting way.

RULES:
- Greet the patient politely first.
- Give clear info about the doctor, clinic timings, and services.
- Suggest best available slots if patient asks about availability.
- Use a friendly WhatsApp-style tone.
- Include emojis where appropriate.
- If unsure, give helpful alternatives instead of saying "I don't know".
- Never provide medical advice; focus on doctor, clinic, and appointment info only.

EXAMPLES:
Patient: "Doctor ka timing kya hai?"  
AI: "Hello! 😊 Dr. ${doctor.name} is available from 9:00 AM to 5:00 PM, Monday to Friday. You can book your appointment anytime! 🗓️"

Patient: "Clinic kahan hai?"  
AI: "Sure! 🏥 The clinic is located at ${doctor.clinicName}. It's easy to reach and well-equipped for all consultations."

Patient: "Specialization kya hai?"  
AI: "Dr. ${doctor.name} specializes in ${doctor.specialization}. 💼 We ensure top-quality care for all patients."

User Question: ${userMessage}
`;

  // Call AI service
  const response = await openAiService.chat([
    { role: 'system', content: doctorContext },
    { role: 'user', content: userMessage },
  ]);

  return response.choices?.[0]?.message?.content?.trim() || '';
}
