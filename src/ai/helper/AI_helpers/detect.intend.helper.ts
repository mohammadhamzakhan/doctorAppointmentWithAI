//This fn will does the intend detection to send a reply
//if the user want to book or cancel or ask question is doctor availble today
export function detectIntend(
  message: string,
): 'greeting' | 'info' | 'appointment' | 'reschedule' | 'cancel' | 'unknown' {
  const text = message.toLowerCase().trim();

  //  Greeting
  if (
    /^(hi|hello|hey|salam|salaam|assalam|aoa|good morning|good evening)/i.test(
      text,
    )
  ) {
    return 'greeting';
  }

  //  Doctor / clinic info
  if (
    /(doctor|clinic|hospital)/i.test(text) &&
    /(time|timing|today|available|availability|open|close|hours|aj|aaj|kab)/i.test(
      text,
    )
  ) {
    return 'info';
  }

  //  Appointment booking
  if (
    /(appointment|book|booking|schedule|milna|mil sakta|aj|kal|time chahiye)/i.test(
      text,
    )
  ) {
    return 'appointment';
  }

  // Reschedule
  if (/(reschedule|change|shift|time change|date change|adjust)/i.test(text)) {
    return 'reschedule';
  }

  // Cancel
  if (/(cancel|remove|delete|cancel karni)/i.test(text)) {
    return 'cancel';
  }

  return 'unknown';
}
