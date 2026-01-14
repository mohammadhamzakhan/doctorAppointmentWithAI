//this fn will responsible for to find the doctor availablity

import { UNAVAILABILITY_PROMPT } from 'src/ai/prompts/doctor-unavailable.prompt';
import { OpenAiService } from 'src/ai/service/openai.service';
import { DoctorService } from 'src/doctor/doctor.service';

//if not available the response will be clear and friendly
export async function respondToUnavailablity(
  doctorId: number,
  userMessage: string,
  doctorService: DoctorService,
  openAiService: OpenAiService,
): Promise<string> {
  const doctor = await doctorService.getMyProfile(doctorId);
  if (!doctor) {
    return "Sorry, I cannot access this doctor's schedule right now.";
  }
  const today = new Date().getDay(); // 0 = Sunday, 1 = Monday ...
  const todaysAvailability = doctor.doctorAvailabilities.find(
    (a) => a.day === today,
  );
  const prompt = UNAVAILABILITY_PROMPT(doctor.name, todaysAvailability).replace(
    '{userMessage}',
    userMessage,
  );

  const response = await openAiService.chat([
    { role: 'system', content: prompt },
    { role: 'user', content: userMessage },
  ]);
  return response.choices?.[0].message?.content?.trim() || '';
}
