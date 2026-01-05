import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Brand colors and styling
const brandStyles = {
  primaryColor: "#000000",
  accentColor: "#3b82f6",
  bgColor: "#f8fafc",
  cardBg: "#ffffff",
  textColor: "#1e293b",
  mutedColor: "#64748b",
  borderColor: "#e2e8f0",
};

// Email wrapper template
const emailWrapper = (content, previewText = "") => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Comsierge</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: ${brandStyles.bgColor};
      color: ${brandStyles.textColor};
      -webkit-font-smoothing: antialiased;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    
    .email-card {
      background: ${brandStyles.cardBg};
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    
    .email-header {
      background: linear-gradient(135deg, ${brandStyles.primaryColor} 0%, #1e293b 100%);
      padding: 32px;
      text-align: center;
    }
    
    .logo {
      font-size: 28px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    
    .logo-icon {
      display: inline-block;
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      border-radius: 10px;
      margin-right: 12px;
      vertical-align: middle;
    }
    
    .email-body {
      padding: 40px 32px;
    }
    
    .greeting {
      font-size: 24px;
      font-weight: 600;
      color: ${brandStyles.textColor};
      margin: 0 0 16px 0;
    }
    
    .message {
      font-size: 16px;
      line-height: 1.6;
      color: ${brandStyles.mutedColor};
      margin: 0 0 32px 0;
    }
    
    .otp-container {
      background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    }
    
    .otp-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: ${brandStyles.mutedColor};
      margin: 0 0 12px 0;
    }
    
    .otp-code {
      font-size: 36px;
      font-weight: 700;
      letter-spacing: 8px;
      color: ${brandStyles.primaryColor};
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
    }
    
    .otp-expiry {
      font-size: 13px;
      color: ${brandStyles.mutedColor};
      margin: 16px 0 0 0;
    }
    
    .button {
      display: inline-block;
      background: linear-gradient(135deg, ${brandStyles.primaryColor} 0%, #1e293b 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 16px;
      text-align: center;
      transition: transform 0.2s;
    }
    
    .button:hover {
      transform: translateY(-2px);
    }
    
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    
    .divider {
      height: 1px;
      background: ${brandStyles.borderColor};
      margin: 32px 0;
    }
    
    .info-box {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      border-radius: 0 8px 8px 0;
      margin: 24px 0;
    }
    
    .info-box p {
      margin: 0;
      font-size: 14px;
      color: #92400e;
    }
    
    .email-footer {
      padding: 24px 32px;
      background: #f8fafc;
      border-top: 1px solid ${brandStyles.borderColor};
      text-align: center;
    }
    
    .footer-text {
      font-size: 13px;
      color: ${brandStyles.mutedColor};
      margin: 0 0 8px 0;
    }
    
    .footer-links {
      margin: 16px 0 0 0;
    }
    
    .footer-links a {
      color: ${brandStyles.mutedColor};
      text-decoration: none;
      font-size: 13px;
      margin: 0 12px;
    }
    
    .footer-links a:hover {
      color: ${brandStyles.textColor};
    }
    
    .security-note {
      font-size: 12px;
      color: #94a3b8;
      margin: 24px 0 0 0;
      padding: 16px;
      background: #f1f5f9;
      border-radius: 8px;
    }
    
    @media only screen and (max-width: 600px) {
      .email-container {
        padding: 20px 12px;
      }
      
      .email-body {
        padding: 24px 20px;
      }
      
      .greeting {
        font-size: 20px;
      }
      
      .otp-code {
        font-size: 28px;
        letter-spacing: 4px;
      }
    }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>
  <div class="email-container">
    <div class="email-card">
      <div class="email-header">
        <div class="logo">
          <span class="logo-icon"></span>
          Comsierge
        </div>
      </div>
      ${content}
      <div class="email-footer">
        <p class="footer-text">© ${new Date().getFullYear()} Comsierge. All rights reserved.</p>
        <p class="footer-text">Your AI-powered communication assistant</p>
        <div class="footer-links">
          <a href="https://comsierge-ai.onrender.com">Website</a>
          <a href="https://comsierge-ai.onrender.com/privacy">Privacy</a>
          <a href="https://comsierge-ai.onrender.com/terms">Terms</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

// Generate 6-digit OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification OTP email
export const sendVerificationEmail = async (email, name, otp) => {
  const content = `
    <div class="email-body">
      <h1 class="greeting">Welcome to Comsierge, ${name}! 👋</h1>
      <p class="message">
        Thanks for signing up! To complete your registration and secure your account, 
        please verify your email address using the code below.
      </p>
      
      <div class="otp-container">
        <p class="otp-label">Your Verification Code</p>
        <div class="otp-code">${otp}</div>
        <p class="otp-expiry">⏱️ This code expires in 10 minutes</p>
      </div>
      
      <div class="info-box">
        <p><strong>Security tip:</strong> Never share this code with anyone. Comsierge will never ask for your verification code via phone or chat.</p>
      </div>
      
      <div class="divider"></div>
      
      <p class="message" style="margin-bottom: 0;">
        If you didn't create an account with Comsierge, you can safely ignore this email.
      </p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: "Comsierge <onboarding@resend.dev>",
      to: email,
      subject: `${otp} is your Comsierge verification code`,
      html: emailWrapper(content, `Your verification code is ${otp}. Valid for 10 minutes.`),
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error(error.message);
    }

    console.log("Verification email sent:", data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Email send error:", error);
    throw error;
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (email, name, resetUrl) => {
  const content = `
    <div class="email-body">
      <h1 class="greeting">Reset Your Password</h1>
      <p class="message">
        Hi ${name}, we received a request to reset your Comsierge password. 
        Click the button below to create a new password.
      </p>
      
      <div class="button-container">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </div>
      
      <p class="message" style="font-size: 14px;">
        Or copy and paste this link into your browser:<br>
        <a href="${resetUrl}" style="color: ${brandStyles.accentColor}; word-break: break-all;">${resetUrl}</a>
      </p>
      
      <div class="info-box">
        <p><strong>⏱️ This link expires in 1 hour.</strong> If you didn't request a password reset, please ignore this email or contact support if you're concerned.</p>
      </div>
      
      <div class="divider"></div>
      
      <div class="security-note">
        <strong>🔒 Security Notice:</strong> We will never ask for your password via email or phone. 
        Always reset your password through the official Comsierge website.
      </div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: "Comsierge <onboarding@resend.dev>",
      to: email,
      subject: "Reset your Comsierge password",
      html: emailWrapper(content, `Reset your Comsierge password. Link expires in 1 hour.`),
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error(error.message);
    }

    console.log("Password reset email sent:", data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Email send error:", error);
    throw error;
  }
};

// Send welcome email after verification
export const sendWelcomeEmail = async (email, name) => {
  const content = `
    <div class="email-body">
      <h1 class="greeting">You're All Set! 🎉</h1>
      <p class="message">
        Welcome to Comsierge, ${name}! Your email has been verified and your account is now active.
      </p>
      
      <p class="message">
        Here's what you can do with Comsierge:
      </p>
      
      <ul style="color: ${brandStyles.mutedColor}; line-height: 2; padding-left: 20px;">
        <li><strong>Get a dedicated phone number</strong> for your business</li>
        <li><strong>AI-powered call handling</strong> with smart routing</li>
        <li><strong>Unified inbox</strong> for all your communications</li>
        <li><strong>Real-time translations</strong> in 100+ languages</li>
      </ul>
      
      <div class="button-container">
        <a href="https://comsierge-ai.onrender.com/dashboard" class="button">Go to Dashboard</a>
      </div>
      
      <div class="divider"></div>
      
      <p class="message" style="margin-bottom: 0; font-size: 14px;">
        Need help getting started? Reply to this email or visit our help center.
      </p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: "Comsierge <onboarding@resend.dev>",
      to: email,
      subject: "Welcome to Comsierge! 🎉",
      html: emailWrapper(content, `Welcome to Comsierge! Your account is now active.`),
    });

    if (error) {
      console.error("Resend error:", error);
      // Don't throw - welcome email is not critical
      return { success: false };
    }

    console.log("Welcome email sent:", data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Welcome email error:", error);
    return { success: false };
  }
};

// Send account linked notification (Google OAuth)
export const sendAccountLinkedEmail = async (email, name) => {
  const content = `
    <div class="email-body">
      <h1 class="greeting">Google Account Linked 🔗</h1>
      <p class="message">
        Hi ${name}, your Google account has been successfully linked to your Comsierge account.
      </p>
      
      <p class="message">
        You can now sign in to Comsierge using either:
      </p>
      
      <ul style="color: ${brandStyles.mutedColor}; line-height: 2; padding-left: 20px;">
        <li>Your email and password</li>
        <li>Your Google account (faster!)</li>
      </ul>
      
      <div class="info-box">
        <p><strong>Didn't do this?</strong> If you didn't link a Google account, please secure your account immediately by changing your password.</p>
      </div>
      
      <div class="button-container">
        <a href="https://comsierge-ai.onrender.com/dashboard" class="button">Go to Dashboard</a>
      </div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: "Comsierge <onboarding@resend.dev>",
      to: email,
      subject: "Google account linked to Comsierge",
      html: emailWrapper(content, `Your Google account has been linked to Comsierge.`),
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Account linked email error:", error);
    return { success: false };
  }
};

export default {
  generateOTP,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendAccountLinkedEmail,
};
