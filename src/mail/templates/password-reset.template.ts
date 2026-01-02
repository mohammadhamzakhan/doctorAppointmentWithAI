export const passwordResetTemplate = (link: string) => `
  <div style="font-family: Arial; padding: 20px;">
    <h2>Password Reset</h2>
    <p>Click the button below to reset your password:</p>
    <a href="${link}" 
       style="padding: 10px 15px; background: #2563eb; color: white; text-decoration: none;">
      Reset Password
    </a>
  </div>
`;
