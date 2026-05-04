const LANG_KEY = 'rfid_poc_lang_v1';
const SESSION_KEY = 'rfid_poc_login_session_v1';
const DEMO_TOKEN = 'demo-readonly';
const URL_KEY = 'supabaseUrl';
const ANON_KEY = 'supabaseAnonKey';

const DEFAULT_SUPABASE_URL = 'https://trgxtbqjkhydvbfndmhk.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_RjeQR-HU84MRCpByTqZlxg_lwJHStMP';

const SUPPORTED_LANGS = ['en', 'zh-Hant', 'zh-Hans', 'ja'];

const I18N = {
  en: {
    'common.language': 'Language',
    'login.title': 'Sign in',
    'login.subtitle': 'Use real-time RFID data to drive fitting-room, conversion, and replenishment decisions.',
    'login.hero.eyebrow': 'Retail Intelligence Platform',
    'login.hero.point.1': 'Track fitting-room activity and high-interest items in real time',
    'login.hero.point.2': 'Identify conversion bottlenecks and opportunity products quickly',
    'login.hero.point.3': 'Support store actions with an execution-ready list',
    'login.form.title': 'Sign in with your account',
    'login.email': 'Email',
    'login.placeholder.email': 'name@company.com',
    'login.password': 'Password',
    'login.placeholder.password': 'Enter your password',
    'login.submit': 'Sign in',
    'login.forgot': 'Forgot password',
    'login.trialCta': 'Apply for a 14-day trial account',
    'login.trialHint': 'No official account yet? Activate a trial workspace and receive an email invite.',
    'login.demoCta': 'Enter Demo Dashboard',
    'login.demoHint': 'Demo mode is read-only. You can view dashboard metrics but cannot modify data or system settings.',
    'login.success': 'Signed in successfully. Redirecting…',
    'login.error.missing_token': 'Missing recovery token. Please request a new link.',
    'login.error.invalid_recovery_link': 'Invalid or expired recovery link.',
    'login.error.auth_callback_failed': 'Authentication callback failed. Please try again.',
    'forgot.title': 'Forgot password',
    'forgot.submit': 'Send reset link',
    'forgot.success': 'Reset email sent. Please check your inbox.',
    'forgot.error.default': 'Failed to send reset email',
    'reset.title': 'Set new password',
    'reset.password': 'New password',
    'reset.confirmPassword': 'Confirm new password',
    'reset.submit': 'Update password',
    'reset.error.minLength': 'Password must be at least 8 characters',
    'reset.error.mismatch': 'Passwords do not match',
    'reset.success': 'Password updated. Redirecting to sign-in…',
    'callback.title': 'Verifying',
    'callback.wait': 'Please wait…',
    'callback.error.missingInfo': 'Missing verification information',
    'callback.error.invalidLink': 'Invalid or expired link',
    'trial.meta.title': 'Apply for Trial Account',
    'trial.hero.eyebrow': 'RFID Fitting Room Platform',
    'trial.title': 'Apply for a 14-day trial account',
    'trial.subtitle': 'Use real-time RFID insights to see fitting behavior, conversion opportunities, and replenishment risk in one place.',
    'trial.hero.point.1': 'Track fitting-room activity and high-interest item flow in real time',
    'trial.hero.point.2': 'Focus on opportunity products and abnormal stays to improve in-store actions',
    'trial.hero.point.3': 'Support management decisions with execution-ready action lists',
    'trial.note.title': 'Trial notes',
    'trial.note.body': 'After submission, your request will be reviewed and an activation email will be sent to your inbox.',
    'trial.form.title': 'Fill in details to request trial access',
    'trial.field.fullName': 'Full name',
    'trial.field.company': 'Company',
    'trial.field.jobTitle': 'Job title',
    'trial.field.email': 'Email',
    'trial.placeholder.fullName': 'Enter your full name',
    'trial.placeholder.company': 'Enter company name',
    'trial.placeholder.jobTitle': 'Enter your job title',
    'trial.placeholder.email': 'name@company.com',
    'trial.submit': 'Submit trial request',
    'trial.disclaimer': 'Your information is used only for trial review and activation notice.',
    'trial.backToLogin': 'Back to sign in',
    'trial.error.required': 'Please complete full name, company, job title, and email.',
    'trial.submit.loading': 'Submitting…',
    'trial.error.validation': 'Please check your input fields and try again.',
    'trial.error.duplicate': 'A pending trial request already exists for this email.',
    'trial.error.registered': 'This email is already registered.',
    'trial.error.rateLimited': 'Too many requests. Please try again later.',
    'trial.error.submitFailed': 'Failed to submit trial request. Please try again later.',
    'trial.success': 'Your request has been received. Please check your email for activation instructions.'
  },
  'zh-Hant': {
    'common.language': '語言',
    'login.title': '登入',
    'login.subtitle': '用即時 RFID 資料掌握試穿、轉單與補貨決策。',
    'login.hero.eyebrow': 'Retail Intelligence Platform',
    'login.hero.point.1': '即時掌握試衣間動態與熱門商品流向',
    'login.hero.point.2': '快速洞察高機會商品與轉換瓶頸',
    'login.hero.point.3': '以可執行的清單支援店務決策',
    'login.form.title': '使用你的帳號登入',
    'login.email': 'Email',
    'login.placeholder.email': 'name@company.com',
    'login.password': '密碼',
    'login.placeholder.password': '請輸入密碼',
    'login.submit': '登入',
    'login.forgot': '忘記密碼',
    'login.trialCta': '申請 14 天試用帳號',
    'login.trialHint': '尚未有正式帳號？先開通試用環境，由系統寄送啟用信。',
    'login.demoCta': '進入 Demo 儀表板',
    'login.demoHint': 'Demo 模式為唯讀，只能瀏覽 Dashboard，無法修改資料或系統設定。',
    'login.success': '登入成功，正在跳轉…',
    'login.error.missing_token': '缺少驗證資訊，請重新申請連結。',
    'login.error.invalid_recovery_link': '重設連結無效或已過期。',
    'login.error.auth_callback_failed': '驗證回呼失敗，請重試。',
    'forgot.title': '忘記密碼',
    'forgot.submit': '寄送重設密碼信',
    'forgot.success': '重設密碼信已寄出，請檢查信箱。',
    'forgot.error.default': '寄送失敗',
    'reset.title': '設定新密碼',
    'reset.password': '新密碼',
    'reset.confirmPassword': '確認新密碼',
    'reset.submit': '更新密碼',
    'reset.error.minLength': '密碼至少 8 碼',
    'reset.error.mismatch': '兩次密碼不一致',
    'reset.success': '密碼已更新，將跳轉登入頁',
    'callback.title': '驗證中',
    'callback.wait': '請稍候',
    'callback.error.missingInfo': '缺少驗證資訊',
    'callback.error.invalidLink': '連結無效或已過期',
    'trial.meta.title': '申請試用帳號',
    'trial.hero.eyebrow': 'RFID Fitting Room Platform',
    'trial.title': '申請 14 天試用帳號',
    'trial.subtitle': '透過 RFID 即時資料，快速看見試穿行為、轉單機會與補貨風險。先開通試用環境，體驗完整決策流程。',
    'trial.hero.point.1': '即時掌握試衣間與熱門商品流向，縮短店務反應時間',
    'trial.hero.point.2': '聚焦高機會商品與異常停留，讓現場行動更精準',
    'trial.hero.point.3': '用可執行的清單支援管理決策，提升營運透明度',
    'trial.note.title': '試用說明',
    'trial.note.body': '送出申請後，系統將審核並寄送啟用通知至你的郵箱。',
    'trial.form.title': '填寫資料取得試用資格',
    'trial.field.fullName': '姓名',
    'trial.field.company': '公司',
    'trial.field.jobTitle': '職稱',
    'trial.field.email': '郵箱',
    'trial.placeholder.fullName': '請輸入姓名',
    'trial.placeholder.company': '請輸入公司名稱',
    'trial.placeholder.jobTitle': '請輸入職稱',
    'trial.placeholder.email': 'name@company.com',
    'trial.submit': '送出試用申請',
    'trial.disclaimer': '我們僅用於試用帳號審核與啟用通知，不作為其他行銷用途。',
    'trial.backToLogin': '返回登入',
    'trial.error.required': '請完整填寫姓名、公司、職稱與郵箱。',
    'trial.submit.loading': '送出中…',
    'trial.error.validation': '欄位格式有誤，請檢查後再送出。',
    'trial.error.duplicate': '此郵箱已有待處理的試用申請。',
    'trial.error.registered': '此郵箱已註冊帳號。',
    'trial.error.rateLimited': '申請過於頻繁，請稍後再試。',
    'trial.error.submitFailed': '送出失敗，請稍後再試。',
    'trial.success': '已收到你的申請，請留意信箱中的啟用通知。'
  },
  'zh-Hans': {
    'common.language': '语言',
    'login.title': '登录',
    'login.subtitle': '使用实时 RFID 数据支持试衣、转化与补货决策。',
    'login.hero.eyebrow': 'Retail Intelligence Platform',
    'login.hero.point.1': '实时掌握试衣间动态与热门商品流向',
    'login.hero.point.2': '快速洞察高机会商品与转化瓶颈',
    'login.hero.point.3': '以可执行清单支援门店决策',
    'login.form.title': '使用你的账号登录',
    'login.email': 'Email',
    'login.placeholder.email': 'name@company.com',
    'login.password': '密码',
    'login.placeholder.password': '请输入密码',
    'login.submit': '登录',
    'login.forgot': '忘记密码',
    'login.trialCta': '申请 14 天试用账号',
    'login.trialHint': '还没有正式账号？先开通试用环境，系统将发送激活邮件。',
    'login.demoCta': '进入 Demo 仪表板',
    'login.demoHint': 'Demo 模式为只读，只能浏览 Dashboard，无法修改数据或系统设置。',
    'login.success': '登录成功，正在跳转…',
    'login.error.missing_token': '缺少验证信息，请重新申请链接。',
    'login.error.invalid_recovery_link': '重置链接无效或已过期。',
    'login.error.auth_callback_failed': '验证回调失败，请重试。',
    'forgot.title': '忘记密码',
    'forgot.submit': '发送重置密码邮件',
    'forgot.success': '重置密码邮件已发送，请检查邮箱。',
    'forgot.error.default': '发送失败',
    'reset.title': '设置新密码',
    'reset.password': '新密码',
    'reset.confirmPassword': '确认新密码',
    'reset.submit': '更新密码',
    'reset.error.minLength': '密码至少 8 位',
    'reset.error.mismatch': '两次密码不一致',
    'reset.success': '密码已更新，将跳转登录页',
    'callback.title': '验证中',
    'callback.wait': '请稍候',
    'callback.error.missingInfo': '缺少验证信息',
    'callback.error.invalidLink': '链接无效或已过期',
    'trial.meta.title': '申请试用账号',
    'trial.hero.eyebrow': 'RFID Fitting Room Platform',
    'trial.title': '申请 14 天试用账号',
    'trial.subtitle': '通过 RFID 实时数据，快速洞察试穿行为、转化机会与补货风险。先开通试用环境，体验完整决策流程。',
    'trial.hero.point.1': '实时掌握试衣间与热门商品流向，缩短店务反应时间',
    'trial.hero.point.2': '聚焦高机会商品与异常停留，让门店行动更精准',
    'trial.hero.point.3': '用可执行清单支持管理决策，提升运营透明度',
    'trial.note.title': '试用说明',
    'trial.note.body': '提交申请后，系统将审核并向你的邮箱发送激活通知。',
    'trial.form.title': '填写资料获取试用资格',
    'trial.field.fullName': '姓名',
    'trial.field.company': '公司',
    'trial.field.jobTitle': '职称',
    'trial.field.email': '邮箱',
    'trial.placeholder.fullName': '请输入姓名',
    'trial.placeholder.company': '请输入公司名称',
    'trial.placeholder.jobTitle': '请输入职称',
    'trial.placeholder.email': 'name@company.com',
    'trial.submit': '提交试用申请',
    'trial.disclaimer': '我们仅用于试用账号审核与激活通知，不用于其他营销用途。',
    'trial.backToLogin': '返回登录',
    'trial.error.required': '请完整填写姓名、公司、职称与邮箱。',
    'trial.submit.loading': '提交中…',
    'trial.error.validation': '字段格式有误，请检查后再提交。',
    'trial.error.duplicate': '此邮箱已有待处理的试用申请。',
    'trial.error.registered': '此邮箱已注册账号。',
    'trial.error.rateLimited': '申请过于频繁，请稍后再试。',
    'trial.error.submitFailed': '提交失败，请稍后再试。',
    'trial.success': '已收到你的申请，请留意邮箱中的激活通知。'
  },
  ja: {
    'common.language': '言語',
    'login.title': 'サインイン',
    'login.subtitle': 'リアルタイム RFID データで試着・転換率・補充判断を最適化します。',
    'login.hero.eyebrow': 'Retail Intelligence Platform',
    'login.hero.point.1': '試着室の動きと注目商品をリアルタイムで把握',
    'login.hero.point.2': '機会商品と転換ボトルネックを迅速に可視化',
    'login.hero.point.3': '実行可能なアクションリストで店舗判断を支援',
    'login.form.title': 'アカウントでサインイン',
    'login.email': 'メール',
    'login.placeholder.email': 'name@company.com',
    'login.password': 'パスワード',
    'login.placeholder.password': 'パスワードを入力',
    'login.submit': 'サインイン',
    'login.forgot': 'パスワードを忘れた',
    'login.trialCta': '14日間トライアルアカウントを申請',
    'login.trialHint': '正式アカウントがない場合は、トライアル環境を有効化して招待メールを受け取れます。',
    'login.demoCta': 'デモダッシュボードへ',
    'login.demoHint': 'デモモードは閲覧専用です。ダッシュボードは閲覧できますが、データや設定の変更はできません。',
    'login.success': 'サインインしました。リダイレクト中…',
    'login.error.missing_token': '認証情報が不足しています。リンクを再発行してください。',
    'login.error.invalid_recovery_link': 'リンクが無効か期限切れです。',
    'login.error.auth_callback_failed': '認証コールバックに失敗しました。再試行してください。',
    'forgot.title': 'パスワードを忘れた',
    'forgot.submit': 'リセットメールを送信',
    'forgot.success': 'リセットメールを送信しました。受信箱をご確認ください。',
    'forgot.error.default': '送信に失敗しました',
    'reset.title': '新しいパスワードを設定',
    'reset.password': '新しいパスワード',
    'reset.confirmPassword': '新しいパスワード（確認）',
    'reset.submit': 'パスワードを更新',
    'reset.error.minLength': 'パスワードは8文字以上必要です',
    'reset.error.mismatch': 'パスワードが一致しません',
    'reset.success': 'パスワードを更新しました。サインイン画面へ移動します',
    'callback.title': '認証中',
    'callback.wait': 'しばらくお待ちください',
    'callback.error.missingInfo': '認証情報が不足しています',
    'callback.error.invalidLink': 'リンクが無効か期限切れです',
    'trial.meta.title': 'トライアルアカウント申請',
    'trial.hero.eyebrow': 'RFID Fitting Room Platform',
    'trial.title': '14日間トライアルアカウントを申請',
    'trial.subtitle': 'RFID のリアルタイムデータで、試着行動・転換機会・補充リスクを可視化します。まずはトライアル環境を有効化してください。',
    'trial.hero.point.1': '試着室の動きと注目商品の流れをリアルタイムで把握',
    'trial.hero.point.2': '機会商品と異常滞在に集中し、現場アクションを最適化',
    'trial.hero.point.3': '実行可能なリストで管理判断を支援し、運用透明性を向上',
    'trial.note.title': 'トライアル案内',
    'trial.note.body': '申請送信後、内容を確認し有効化メールを送信します。',
    'trial.form.title': '情報を入力してトライアル申請',
    'trial.field.fullName': '氏名',
    'trial.field.company': '会社名',
    'trial.field.jobTitle': '役職',
    'trial.field.email': 'メール',
    'trial.placeholder.fullName': '氏名を入力',
    'trial.placeholder.company': '会社名を入力',
    'trial.placeholder.jobTitle': '役職を入力',
    'trial.placeholder.email': 'name@company.com',
    'trial.submit': 'トライアル申請を送信',
    'trial.disclaimer': '入力情報はトライアル審査と有効化通知の目的にのみ使用します。',
    'trial.backToLogin': 'サインインへ戻る',
    'trial.error.required': '氏名・会社名・役職・メールをすべて入力してください。',
    'trial.submit.loading': '送信中…',
    'trial.error.validation': '入力内容に誤りがあります。確認して再送してください。',
    'trial.error.duplicate': 'このメールには処理中のトライアル申請があります。',
    'trial.error.registered': 'このメールは既に登録済みです。',
    'trial.error.rateLimited': 'リクエストが多すぎます。しばらくしてからお試しください。',
    'trial.error.submitFailed': '送信に失敗しました。しばらくしてから再試行してください。',
    'trial.success': '申請を受け付けました。有効化案内メールをご確認ください。'
  }
};

function detectLang() {
  const queryLang = new URLSearchParams(window.location.search).get('lang');
  const stored = window.localStorage.getItem(LANG_KEY);
  const nav = (navigator.language || '').toLowerCase();
  const raw = queryLang || stored || (nav.includes('zh-tw') || nav.includes('zh-hk') ? 'zh-Hant' : nav.includes('zh') ? 'zh-Hans' : nav.startsWith('ja') ? 'ja' : 'en');
  return SUPPORTED_LANGS.includes(raw) ? raw : 'en';
}

let currentLang = detectLang();

export function getCurrentLang() {
  return currentLang;
}

export function setCurrentLang(lang) {
  const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : 'en';
  currentLang = safeLang;
  window.localStorage.setItem(LANG_KEY, safeLang);
  applyI18n();
}

export function t(key, params = {}) {
  const langPack = I18N[currentLang] || I18N.en;
  const template = langPack[key] ?? I18N.en[key] ?? key;
  return Object.entries(params).reduce(
    (acc, [paramKey, value]) => acc.replaceAll(`{${paramKey}}`, String(value ?? '')),
    template
  );
}

export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    if (!key) return;
    node.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    const key = node.getAttribute('data-i18n-placeholder');
    if (!key) return;
    node.setAttribute('placeholder', t(key));
  });
  document.documentElement.lang = currentLang;
}

export function bindLangSelect(selectEl) {
  if (!selectEl) return;
  selectEl.value = currentLang;
  selectEl.addEventListener('change', (event) => {
    setCurrentLang(String(event.target.value || 'en'));
  });
}

export function createAuthClient() {
  if (!window.supabase?.createClient) {
    throw new Error('Supabase client library not loaded');
  }
  const url = String(window.localStorage.getItem(URL_KEY) || DEFAULT_SUPABASE_URL || '').trim();
  const anonKey = String(window.localStorage.getItem(ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anonKey) {
    throw new Error('Supabase URL / Publishable Key 尚未設定');
  }
  return window.supabase.createClient(url, anonKey);
}

export function writeSession(session) {
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function writeDemoSession() {
  const now = Date.now();
  const expiresAt = new Date(now + (6 * 60 * 60 * 1000)).toISOString();
  writeSession({
    accessToken: '',
    refreshToken: null,
    expiresAt,
    user: {
      id: 'demo-viewer',
      email: 'demo@local'
    },
    profile: {
      role: 'demo_viewer',
      status: 'active',
      full_name: 'Demo Viewer',
      company_name: 'Demo Workspace',
      job_title: 'Guest'
    },
    permissions: {
      canViewDashboard: true,
      canViewProduct: false,
      canViewFittingDemo: false,
      canUseFittingDemo: false,
      canUseCsvImport: false,
      canUseSetting: false,
      canManageAccounts: false
    },
    demo: {
      enabled: true,
      token: DEMO_TOKEN
    }
  });
}

export function getSafeNextPath(input, fallback = '/') {
  const raw = String(input || '').trim();
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (raw === '/login' || raw === '/login.html') return fallback;
  return raw;
}
