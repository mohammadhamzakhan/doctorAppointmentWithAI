export const verifyEmailTemplate = (code: string) => `
  <div style="font-family: Arial; padding: 20px;">
    <h2>Verify Your Email</h2>
    <p>Enter the code below to verify your email address:</p>
    <h1>${code}</h1>
  </div>
`;
