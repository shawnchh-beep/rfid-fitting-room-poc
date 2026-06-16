(function () {
  const form = document.querySelector('#fortuneForm');
  const submitButton = document.querySelector('#submitButton');
  const statusMessage = document.querySelector('#statusMessage');
  const ritualScene = document.querySelector('#ritualScene');
  const coinSet = document.querySelector('#coinSet');
  const cardSet = document.querySelector('#cardSet');
  const resultPanel = document.querySelector('#resultPanel');
  const resultMeta = document.querySelector('#resultMeta');
  const resultTitle = document.querySelector('#resultTitle');
  const resultKeywords = document.querySelector('#resultKeywords');
  const resultText = document.querySelector('#resultText');
  const copyButton = document.querySelector('#copyButton');
  const resetButton = document.querySelector('#resetButton');

  let lastReadingText = '';

  function getSelected(name) {
    return form.querySelector(`input[name="${name}"]:checked`)?.value;
  }

  function setStatus(message, isError) {
    statusMessage.textContent = message || '';
    statusMessage.classList.toggle('is-error', Boolean(isError));
  }

  function setMethodVisual(method) {
    const isTarot = method === 'tarot';
    coinSet.hidden = isTarot;
    cardSet.hidden = !isTarot;
  }

  function setBusy(isBusy) {
    submitButton.disabled = isBusy;
    submitButton.textContent = isBusy ? '占卜中...' : '開始占卜';
    ritualScene.classList.toggle('is-casting', isBusy);
  }

  function renderResult(data) {
    const reading = data.reading;
    resultMeta.textContent = `${reading.name}｜${reading.topic_label}｜${reading.method_label}｜今日剩餘 ${data.usage.remainingToday} 次`;
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
    setStatus(payload.method === 'tarot' ? '正在洗牌，請等牌面停下來。' : '正在擲銅錢，請等卦象落定。');

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const response = await fetch('/api/fortune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : null;

      if (!response.ok) {
        throw new Error(data?.error?.message || '占卜服務暫時不可用，請稍後再試。');
      }

      renderResult(data);
      setStatus('占卜完成。');
    } catch (error) {
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
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  setMethodVisual(getSelected('method'));
})();
