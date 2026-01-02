export const otpTemplate = (code: string) => `
  <div style="font-family: Arial; padding: 20px;">
    <h2>Verification Code</h2>
    <p>Your verification code is:</p>
    <h1 style="letter-spacing: 4px;">${code}</h1>
    <p>This code expires in 10 minutes.</p>
  </div>
`;
