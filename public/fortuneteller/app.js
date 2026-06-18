(function () {
  const page = document.body;
  const form = document.querySelector('#fortuneForm');
  const submitButton = document.querySelector('#submitButton');
  const statusMessage = document.querySelector('#statusMessage');
  const ritualScene = document.querySelector('#ritualScene');
  const coinSet = document.querySelector('#coinSet');
  const cardSet = document.querySelector('#cardSet');
  const turtleShell = document.querySelector('#turtleShell');
  const ritualAction = document.querySelector('#ritualAction');
  const trigramSymbol = document.querySelector('#trigramSymbol');
  const hexagramLines = document.querySelector('#hexagramLines');
  const trigramName = document.querySelector('#trigramName');
  const trigramTone = document.querySelector('#trigramTone');
  const resultPanel = document.querySelector('#resultPanel');
  const resultMeta = document.querySelector('#resultMeta');
  const resultTitle = document.querySelector('#resultTitle');
  const resultKeywords = document.querySelector('#resultKeywords');
  const resultText = document.querySelector('#resultText');
  const sharePanel = document.querySelector('#sharePanel');
  const moreSharePanel = document.querySelector('#more-share-panel');
  const toggleMoreShareButton = document.querySelector('#toggle-more-share');
  const nativeShareButton = document.querySelector('#nativeShareButton');
  const textShareButton = document.querySelector('#textShareButton');
  const shareImageButton = document.querySelector('#share-image-btn');
  const copyShareCopyButton = document.querySelector('#copy-share-copy-btn');
  const resetButton = document.querySelector('#restart-btn');

  let lastReading = null;
  let lastShareUrl = '';
  let pendingPayload = null;
  let pendingManualMethod = null;
  const MIN_RITUAL_TIME = 2800;
  const VISUAL_REVEAL_PAUSE = 760;
  const ritualTimers = [];

  const SHARE_CTA_COPY_POOL = [
    '換你抽一次，看看今天輪到誰被命運嘴。',
    '不服可以自己抽，牌桌不會只針對我。',
    '來試試看，看看你的卦有沒有比較會做人。',
    '今天我被占卜嘴了，換你上去領號碼牌。',
    '命運都開口了，你也來聽聽它想酸什麼。',
    '這卦有點準到失禮，你也來感受一下。',
    '人生很難懂，不如先讓牌幫你亂講幾句。',
    '換你測看看，搞不好比我更像事故現場。',
    '這不是答案，是命運委婉地翻白眼。',
    '來抽一把，看看今天人生要演哪一齣。',
    '我的結果先放這，你的八卦可能更精彩。',
    '想知道自己今天會被怎麼嘴，自己來抽。'
  ];

  const SHARE_CARD_GRADIENTS = [
    ['#0f172a', '#312e81'],
    ['#111827', '#7c3aed'],
    ['#1e293b', '#0f766e'],
    ['#27272a', '#b45309'],
    ['#18181b', '#be123c'],
    ['#020617', '#0369a1']
  ];

  const SHARE_IMAGE_FILE_NAME = 'fortune-result.png';
  const IMAGE_SHARE_PLATFORM_LABELS = {
    native: '系統分享',
    facebook: 'Facebook',
    threads: 'Threads',
    instagram: 'Instagram'
  };

  const trigramMap = {
    'front-front-front': { name: '乾象', symbol: '☰', tone: '主動出擊，別再把勇敢放進草稿夾。' },
    'back-back-back': { name: '坤象', symbol: '☷', tone: '先穩住，急著翻桌不會讓牌變好。' },
    'front-back-back': { name: '震象', symbol: '☳', tone: '變動來敲門，別忙著假裝沒人在家。' },
    'back-front-front': { name: '巽象', symbol: '☴', tone: '慢慢滲透，比硬撞人生的牆有用。' },
    'front-back-front': { name: '坎象', symbol: '☵', tone: '有坑，先看路，少替煩惱加特效。' },
    'back-front-back': { name: '離象', symbol: '☲', tone: '真相已打燈，裝沒看見就有點演了。' },
    'front-front-back': { name: '艮象', symbol: '☶', tone: '停一下，不是輸，是別把油門當腦子。' },
    'back-back-front': { name: '兌象', symbol: '☱', tone: '靠嘴可以，但記得講重點，別開脫口秀。' }
  };

  const baguaFaceMap = {
    bagua_qian: ['front', 'front', 'front'],
    bagua_kun: ['back', 'back', 'back'],
    bagua_zhen: ['front', 'back', 'back'],
    bagua_xun: ['back', 'front', 'front'],
    bagua_kan: ['front', 'back', 'front'],
    bagua_li: ['back', 'front', 'back'],
    bagua_gen: ['front', 'front', 'back'],
    bagua_dui: ['back', 'back', 'front']
  };

  const tarotVisuals = {
    tarot_fool: ['愚者', '◇', '開始 / 先看路'],
    tarot_magician: ['魔術師', '✦', '行動 / 別空想'],
    tarot_high_priestess: ['女祭司', '☾', '直覺 / 少問廢話'],
    tarot_empress: ['皇后', '✿', '成長 / 別催熟'],
    tarot_emperor: ['皇帝', '♜', '規劃 / 別亂控'],
    tarot_lovers: ['戀人', '♡', '選擇 / 別亂配'],
    tarot_chariot: ['戰車', '➤', '推進 / 看路'],
    tarot_strength: ['力量', '∞', '耐心 / 別硬剛'],
    tarot_hermit: ['隱者', '✧', '沉澱 / 別失聯'],
    tarot_wheel: ['命運之輪', '◌', '轉折 / 接好球'],
    tarot_star: ['星星', '✦', '希望 / 別再拖'],
    tarot_sun: ['太陽', '☀', '能量 / 少悲觀']
  };

  function getSelected(name) {
    return form.querySelector(`input[name="${name}"]:checked`)?.value;
  }

  function getShareToken() {
    return new URLSearchParams(window.location.search).get('share');
  }

  function getTrackingParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || null,
      utm_medium: params.get('utm_medium') || null,
      utm_campaign: params.get('utm_campaign') || null,
      referrer: document.referrer || null
    };
  }

  function setStatus(message, isError) {
    statusMessage.textContent = message || '';
    statusMessage.classList.toggle('is-error', Boolean(isError));
  }

  function wait(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      ritualTimers.push(timer);
    });
  }

  function setFlowStep(step) {
    page.dataset.step = step;
    if (window.matchMedia('(max-width: 820px)').matches) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function clearRitualTimers() {
    while (ritualTimers.length) {
      clearTimeout(ritualTimers.pop());
    }
  }

  function resetRitual() {
    clearRitualTimers();
    ritualScene.classList.remove('is-casting');
    coinSet.className = 'coin-set is-idle';
    cardSet.className = 'card-set is-idle';
    ritualAction.hidden = true;
    cardSet.querySelectorAll('.tarot-card').forEach((card) => {
      card.classList.toggle('is-selected', card.classList.contains('card-b'));
      const inner = card.querySelector('.tarot-card__inner');
      if (inner) inner.style.transform = '';
    });
  }

  function clearPendingManual() {
    pendingPayload = null;
    pendingManualMethod = null;
    cardSet.classList.remove('is-pickable');
    ritualAction.hidden = true;
  }

  function clearResult() {
    resultPanel.hidden = true;
    resultMeta.textContent = '';
    resultTitle.textContent = '';
    resultKeywords.textContent = '';
    resultText.textContent = '';
    sharePanel.hidden = true;
    if (moreSharePanel) moreSharePanel.hidden = true;
    if (toggleMoreShareButton) toggleMoreShareButton.textContent = '更多分享方式';
    lastReading = null;
    lastShareUrl = '';
  }

  function setMethodVisual(method) {
    const isTarot = method === 'tarot';
    resetRitual();
    ritualScene.classList.toggle('method--tarot', isTarot);
    ritualScene.classList.toggle('method--bagua', !isTarot);
    coinSet.hidden = isTarot;
    cardSet.hidden = !isTarot;
  }

  function setBusy(isBusy) {
    submitButton.disabled = isBusy;
    submitButton.setAttribute('aria-busy', String(isBusy));
    submitButton.textContent = isBusy ? '占卜中...' : '開始占卜';
  }

  function setWaitingForManual(isWaiting) {
    submitButton.disabled = isWaiting;
    submitButton.setAttribute('aria-busy', String(isWaiting));
    submitButton.textContent = isWaiting ? '等待你出手...' : '開始占卜';
  }

  function generateCoinFaces(seedText) {
    let seed = 0;
    String(seedText || Date.now()).split('').forEach((char) => {
      seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
    });
    return Array.from({ length: 6 }, (_, index) => ((seed >> (index * 3)) & 1 ? 'front' : 'back'));
  }

  function applyCoinResult(reading) {
    const lines = Array.isArray(reading.result_lines) && reading.result_lines.length === 6 ? reading.result_lines : null;
    const faces = lines || generateCoinFaces(`${reading.id || ''}${reading.result_key || ''}`);
    const coins = coinSet.querySelectorAll('.coin');
    coins.forEach((coin, index) => {
      coin.dataset.face = faces[index] || 'front';
    });

    const lowerTrigramFaces = faces.slice(0, 3);
    const fallbackTrigramFaces = baguaFaceMap[reading.result_key];
    const trigram = trigramMap[lowerTrigramFaces.join('-')]
      || (fallbackTrigramFaces ? trigramMap[fallbackTrigramFaces.join('-')] : null)
      || trigramMap['front-front-front'];
    trigramSymbol.textContent = trigram.symbol;
    trigramName.textContent = reading.result_title || trigram.name;
    trigramTone.textContent = reading.result_keywords || trigram.tone;
    hexagramLines.innerHTML = '';
    (lines || faces).slice().reverse().forEach((line) => {
      const item = document.createElement('span');
      item.className = `hexagram-line hexagram-line--${line === 'front' ? 'yang' : 'yin'}`;
      hexagramLines.appendChild(item);
    });
    coinSet.className = 'coin-set is-settled';
  }

  function applyTarotResult(reading) {
    const selected = cardSet.querySelector('.tarot-card.is-selected');
    const visual = reading.result_visual || tarotVisuals[reading.result_key] || ['TODAY', '☾', '宇宙想嘴你'];
    if (selected) {
      selected.dataset.card = reading.result_base_key || reading.result_key || 'today';
      selected.dataset.orientation = reading.result_orientation || 'upright';
      selected.querySelector('.tarot-card__title').textContent = visual[0];
      selected.querySelector('.tarot-card__symbol').textContent = visual[1];
      selected.querySelector('.tarot-card__keyword').textContent = visual[2];
    }
    cardSet.className = 'card-set is-revealed';
  }

  function startRitual(method) {
    resetRitual();
    ritualScene.classList.add('is-casting');
    if (method === 'tarot') {
      cardSet.className = 'card-set is-shuffling';
      wait(850).then(() => { cardSet.className = 'card-set is-stacking'; });
      wait(1550).then(() => { cardSet.className = 'card-set is-cutting'; });
      wait(2150).then(() => { cardSet.className = 'card-set is-spreading'; });
      wait(2700).then(() => { cardSet.className = 'card-set is-drawing'; });
      return;
    }
    coinSet.className = 'coin-set is-casting';
  }

  function revealRitual(method, reading) {
    ritualScene.classList.remove('is-casting');
    if (method === 'tarot') {
      applyTarotResult(reading);
      return;
    }
    applyCoinResult(reading);
  }

  function buildPayload() {
    return {
      name: String(new FormData(form).get('name') || '').trim(),
      topic: getSelected('topic'),
      method: getSelected('method'),
      drawMode: getSelected('drawMode') || 'auto',
      ...getTrackingParams()
    };
  }

  function withShareSource(url, platform) {
    if (!url) return '';
    const shareUrl = new URL(url, window.location.origin);
    shareUrl.searchParams.set('utm_source', platform);
    shareUrl.searchParams.set('utm_medium', 'share');
    return shareUrl.toString();
  }

  function stableIndex(seedText, length) {
    let seed = 0;
    String(seedText || Date.now()).split('').forEach((char) => {
      seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
    });
    return seed % length;
  }

  function getShareCta(reading) {
    const seed = `${reading?.id || ''}:${reading?.result_key || ''}:${reading?.topic || ''}`;
    return SHARE_CTA_COPY_POOL[stableIndex(seed, SHARE_CTA_COPY_POOL.length)];
  }

  function getShareText(reading, shareUrl) {
    return [reading.result_text, getShareCta(reading), shareUrl].filter(Boolean).join('\n');
  }

  function getDefaultShareUrl() {
    return new URL('/fortuneteller', window.location.origin).toString();
  }

  function getRandomShareCta() {
    return SHARE_CTA_COPY_POOL[Math.floor(Math.random() * SHARE_CTA_COPY_POOL.length)];
  }

  function getRandomShareGradient() {
    return SHARE_CARD_GRADIENTS[Math.floor(Math.random() * SHARE_CARD_GRADIENTS.length)];
  }

  function truncateShareText(text, maxLength = 108) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength - 1)}…`;
  }

  function getDisplayShareUrl(url) {
    try {
      const shareUrl = new URL(url || getDefaultShareUrl(), window.location.origin);
      return `${shareUrl.host}${shareUrl.pathname}`.replace(/\/$/, '');
    } catch {
      return 'getrfid.link/fortuneteller';
    }
  }

  function getCurrentFortuneShareData() {
    if (!lastReading) return null;
    const resultVisual = Array.isArray(lastReading.result_visual) ? lastReading.result_visual : null;
    const resultSymbol = resultVisual?.[1] || trigramSymbol.textContent || '☰';
    const url = lastShareUrl || getDefaultShareUrl();
    return {
      resultTitle: lastReading.result_title || resultTitle.textContent || '今日小占卜',
      resultSymbol,
      resultText: truncateShareText(lastReading.result_text || resultText.textContent || ''),
      methodLabel: lastReading.method_label || '',
      url,
      displayUrl: getDisplayShareUrl(url),
      cta: getRandomShareCta(),
      gradient: getRandomShareGradient()
    };
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const chars = Array.from(String(text || ''));
    const lines = [];
    let currentLine = '';

    chars.forEach((char) => {
      const nextLine = `${currentLine}${char}`;
      if (ctx.measureText(nextLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = char;
        return;
      }
      currentLine = nextLine;
    });
    if (currentLine) lines.push(currentLine);

    const visibleLines = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      visibleLines[visibleLines.length - 1] = `${visibleLines[visibleLines.length - 1].slice(0, -1)}…`;
    }

    visibleLines.forEach((line, index) => {
      ctx.fillText(line, x, y + index * lineHeight);
    });
    return y + visibleLines.length * lineHeight;
  }

  async function generateCanvasShareImageBlob(data) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available.');

    const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
    gradient.addColorStop(0, data.gradient[0]);
    gradient.addColorStop(1, data.gradient[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1350);

    const glowA = ctx.createRadialGradient(240, 240, 20, 240, 240, 360);
    glowA.addColorStop(0, 'rgba(255,255,255,.18)');
    glowA.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glowA;
    ctx.fillRect(0, 0, 1080, 1350);

    const glowB = ctx.createRadialGradient(850, 1050, 20, 850, 1050, 360);
    glowB.addColorStop(0, 'rgba(121,215,189,.16)');
    glowB.addColorStop(1, 'rgba(121,215,189,0)');
    ctx.fillStyle = glowB;
    ctx.fillRect(0, 0, 1080, 1350);

    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(540, 560, 410, 410, 0, 0, Math.PI * 2);
    ctx.stroke();

    drawRoundedRect(ctx, 86, 86, 908, 1178, 44);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.24)';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,248,237,.78)';
    ctx.font = '800 34px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(data.methodLabel ? `今日小占卜 · ${data.methodLabel}` : '今日小占卜', 540, 160);

    ctx.beginPath();
    ctx.arc(540, 410, 140, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.11)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.2)';
    ctx.stroke();

    ctx.fillStyle = '#fff8ed';
    ctx.font = '900 154px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI Symbol", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.resultSymbol || '☰', 540, 410);

    ctx.textBaseline = 'top';
    ctx.font = '900 68px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(data.resultTitle || '今日小占卜', 540, 586, 820);

    const divider = ctx.createLinearGradient(474, 718, 606, 718);
    divider.addColorStop(0, 'rgba(255,248,237,0)');
    divider.addColorStop(.5, 'rgba(255,248,237,.82)');
    divider.addColorStop(1, 'rgba(255,248,237,0)');
    ctx.fillStyle = divider;
    ctx.fillRect(474, 718, 132, 2);

    ctx.fillStyle = 'rgba(255,248,237,.94)';
    ctx.font = '700 42px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    drawWrappedText(ctx, data.resultText, 540, 780, 820, 60, 5);

    ctx.fillStyle = 'rgba(255,248,237,.86)';
    ctx.font = '800 38px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    drawWrappedText(ctx, data.cta, 540, 1085, 820, 52, 2);

    ctx.fillStyle = 'rgba(255,248,237,.58)';
    ctx.font = '700 30px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(data.displayUrl || 'getrfid.link/fortuneteller', 540, 1204, 820);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas export failed.'));
      }, 'image/png');
    });
  }

  async function generateShareImageBlob(data) {
    return generateCanvasShareImageBlob(data);
  }

  function downloadBlob(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
  }

  function supportsImageShare() {
    try {
      const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches;
      const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
      if (!isTouchDevice && !isMobileUA) return false;
      if (!navigator.share || !navigator.canShare || typeof File === 'undefined') return false;
      const file = new File(['fortune'], SHARE_IMAGE_FILE_NAME, { type: 'image/png' });
      return navigator.canShare({ files: [file] });
    } catch {
      return false;
    }
  }

  function updateShareImageButtonLabel() {
    if (shareImageButton) shareImageButton.textContent = '分享結果圖';
    if (nativeShareButton) nativeShareButton.textContent = supportsImageShare() ? '系統分享' : '下載結果圖';
  }

  async function fallbackTextShare(data) {
    const text = [data?.resultText, data?.cta, data?.url].filter(Boolean).join('\n');
    if (navigator.share) {
      try {
        await navigator.share({
          title: `我的占卜結果：${data?.resultTitle || '今日小占卜'}`,
          text,
          url: data?.url || getDefaultShareUrl()
        });
        return '已改用文字分享。';
      } catch (error) {
        if (error?.name === 'AbortError') return '已取消分享。';
      }
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text || getDefaultShareUrl());
      return '圖片產生失敗，已改複製文字分享。';
    }
    return '圖片產生失敗，請改用複製分享文案。';
  }

  function getTextShareData(platform = 'text') {
    if (!lastReading) return null;
    const shareUrl = lastShareUrl ? withShareSource(lastShareUrl, platform) : getDefaultShareUrl();
    return {
      title: `我的占卜結果：${lastReading.result_title}`,
      text: getShareText(lastReading, ''),
      url: shareUrl,
      clipboardText: getShareText(lastReading, shareUrl)
    };
  }

  async function shareTextOnly() {
    const data = getTextShareData('text');
    if (!data) {
      setStatus('請先完成占卜，再分享文字。', true);
      return;
    }

    const originalText = textShareButton.textContent;
    textShareButton.disabled = true;
    textShareButton.textContent = '分享中...';
    await recordShare('text_native');

    try {
      if (navigator.share) {
        await navigator.share({
          title: data.title,
          text: data.text,
          url: data.url
        });
        setStatus('文字分享已送出。');
        return;
      }

      await navigator.clipboard.writeText(data.clipboardText);
      setStatus('這個瀏覽器沒有系統分享，已幫你複製文字。');
    } catch (error) {
      if (error?.name === 'AbortError') {
        setStatus('已取消分享。');
        return;
      }
      try {
        await navigator.clipboard.writeText(data.clipboardText);
        setStatus('分享面板打不開，已改複製文字。');
      } catch {
        setStatus('這個瀏覽器不支援文字分享，請改用複製分享文案。', true);
      }
    } finally {
      textShareButton.disabled = false;
      textShareButton.textContent = originalText;
    }
  }

  async function shareOrDownloadImage(platform = 'native', button = shareImageButton) {
    const data = getCurrentFortuneShareData();
    if (!data) {
      setStatus('請先完成占卜，再產生結果圖。', true);
      return;
    }

    const originalText = button?.textContent || '';
    if (button) {
      button.disabled = true;
      button.textContent = '產圖中⋯';
    }

    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const blob = await generateShareImageBlob(data);
      const file = new File([blob], SHARE_IMAGE_FILE_NAME, { type: 'image/png' });
      const platformLabel = IMAGE_SHARE_PLATFORM_LABELS[platform] || '平台';

      if (supportsImageShare() && navigator.canShare({ files: [file] })) {
        await recordShare(`image_${platform}`);
        await navigator.share({
          files: [file],
          title: `我的占卜結果：${data.resultTitle}`,
          text: data.cta
        });
        setStatus(platform === 'native' ? '占卜結果圖已送出分享。' : `圖片已交給系統分享，請選 ${platformLabel}。`);
        return;
      }

      await recordShare('image_download');
      downloadBlob(blob, SHARE_IMAGE_FILE_NAME);
      setStatus(`這個瀏覽器不能直接分享圖片到 ${platformLabel}，已先下載圖片。`);
    } catch (error) {
      if (error?.name === 'AbortError') {
        setStatus('已取消分享。');
        return;
      }
      console.error('Failed to generate or share fortune image', error);
      try {
        await fallbackTextShare(data);
        setStatus('圖片產生失敗，改用複製文案。');
      } catch {
        setStatus('圖片產生失敗，改用複製文案。', true);
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
      updateShareImageButtonLabel();
    }
  }

  function showSharePanel(reading) {
    lastShareUrl = reading.share_url || getDefaultShareUrl();
    sharePanel.hidden = false;
    if (moreSharePanel) moreSharePanel.hidden = true;
    if (toggleMoreShareButton) toggleMoreShareButton.textContent = '更多分享方式';
  }

  function renderResult(data) {
    const reading = data.reading;
    const hourlyText = Number.isFinite(data.usage?.remainingThisHour) ? `｜本小時剩餘 ${data.usage.remainingThisHour} 次` : '';
    const dailyText = Number.isFinite(data.usage?.remainingToday) ? `｜今日剩餘 ${data.usage.remainingToday} 次` : '';
    const usageText = `${hourlyText}${dailyText}`;
    resultMeta.textContent = `${reading.name}｜${reading.topic_label}｜${reading.method_label}${usageText}`;
    resultTitle.textContent = reading.result_title;
    resultKeywords.textContent = reading.result_keywords || '';
    resultText.textContent = reading.result_text;
    resultPanel.hidden = false;
    lastReading = reading;
    showSharePanel(reading);
    setFlowStep('result');
  }

  async function recordShare(platform) {
    if (!lastReading?.id) return;
    try {
      await fetch('/api/fortune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'share',
          reading_id: lastReading.id,
          platform,
          action: 'click'
        })
      });
    } catch {
      // Sharing should still work even if analytics is temporarily unavailable.
    }
  }

  async function copyText(text, button, doneText) {
    await navigator.clipboard.writeText(text);
    const originalText = button.textContent;
    button.textContent = doneText;
    setTimeout(() => {
      button.textContent = originalText;
    }, 1500);
  }

  async function copyShareCopy() {
    if (!lastShareUrl) return;
    const shareUrl = withShareSource(lastShareUrl, 'copy');
    await recordShare('copy');
    try {
      await copyText(getShareText(lastReading, shareUrl), copyShareCopyButton, '已複製');
      setStatus('分享文案已複製。');
    } catch {
      setStatus('瀏覽器不允許自動複製，可以手動選取分享文案。', true);
    }
  }

  async function shareNative() {
    if (!lastReading || !lastShareUrl) return;
    const shareUrl = withShareSource(lastShareUrl, 'native');
    await recordShare('native');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `我的占卜結果：${lastReading.result_title}`,
          text: getShareText(lastReading, ''),
          url: shareUrl
        });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    try {
      await copyText(shareUrl, nativeShareButton, '已複製');
      setStatus('這個瀏覽器沒有系統分享，已幫你複製連結。');
    } catch {
      setStatus('這個瀏覽器不支援系統分享，請改用複製連結。', true);
    }
  }

  async function shareToPlatform(platform) {
    if (!lastReading || !lastShareUrl) return;
    const shareUrl = withShareSource(lastShareUrl, platform);
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(getShareText(lastReading, shareUrl));
    const urls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      threads: `https://www.threads.net/intent/post?text=${encodedText}`,
      line: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`,
      x: `https://twitter.com/intent/tweet?text=${encodedText}`
    };

    await recordShare(platform);
    window.open(urls[platform], '_blank', 'noopener,noreferrer');
  }

  async function loadSharedReading(token) {
    setStatus('正在讀取分享結果。');
    clearResult();
    clearPendingManual();
    setWaitingForManual(false);

    try {
      const response = await fetch(`/api/fortune?share=${encodeURIComponent(token)}`);
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : null;
      if (!response.ok) {
        throw new Error(data?.error?.message || '分享結果讀取失敗。');
      }

      setMethodVisual(data.reading.method);
      renderResult(data);
      setStatus('這是分享來的占卜結果。');
    } catch (error) {
      setStatus(error.message || '分享結果讀取失敗。', true);
      setFlowStep('setup');
    }
  }

  async function performReading(payload, options = {}) {
    const isManualTarot = options.manual && payload.method === 'tarot';
    setFlowStep('ritual');
    setBusy(true);
    clearPendingManual();

    if (isManualTarot) {
      ritualScene.classList.add('is-casting');
      cardSet.className = 'card-set is-drawing';
      setStatus('你抽的牌正在翻面，宇宙準備開始嘴。');
    } else {
      startRitual(payload.method);
      setStatus(payload.method === 'tarot' ? '正在洗牌，請等牌面停下來。' : '正在搖龜殼丟銅錢，請等卦象落定。');
    }

    try {
      const ritualPromise = wait(MIN_RITUAL_TIME);
      const apiPromise = fetch('/api/fortune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const response = await apiPromise;
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : null;

      if (!response.ok) {
        throw new Error(data?.error?.message || '占卜服務暫時不可用，請稍後再試。');
      }

      await ritualPromise;
      revealRitual(payload.method, data.reading);
      setStatus(payload.method === 'tarot' ? '牌面翻開了，宇宙正在組織吐槽。' : '卦象落定了，文字解讀正在補刀。');
      await wait(VISUAL_REVEAL_PAUSE);
      renderResult(data);
      setStatus('占卜完成。');
    } catch (error) {
      resetRitual();
      setStatus(error.message || '占卜失敗，請稍後再試。', true);
    } finally {
      setBusy(false);
    }
  }

  function prepareManualReading(payload) {
    pendingPayload = payload;
    pendingManualMethod = payload.method;
    setFlowStep('ritual');
    setWaitingForManual(true);
    resetRitual();

    if (payload.method === 'tarot') {
      ritualScene.classList.add('is-casting');
      cardSet.className = 'card-set is-shuffling';
      ritualAction.hidden = true;
      setStatus('正在洗牌疊牌，等等會抽出三張給你選。');
      wait(850).then(() => {
        if (pendingManualMethod === 'tarot') {
          cardSet.className = 'card-set is-stacking';
          setStatus('牌堆疊好了，宇宙正在把三張牌推出來。');
        }
      });
      wait(1650).then(() => {
        if (pendingManualMethod === 'tarot') {
          ritualScene.classList.remove('is-casting');
          cardSet.className = 'card-set is-pickable';
          setStatus('請從三張牌背裡抽一張。放心，抽歪了宇宙也會自己圓。');
        }
      });
      return;
    }

    coinSet.className = 'coin-set is-awaiting';
    ritualAction.textContent = '點龜殼丟銅板';
    ritualAction.hidden = false;
    setStatus('請點龜殼丟銅板。命運已經坐好，等你開場。');
  }

  function beginManualBagua() {
    if (!pendingPayload || pendingManualMethod !== 'bagua') return;
    performReading(pendingPayload, { manual: true });
  }

  function beginManualTarot(card) {
    if (!pendingPayload || pendingManualMethod !== 'tarot') return;
    cardSet.querySelectorAll('.tarot-card').forEach((item) => {
      item.classList.toggle('is-selected', item === card);
    });
    performReading(pendingPayload, { manual: true });
  }

  function submitReading(event) {
    event.preventDefault();
    setStatus('');
    clearResult();
    clearPendingManual();

    const payload = buildPayload();

    if (!payload.name) {
      setStatus('請先輸入名字或暱稱。', true);
      return;
    }

    if (payload.drawMode === 'manual') {
      prepareManualReading(payload);
      return;
    }

    performReading(payload);
  }

  form.addEventListener('change', (event) => {
    if (event.target?.name === 'method') {
      clearResult();
      clearPendingManual();
      setWaitingForManual(false);
      setMethodVisual(event.target.value);
      setStatus('');
      setFlowStep('setup');
    }
    if (event.target?.name === 'drawMode') {
      clearResult();
      clearPendingManual();
      setWaitingForManual(false);
      resetRitual();
      setStatus('');
      setFlowStep('setup');
    }
    if (event.target?.name === 'topic') {
      clearResult();
      clearPendingManual();
      setWaitingForManual(false);
      resetRitual();
      setStatus('');
      setFlowStep('setup');
    }
  });

  form.addEventListener('submit', submitReading);

  ritualAction.addEventListener('click', beginManualBagua);
  turtleShell.addEventListener('click', beginManualBagua);
  cardSet.querySelectorAll('.tarot-card').forEach((card) => {
    card.addEventListener('click', () => beginManualTarot(card));
  });

  copyShareCopyButton.addEventListener('click', copyShareCopy);
  if (toggleMoreShareButton && moreSharePanel) {
    toggleMoreShareButton.addEventListener('click', () => {
      moreSharePanel.hidden = !moreSharePanel.hidden;
      toggleMoreShareButton.textContent = moreSharePanel.hidden ? '更多分享方式' : '收起分享方式';
    });
  }
  nativeShareButton.addEventListener('click', () => shareOrDownloadImage('native', nativeShareButton));
  if (textShareButton) {
    textShareButton.addEventListener('click', shareTextOnly);
  }
  if (shareImageButton) {
    shareImageButton.addEventListener('click', () => shareOrDownloadImage('native', shareImageButton));
  }
  sharePanel.querySelectorAll('[data-image-share-platform]').forEach((button) => {
    button.addEventListener('click', () => shareOrDownloadImage(button.dataset.imageSharePlatform, button));
  });

  resetButton.addEventListener('click', () => {
    clearResult();
    setStatus('');
    clearPendingManual();
    setWaitingForManual(false);
    resetRitual();
    window.history.replaceState({}, '', '/fortuneteller');
    setFlowStep('setup');
  });

  setFlowStep('setup');
  setMethodVisual(getSelected('method'));
  updateShareImageButtonLabel();
  const shareToken = getShareToken();
  if (shareToken) loadSharedReading(shareToken);
})();
