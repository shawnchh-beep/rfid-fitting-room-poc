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
  const copyButton = document.querySelector('#copyButton');
  const resetButton = document.querySelector('#resetButton');

  let lastReadingText = '';
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
    lastReadingText = '';
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
      drawMode: getSelected('drawMode') || 'auto'
    };
  }

  function renderResult(data) {
    const reading = data.reading;
    const usageText = Number.isFinite(data.usage?.remainingToday) ? `｜今日剩餘 ${data.usage.remainingToday} 次` : '';
    resultMeta.textContent = `${reading.name}｜${reading.topic_label}｜${reading.method_label}${usageText}`;
    resultTitle.textContent = reading.result_title;
    resultKeywords.textContent = reading.result_keywords;
    resultText.textContent = reading.result_text;
    resultPanel.hidden = false;
    setFlowStep('result');
    lastReadingText = `我的占卜結果：${reading.result_title}\n${reading.result_keywords}\n${reading.result_text}`;
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
      await navigator.clipboard.writeText(`${lastReadingText}\nhttps://getrfid.link/fortuneteller`);
      copyButton.textContent = '已複製';
      setTimeout(() => {
        copyButton.textContent = '複製結果';
      }, 1200);
    } catch {
      setStatus('瀏覽器不允許自動複製，可以手動選取結果分享。', true);
    }
  });

  resetButton.addEventListener('click', () => {
    clearResult();
    setStatus('');
    clearPendingManual();
    setWaitingForManual(false);
    resetRitual();
    setFlowStep('setup');
  });

  setFlowStep('setup');
  setMethodVisual(getSelected('method'));
})();
