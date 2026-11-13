const https = require('node:https');

/**
 * Send an email using Resend's REST API.
 * Uses native node:https so zero external npm dependencies are needed.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Keep local and test environments completely silent and functional without a key
    return { success: false, skipped: true, reason: 'RESEND_API_KEY is not configured' };
  }

  const payload = JSON.stringify({
    from: process.env.RESEND_FROM_EMAIL || 'Otion <onboarding@resend.dev>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ''),
  });

  return new Promise((resolve) => {
    const req = https.request(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, id: data.id });
            } else {
              console.error('Resend API error:', data);
              resolve({ success: false, error: data });
            }
          } catch (err) {
            resolve({ success: false, error: err.message });
          }
        });
      },
    );

    req.on('error', (err) => {
      console.error('Failed to contact Resend API:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
};

const baseTemplate = ({ title, bodyHtml, buttonText, buttonUrl, footerNote }) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafafa; color: #171717; margin: 0; padding: 40px 20px; }
        .card { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 16px; padding: 36px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .logo { font-size: 20px; font-weight: 700; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; color: #000000; text-decoration: none; }
        h1 { font-size: 22px; font-weight: 700; margin: 0 0 14px 0; color: #0a0a0a; letter-spacing: -0.02em; }
        p { font-size: 15px; line-height: 1.6; color: #525252; margin: 0 0 20px 0; }
        .btn-wrapper { margin: 28px 0; }
        .btn { display: inline-block; background-color: #000000; color: #ffffff !important; padding: 12px 26px; border-radius: 10px; font-weight: 600; font-size: 14px; text-decoration: none; }
        .badge { display: inline-block; padding: 3px 9px; font-size: 12px; font-weight: 600; border-radius: 9999px; background-color: #f3f4f6; color: #1f2937; text-transform: uppercase; letter-spacing: 0.04em; }
        .subtext { font-size: 13px; color: #737373; line-height: 1.5; margin-top: 20px; }
        .footer { font-size: 12px; color: #a3a3a3; border-top: 1px solid #f5f5f5; padding-top: 20px; margin-top: 28px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">◇ Otion</div>
        <h1>${title}</h1>
        ${bodyHtml}
        ${buttonUrl ? `<div class="btn-wrapper"><a href="${buttonUrl}" class="btn">${buttonText}</a></div>` : ''}
        ${footerNote ? `<p class="subtext">${footerNote}</p>` : ''}
        <div class="footer">
          Otion — Collaborative notes workspace
        </div>
      </div>
    </body>
  </html>
`;

/**
 * Send email verification link upon registration.
 */
const sendVerificationEmail = async ({ to, userName, verifyUrl }) => {
  const subject = 'Verify your email address for Otion';
  const bodyHtml = `
    <p>Hi ${userName || 'there'},</p>
    <p>Welcome to Otion! Please verify your email address to activate your account and start collaborating on your notes.</p>
  `;
  const footerNote = 'This verification link will expire in 24 hours. If you did not create an account on Otion, you can safely ignore this email.';
  const html = baseTemplate({
    title: 'Verify your email',
    bodyHtml,
    buttonText: 'Verify Email Address',
    buttonUrl: verifyUrl,
    footerNote,
  });
  return sendEmail({ to, subject, html });
};

/**
 * Send password reset email.
 */
const sendPasswordResetEmail = async ({ to, userName, resetUrl }) => {
  const subject = 'Reset your Otion password';
  const bodyHtml = `
    <p>Hi ${userName || 'there'},</p>
    <p>We received a request to reset the password for your Otion account. Click the button below to choose a new password.</p>
  `;
  const footerNote = 'This link will expire in 1 hour. If you did not request a password reset, no action is needed and your account remains safe.';
  const html = baseTemplate({
    title: 'Reset your password',
    bodyHtml,
    buttonText: 'Reset Password',
    buttonUrl: resetUrl,
    footerNote,
  });
  return sendEmail({ to, subject, html });
};

/**
 * Send notification email when someone is added as a viewer/editor/commenter.
 */
const sendCollaboratorEmail = async ({ to, inviterName, noteTitle, noteUrl, role, isUpdate = false }) => {
  const roleDescriptions = {
    editor: 'can edit and collaborate in real-time',
    commenter: 'can view and leave comments',
    viewer: 'can view the note in read-only mode',
  };
  const roleDescription = roleDescriptions[role] || 'can view the note';

  const actionText = isUpdate ? 'updated your access to' : 'added you as';
  const subject = `${inviterName} ${actionText} a ${role} on "${noteTitle || 'Untitled note'}" in Otion`;
  const bodyHtml = `
    <p><strong>${inviterName}</strong> ${actionText} a <span class="badge">${role}</span> on <strong>${noteTitle || 'Untitled note'}</strong>.</p>
    <p>As a ${role}, you ${roleDescription}.</p>
  `;
  const footerNote = 'You can access this note anytime from your Otion dashboard.';
  const html = baseTemplate({
    title: isUpdate ? 'Access updated' : 'You were added to a note',
    bodyHtml,
    buttonText: 'Open Note in Otion',
    buttonUrl: noteUrl,
    footerNote,
  });
  return sendEmail({ to, subject, html });
};

/**
 * Send pending invitation email to an unregistered email address.
 */
const sendInvitationEmail = async ({ to, inviterName, noteTitle, inviteUrl, role }) => {
  const subject = `${inviterName} invited you to collaborate on "${noteTitle || 'Untitled note'}" in Otion`;
  const bodyHtml = `
    <p><strong>${inviterName}</strong> invited you to collaborate on <strong>${noteTitle || 'Untitled note'}</strong> as a <span class="badge">${role}</span>.</p>
    <p>Accept this invitation to join Otion and collaborate seamlessly with your team.</p>
  `;
  const footerNote = 'This invitation is valid for 7 days. Once you sign up with this email, the shared note will automatically be available in your workspace.';
  const html = baseTemplate({
    title: 'You are invited to collaborate',
    bodyHtml,
    buttonText: 'Accept Invitation & Sign Up',
    buttonUrl: inviteUrl,
    footerNote,
  });
  return sendEmail({ to, subject, html });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendCollaboratorEmail,
  sendInvitationEmail,
};
