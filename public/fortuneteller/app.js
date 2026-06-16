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
  const shareLinkInput = document.querySelector('#shareLinkInput');
  const copyLinkButton = document.querySelector('#copyLinkButton');
  const nativeShareButton = document.querySelector('#nativeShareButton');
  const copyButton = document.querySelector('#copyButton');
  const resetButton = document.querySelector('#resetButton');

  let lastReadingText = '';
  let lastReading = null;
  let lastShareUrl = '';
  let pendingPayload = null;
  let pendingManualMethod = null;
  const MIN_RITUAL_TIME = 2800;
  const VISUAL_REVEAL_PAUSE = 760;
  const ritualTimers = [];

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
    shareLinkInput.value = '';
    lastReadingText = '';
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
    return Array.from({ length: 3 }, (_, index) => ((seed >> (index * 3)) & 1 ? 'front' : 'back'));
  }

  function applyCoinResult(reading) {
    const lines = Array.isArray(reading.result_lines) && reading.result_lines.length === 6 ? reading.result_lines : null;
    const faces = lines?.slice(0, 3) || baguaFaceMap[reading.result_key] || generateCoinFaces(`${reading.id || ''}${reading.result_key || ''}`);
    const coins = coinSet.querySelectorAll('.coin');
    coins.forEach((coin, index) => {
      coin.dataset.face = faces[index];
    });

    const trigram = trigramMap[faces.join('-')] || trigramMap['front-front-front'];
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

  function getShareText(reading, shareUrl) {
    return `我抽到：${reading.result_title}\n${reading.result_text}\n${shareUrl}`;
  }

  function showSharePanel(reading) {
    lastShareUrl = reading.share_url || '';
    if (!lastShareUrl) {
      sharePanel.hidden = true;
      return;
    }

    shareLinkInput.value = withShareSource(lastShareUrl, 'copy');
    sharePanel.hidden = false;
  }

  function renderResult(data) {
    const reading = data.reading;
    const usageText = Number.isFinite(data.usage?.remainingToday) ? `｜今日剩餘 ${data.usage.remainingToday} 次` : '';
    resultMeta.textContent = `${reading.name}｜${reading.topic_label}｜${reading.method_label}${usageText}`;
    resultTitle.textContent = reading.result_title;
    resultKeywords.textContent = reading.result_keywords || '';
    resultText.textContent = reading.result_text;
    resultPanel.hidden = false;
    lastReading = reading;
    showSharePanel(reading);
    setFlowStep('result');
    lastReadingText = `我的占卜結果：${reading.result_title}\n${reading.result_keywords || ''}\n${reading.result_text}`;
  }

  async function recordShare(platform) {
    if (!lastReading?.id) return;
    try {
      await fetch('/api/fortune-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
    }, 1200);
  }

  async function copyShareLink() {
    if (!lastShareUrl) return;
    const shareUrl = withShareSource(lastShareUrl, 'copy');
    await recordShare('copy');
    try {
      await copyText(shareUrl, copyLinkButton, '已複製');
      shareLinkInput.value = shareUrl;
      setStatus('分享連結已複製。');
    } catch {
      setStatus('瀏覽器不允許自動複製，可以手動選取分享連結。', true);
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
      const response = await fetch(`/api/fortune-shared?token=${encodeURIComponent(token)}`);
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

  copyButton.addEventListener('click', async () => {
    if (!lastReadingText) return;
    try {
      const shareUrl = lastShareUrl ? withShareSource(lastShareUrl, 'copy') : 'https://getrfid.link/fortuneteller';
      await navigator.clipboard.writeText(`${lastReadingText}\n${shareUrl}`);
      copyButton.textContent = '已複製';
      setTimeout(() => {
        copyButton.textContent = '複製結果';
      }, 1200);
    } catch {
      setStatus('瀏覽器不允許自動複製，可以手動選取結果分享。', true);
    }
  });

  copyLinkButton.addEventListener('click', copyShareLink);
  nativeShareButton.addEventListener('click', shareNative);
  sharePanel.querySelectorAll('[data-share-platform]').forEach((button) => {
    button.addEventListener('click', () => shareToPlatform(button.dataset.sharePlatform));
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
  const shareToken = getShareToken();
  if (shareToken) loadSharedReading(shareToken);
})();
