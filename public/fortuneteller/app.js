(function () {
  const form = document.querySelector('#fortuneForm');
  const submitButton = document.querySelector('#submitButton');
  const statusMessage = document.querySelector('#statusMessage');
  const ritualScene = document.querySelector('#ritualScene');
  const coinSet = document.querySelector('#coinSet');
  const cardSet = document.querySelector('#cardSet');
  const trigramSymbol = document.querySelector('#trigramSymbol');
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
  const MIN_RITUAL_TIME = 2800;
  const ritualTimers = [];

  const trigramMap = {
    'front-front-front': { name: '乾象', symbol: '☰', tone: '主動出擊，別再把勇敢放進草稿夾。' },
    'back-back-back': { name: '坤象', symbol: '☷', tone: '先穩住，急著翻桌不會讓牌變好。' },
    'front-back-back': { name: '震象', symbol: '☳', tone: '變動來敲門，別忙著假裝沒人在家。' },
    'back-front-front': { name: '巽象', symbol: '☴', tone: '慢慢滲透，比硬撞人生的牆有用。' },
    'back-front-back': { name: '坎象', symbol: '☵', tone: '有坑，先看路，少替煩惱加特效。' },
    'front-back-front': { name: '離象', symbol: '☲', tone: '真相已打燈，裝沒看見就有點演了。' },
    'back-back-front': { name: '艮象', symbol: '☶', tone: '停一下，不是輸，是別把油門當腦子。' },
    'front-front-back': { name: '兌象', symbol: '☱', tone: '靠嘴可以，但記得講重點，別開脫口秀。' }
  };

  const baguaFaceMap = {
    bagua_qian: ['front', 'front', 'front'],
    bagua_kun: ['back', 'back', 'back'],
    bagua_zhen: ['front', 'back', 'back'],
    bagua_xun: ['back', 'front', 'front'],
    bagua_kan: ['back', 'front', 'back'],
    bagua_li: ['front', 'back', 'front'],
    bagua_gen: ['back', 'back', 'front'],
    bagua_dui: ['front', 'front', 'back']
  };

  const tarotVisuals = {
    tarot_fool: ['THE FOOL', '◇', '新局 / 別裸衝'],
    tarot_magician: ['MAGICIAN', '✦', '資源 / 動起來'],
    tarot_high_priestess: ['PRIESTESS', '☾', '直覺 / 少裝傻'],
    tarot_empress: ['EMPRESS', '✿', '滋養 / 別催熟'],
    tarot_emperor: ['EMPEROR', '♜', '秩序 / 少控制'],
    tarot_lovers: ['LOVERS', '♡', '選擇 / 別亂配'],
    tarot_chariot: ['CHARIOT', '➤', '前進 / 看路'],
    tarot_strength: ['STRENGTH', '∞', '耐心 / 別硬剛'],
    tarot_hermit: ['HERMIT', '✧', '沉澱 / 別失聯'],
    tarot_wheel: ['WHEEL', '◌', '轉機 / 接好球'],
    tarot_star: ['THE STAR', '✦', '希望 / 別再拖'],
    tarot_sun: ['THE SUN', '☀', '亮眼 / 少滑手機']
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
    cardSet.querySelectorAll('.tarot-card').forEach((card) => {
      card.classList.toggle('is-selected', card.classList.contains('card-b'));
      const inner = card.querySelector('.tarot-card__inner');
      if (inner) inner.style.transform = '';
    });
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

  function generateCoinFaces(seedText) {
    let seed = 0;
    String(seedText || Date.now()).split('').forEach((char) => {
      seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
    });
    return Array.from({ length: 3 }, (_, index) => ((seed >> (index * 3)) & 1 ? 'front' : 'back'));
  }

  function applyCoinResult(reading) {
    const faces = baguaFaceMap[reading.result_key] || generateCoinFaces(`${reading.id || ''}${reading.result_key || ''}`);
    const coins = coinSet.querySelectorAll('.coin');
    coins.forEach((coin, index) => {
      coin.dataset.face = faces[index];
    });

    const trigram = trigramMap[faces.join('-')] || trigramMap['front-front-front'];
    trigramSymbol.textContent = trigram.symbol;
    trigramName.textContent = trigram.name;
    trigramTone.textContent = trigram.tone;
    coinSet.className = 'coin-set is-settled';
  }

  function applyTarotResult(reading) {
    const selected = cardSet.querySelector('.tarot-card.is-selected');
    const visual = tarotVisuals[reading.result_key] || ['TODAY', '☾', '宇宙想嘴你'];
    if (selected) {
      selected.dataset.card = reading.result_key || 'today';
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
      wait(900).then(() => { cardSet.className = 'card-set is-cutting'; });
      wait(1500).then(() => { cardSet.className = 'card-set is-spreading'; });
      wait(2200).then(() => { cardSet.className = 'card-set is-drawing'; });
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

  function renderResult(data) {
    const reading = data.reading;
    const usageText = Number.isFinite(data.usage?.remainingToday) ? `｜今日剩餘 ${data.usage.remainingToday} 次` : '';
    resultMeta.textContent = `${reading.name}｜${reading.topic_label}｜${reading.method_label}${usageText}`;
    resultTitle.textContent = reading.result_title;
    resultKeywords.textContent = reading.result_keywords;
    resultText.textContent = reading.result_text;
    resultPanel.hidden = false;
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    lastReadingText = `我的占卜結果：${reading.result_title}\n${reading.result_keywords}\n${reading.result_text}`;
  }

  async function submitReading(event) {
    event.preventDefault();
    setStatus('');
    resultPanel.hidden = true;

    const payload = {
      name: String(new FormData(form).get('name') || '').trim(),
      topic: getSelected('topic'),
      method: getSelected('method')
    };

    if (!payload.name) {
      setStatus('請先輸入名字或暱稱。', true);
      return;
    }

    setBusy(true);
    startRitual(payload.method);
    setStatus(payload.method === 'tarot' ? '正在洗牌，請等牌面停下來。' : '正在擲銅錢，請等卦象落定。');

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
      renderResult(data);
      setStatus('占卜完成。');
    } catch (error) {
      resetRitual();
      setStatus(error.message || '占卜失敗，請稍後再試。', true);
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener('change', (event) => {
    if (event.target?.name === 'method') {
      setMethodVisual(event.target.value);
    }
  });

  form.addEventListener('submit', submitReading);

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
    resultPanel.hidden = true;
    setStatus('');
    resetRitual();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  setMethodVisual(getSelected('method'));
})();
