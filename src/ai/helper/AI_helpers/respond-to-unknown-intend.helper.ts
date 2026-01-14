import { OpenAiService } from 'src/ai/service/openai.service';
import { DoctorService } from 'src/doctor/doctor.service';

export async function respondToUnknownIntend(
  doctorId: number,
  userMessage: string,
  doctorService: DoctorService,
  openAiService: OpenAiService,
): Promise<string> {
  // Try to detect if the question is related to the doctor or clinic
  const doctorRelatedRegex =
    /(doctor|clinic|hospital|specialization|timing|working hours|ka naam|kaun|konsa)/i;

  if (doctorRelatedRegex.test(userMessage)) {
    // If it seems related to doctor info, use AI to respond
    const doctor = await doctorService.getMyProfile(doctorId);
    if (!doctor) {
      return 'Sorry, doctor information is not available right now.';
    }

    const doctorContext = `
    Doctor name: Dr. ${doctor.name}
    Clinic name: ${doctor.clinicName}
    Specialization: ${doctor.specialization}
    Working hours: ${doctor.doctorAvailabilities}
    Timezone: ${doctor.timezone}
    `;

    const response = await openAiService.chatSingle({
      system: `
You are a friendly medical assistant. Answer the user's question about the doctor or clinic politely and concisely.
`,
      user: doctorContext + '\nUser question: ' + userMessage,
    });

    return response;
  }

  // Default fallback message if the question is not doctor-related
  return `
⚠️ Sorry! I can only help with the following:

👉 *Book an appointment*  
👉 *Check doctor info*  
👉 *Reschedule an appointment*  
👉 *Cancel an appointment*

💡 Please type *Hi* to return to the main menu.
`.trim();
}
