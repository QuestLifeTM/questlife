import { Webhook } from "npm:standardwebhooks@1.0.0";

type AuthEmailEvent = {
  user: { email: string };
  email_data: {
    email_action_type: string;
    redirect_to?: string;
    token_hash?: string;
  };
};

type EmailContent = {
  body: string;
  buttonLabel?: string;
  preview: string;
  title: string;
};

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[character] ?? character);
}

function contentFor(action: string): EmailContent {
  switch (action) {
    case "signup":
      return {
        preview: "Confirm your QuestLife email address.",
        title: "Confirm your email",
        body: "You are one step away from starting your next adventure. Confirm your email address to finish setting up QuestLife.",
        buttonLabel: "Confirm email",
      };
    case "recovery":
      return {
        preview: "Reset your QuestLife password.",
        title: "Reset your password",
        body: "We received a request to reset your QuestLife password. Use the button below to choose a new one.",
        buttonLabel: "Reset password",
      };
    case "invite":
      return {
        preview: "You have been invited to QuestLife.",
        title: "You are invited",
        body: "Your QuestLife invitation is ready. Use the button below to create your account.",
        buttonLabel: "Accept invitation",
      };
    case "magiclink":
      return {
        preview: "Your QuestLife sign-in link.",
        title: "Sign in to QuestLife",
        body: "Use this secure link to sign in to QuestLife.",
        buttonLabel: "Sign in",
      };
    default:
      return {
        preview: "A QuestLife account update.",
        title: "Your QuestLife account",
        body: "This email confirms an update to your QuestLife account.",
      };
  }
}

function verificationUrl(event: AuthEmailEvent) {
  const { email_action_type: action, redirect_to: redirectTo, token_hash: tokenHash } = event.email_data;
  if (!tokenHash || !redirectTo) return null;

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  // Older app builds used the www host, but production Auth is configured for
  // the apex domain. Preserve the requested path while ensuring the redirect
  // matches the exact allow-listed URL.
  const normalizedRedirectTo = redirectTo.replace(
    "https://www.myquestlife.app/",
    "https://myquestlife.app/",
  );
  return `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(action)}&redirect_to=${encodeURIComponent(normalizedRedirectTo)}`;
}

function renderEmail(content: EmailContent, actionUrl: string | null) {
  const button = actionUrl && content.buttonLabel
    ? `<tr><td style="padding:24px 34px 18px"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:15px 22px;border-radius:14px;background:#4da8ff;box-shadow:0 4px 0 #258fd8;color:#ffffff;font-size:15px;font-weight:700;line-height:20px;text-decoration:none">${escapeHtml(content.buttonLabel)}</a></td></tr>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;background:#f7f7f4;color:#171214;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <span style="display:none!important;max-height:0;overflow:hidden;opacity:0">${escapeHtml(content.preview)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:36px 16px"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden">
        <tr><td style="padding:34px 34px 12px">
          <div style="color:#4da8ff;font-size:13px;font-weight:800;letter-spacing:.7px;text-transform:uppercase">QuestLife</div>
          <h1 style="margin:18px 0 14px;color:#171214;font-size:28px;line-height:34px">${escapeHtml(content.title)}</h1>
          <p style="margin:0;color:#50474b;font-size:16px;line-height:24px">${escapeHtml(content.body)}</p>
        </td></tr>
        ${button}
        <tr><td style="padding:8px 34px 34px"><p style="margin:0;color:#82767a;font-size:12px;line-height:18px">If you did not request this, you can safely ignore this email.</p></td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const hookSecret = requiredEnv("SEND_EMAIL_HOOK_SECRET").replace(/^v1,whsec_/, "");
    const payload = await request.text();
    const event = new Webhook(hookSecret).verify(
      payload,
      Object.fromEntries(request.headers),
    ) as AuthEmailEvent;
    const content = contentFor(event.email_data.email_action_type);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: requiredEnv("EMAIL_FROM"),
        to: [event.user.email],
        subject: `QuestLife — ${content.title}`,
        html: renderEmail(content, verificationUrl(event)),
      }),
    });

    if (!response.ok) throw new Error(`Resend rejected the email (${response.status})`);
    return Response.json({});
  } catch (error) {
    console.error("Auth email delivery failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Unable to send auth email" }, { status: 401 });
  }
});
