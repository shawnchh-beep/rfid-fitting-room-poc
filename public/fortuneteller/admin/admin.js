(function () {
  const form = document.querySelector('#adminLogin');
  const passwordInput = document.querySelector('#passwordInput');
  const status = document.querySelector('#adminStatus');
  const report = document.querySelector('#adminReport');

  function setStatus(message, isError) {
    status.textContent = message || '';
    status.classList.toggle('is-error', Boolean(isError));
  }

  function formatTime(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('zh-Hant', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  function renderBreakdown(targetId, items) {
    const total = items.reduce((sum, item) => sum + item.count, 0);
    const target = document.querySelector(targetId);
    target.innerHTML = items.map((item) => {
      const percent = total ? Math.round((item.count / total) * 100) : 0;
      return `
        <div class="bar-row">
          <span>${item.label}</span>
          <span class="bar-track"><span class="bar-fill" style="width: ${percent}%"></span></span>
          <span>${item.count}</span>
        </div>
      `;
    }).join('');
  }

  function renderTrend(items) {
    document.querySelector('#trendList').innerHTML = items.map((item) => `
      <div class="trend-item">
        <strong>${item.day.slice(5)}</strong>
        <span>占卜 ${item.total_readings} 次</span>
        <span>${item.unique_users} 人</span>
      </div>
    `).join('');
  }

  function renderRecent(items) {
    document.querySelector('#recentList').innerHTML = items.length ? items.map((item) => `
      <div class="recent-item">
        <span>${item.name}｜${item.topic_label}｜${item.method_label}｜${item.result_title}</span>
        <span>${formatTime(item.created_at)}</span>
      </div>
    `).join('') : '<p class="status-message">尚無紀錄。</p>';
  }

  function renderRecentShares(items) {
    document.querySelector('#recentShareList').innerHTML = items.length ? items.map((item) => `
      <div class="recent-item">
        <span>${item.platform}｜${item.action}</span>
        <span>${formatTime(item.created_at)}</span>
      </div>
    `).join('') : '<p class="status-message">尚無分享紀錄。</p>';
  }

  function renderReport(data) {
    document.querySelector('#todayTotal').textContent = data.today.total_readings;
    document.querySelector('#todayUsers').textContent = data.today.unique_users;
    document.querySelector('#todayShares').textContent = data.shares?.today_shares || 0;
    document.querySelector('#maxStreak').textContent = `${data.streaks?.max_current_streak || 0} 天`;
    document.querySelector('#timezone').textContent = data.timezone;
    document.querySelector('#generatedAt').textContent = formatTime(data.generated_at);
    renderBreakdown('#topicBreakdown', data.topics || []);
    renderBreakdown('#methodBreakdown', data.methods || []);
    renderBreakdown('#shareBreakdown', data.shares?.platforms || []);
    renderBreakdown('#referrerBreakdown', data.referrers || []);
    renderBreakdown('#streakBreakdown', data.streaks?.buckets || []);
    renderTrend(data.trend || []);
    renderRecentShares(data.recent_shares || []);
    renderRecent(data.recent || []);
    report.hidden = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('載入中...');
    report.hidden = true;

    try {
      const response = await fetch('/api/admin/usage', {
        headers: {
          'x-admin-password': passwordInput.value
        }
      });
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : null;

      if (!response.ok) {
        throw new Error(data?.error?.message || '報表服務暫時不可用');
      }

      renderReport(data);
      setStatus('報表已更新。');
    } catch (error) {
      setStatus(error.message || '載入失敗', true);
    }
  });
})();
