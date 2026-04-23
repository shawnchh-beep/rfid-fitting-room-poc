function getRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getAppBaseUrl() {
  return String(process.env.APP_BASE_URL || '').trim() || 'http://localhost:3000';
}

export async function sendInviteEmail({ to, fullName, role, actionLink, locale = 'zh-Hant' }) {
  const apiKey = getRequiredEnv('RESEND_API_KEY');
  const from = getRequiredEnv('RESEND_FROM_EMAIL');

  const safeName = String(fullName || '').trim() || String(to || '').trim();
  const accountRole = String(role || '').trim() || 'user';
  const link = String(actionLink || '').trim() || getAppBaseUrl();
  const lang = String(locale || '').trim();
  const isZh = lang === 'zh-Hant' || lang === 'zh-Hans';

  const subject = isZh
    ? `請完成 ${accountRole} 帳號啟用`
    : `Complete your ${accountRole} account setup`;

  const text = isZh
    ? `您好 ${safeName}，\n\n請點擊以下連結設定密碼並啟用帳號：\n${link}\n\n若您未申請此帳號，請忽略此信件。`
    : `Hi ${safeName},\n\nPlease use the link below to set your password and activate your account:\n${link}\n\nIf you did not request this account, please ignore this email.`;

  const html = isZh
    ? `<p>您好 ${safeName}，</p><p>請點擊以下連結設定密碼並啟用帳號：</p><p><a href="${link}">${link}</a></p><p>若您未申請此帳號，請忽略此信件。</p>`
    : `<p>Hi ${safeName},</p><p>Please use the link below to set your password and activate your account:</p><p><a href="${link}">${link}</a></p><p>If you did not request this account, please ignore this email.</p>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload?.message || payload?.error || 'Resend request failed',
      messageId: null
    };
  }

  return {
    ok: true,
    status: response.status,
    error: null,
    messageId: payload?.id || null
  };
}

