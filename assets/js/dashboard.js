/* ============================================================
   Dashboard: welcome greeting, stat cards,
   Chart.js visuals (trend, topic averages, strong vs weak),
   strongest/weakest topics, recent sessions, and recurring gaps.
   ============================================================ */

(() => {
  let dashboard = null;
  const charts = [];

  const COLORS = {
    purple: '#8b5cf6',
    purpleDeep: '#6d28d9',
    green: '#34d399',
    amber: '#fbbf24',
    red: '#f87171',
    text: '#c7cdea',
    grid: 'rgba(255, 255, 255, 0.08)',
  };

  function initChartDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = COLORS.text;
    Chart.defaults.borderColor = COLORS.grid;
    Chart.defaults.font.family = '"Inter", system-ui, sans-serif';
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.padding = 14;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10,16,36,0.96)';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.14)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.titleColor = '#eef1ff';
    Chart.defaults.plugins.tooltip.bodyColor = '#c7cdea';
    Chart.defaults.plugins.tooltip.cornerRadius = 10;
  }

  function destroyCharts() {
    while (charts.length) {
      const chart = charts.pop();
      try {
        chart.destroy();
      } catch (error) {
        /* ignore */
      }
    }
  }

  async function load() {
    const loading = App.byId('dash-loading');
    const content = App.byId('dash-content');
    const errorBox = App.byId('dash-error');
    errorBox.hidden = true;
    App.clear(errorBox);
    loading.hidden = false;
    content.hidden = true;

    try {
      dashboard = await App.api('dashboard.php');
      render(dashboard);
      loading.hidden = true;
      content.hidden = false;
    } catch (error) {
      loading.hidden = true;
      errorBox.hidden = false;
      const retry = App.emptyState({
        iconName: 'alert',
        title: 'We could not load your dashboard',
        text: error.message,
        actionLabel: 'Try again',
        onAction: load,
      });
      errorBox.appendChild(retry);
    }
  }

  function render(data) {
    if (data.user_name) {
      document.querySelectorAll('[data-user-name]').forEach((node) => {
        node.textContent = data.user_name;
      });
    }

    App.byId('stat-total').textContent = String(data.total_sessions ?? 0);
    App.byId('stat-average').textContent = (data.average_score === null || data.average_score === undefined)
      ? '—'
      : App.scoreText(data.average_score);
    App.byId('stat-completed').textContent = String(data.completed_sessions ?? 0);
    App.byId('stat-gaps').textContent = String(Array.isArray(data.recurring_gaps) ? data.recurring_gaps.length : 0);

    destroyCharts();
    renderTrend(data.score_trend || []);
    renderTopicChart(data.topic_averages || []);
    renderStrengthChart(data.strong_vs_weak || { strong: 0, middle: 0, weak: 0 });
    renderTopicList('strongest-list', 'strongest-empty', data.strongest_topics || [], {
      iconName: 'trophy',
      title: 'No strong topics yet',
      text: 'Topics that average 7.0 or higher will show up here after an evaluation.',
    });
    renderTopicList('weakest-list', 'weakest-empty', data.weakest_topics || [], {
      iconName: 'target',
      title: 'No weak topics',
      text: 'Nothing is averaging below 6.0 yet. Keep teaching to confirm the pattern.',
    });
    renderRecent(data.recent_sessions || []);
    renderGaps(data.recurring_gaps || []);
  }

  function chartsUnavailable() {
    return typeof Chart === 'undefined';
  }

  function showChartEmpty(wrapId, emptyId, message) {
    const wrap = App.byId(wrapId);
    const empty = App.byId(emptyId);
    if (!wrap || !empty) return;
    wrap.hidden = true;
    empty.hidden = false;
    App.clear(empty);
    empty.appendChild(App.emptyState({
      iconName: chartsUnavailable() ? 'alert' : 'chart',
      title: chartsUnavailable() ? 'Charts could not load' : 'Not enough data yet',
      text: message,
    }));
  }

  function renderTrend(trendData) {
    let labels = [];
    let scores = [];
    let topics = [];

    if (Array.isArray(trendData)) {
      labels = trendData.map((item) => item.date);
      scores = trendData.map((item) => Number(item.overall_score));
      topics = trendData.map((item) => item.topic_name);
    } else if (trendData && typeof trendData === 'object') {
      labels = Array.isArray(trendData.labels) ? trendData.labels : [];
      scores = Array.isArray(trendData.scores) ? trendData.scores : [];
      topics = Array.isArray(trendData.topics) ? trendData.topics : [];
    }

    if (!scores.length || chartsUnavailable()) {
      showChartEmpty(
        'trend-wrap',
        'trend-empty',
        chartsUnavailable()
          ? 'Chart.js could not be loaded from the CDN. Check your internet connection and refresh.'
          : 'Finish and evaluate a teaching session and your score trend will appear here.'
      );
      return;
    }

    const canvas = App.byId('trend-chart');
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.42)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.02)');

    charts.push(new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Overall score',
          data: scores,
          borderColor: COLORS.purple,
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: COLORS.purpleDeep,
          pointBorderColor: '#ddd6fe',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => ' Score: ' + item.parsed.y + ' / 10',
              afterLabel: (item) => (topics[item.dataIndex] ? 'Topic: ' + topics[item.dataIndex] : ''),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7 },
          },
          y: {
            min: 0,
            max: 10,
            ticks: { stepSize: 2 },
            grid: { color: COLORS.grid },
          },
        },
      },
    }));
  }

  function renderTopicChart(topics) {
    const shown = topics.slice(0, 8);
    if (!shown.length || chartsUnavailable()) {
      showChartEmpty(
        'topic-wrap',
        'topic-empty',
        chartsUnavailable()
          ? 'Chart.js could not be loaded from the CDN. Check your internet connection and refresh.'
          : 'Evaluate a session to see how your average score compares across topics.'
      );
      return;
    }

    const canvas = App.byId('topic-chart');
    if (!canvas) return;
    const shortLabels = shown.map((topic) => (
      topic.topic_name.length > 18 ? topic.topic_name.slice(0, 17) + '…' : topic.topic_name
    ));
    const scores = shown.map((topic) => Number(topic.avg_score ?? topic.average_score ?? 0));
    const colors = scores.map((score) => {
      if (score >= 7) return 'rgba(52, 211, 153, 0.75)';
      if (score >= 6) return 'rgba(251, 191, 36, 0.75)';
      return 'rgba(248, 113, 113, 0.75)';
    });

    charts.push(new Chart(canvas, {
      type: 'bar',
      data: {
        labels: shortLabels,
        datasets: [{
          label: 'Average score',
          data: scores,
          backgroundColor: colors,
          hoverBackgroundColor: scores.map((score) => {
            if (score >= 7) return '#34d399';
            if (score >= 6) return '#fbbf24';
            return '#f87171';
          }),
          borderRadius: 7,
          maxBarThickness: 34,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const index = items[0] ? items[0].dataIndex : 0;
                const topic = shown[index];
                return topic ? topic.subject + ' — ' + topic.topic_name : '';
              },
              label: (item) => ' Average: ' + item.parsed.y + ' / 10',
              afterLabel: (item) => {
                const topic = shown[item.dataIndex];
                return topic ? 'Sessions: ' + topic.session_count : '';
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 25 },
          },
          y: {
            min: 0,
            max: 10,
            ticks: { stepSize: 2 },
            grid: { color: COLORS.grid },
          },
        },
      },
    }));
  }

  function renderStrengthChart(strengthData) {
    let strong = 0;
    let middle = 0;
    let weak = 0;

    if (strengthData && typeof strengthData === 'object' && !Array.isArray(strengthData)) {
      strong = Number(strengthData.strong || 0);
      middle = Number(strengthData.middle || 0);
      weak = Number(strengthData.weak || 0);
    } else if (Array.isArray(strengthData)) {
      strong = strengthData.filter((t) => (t.avg_score ?? t.average_score) >= 7).length;
      middle = strengthData.filter((t) => (t.avg_score ?? t.average_score) >= 6 && (t.avg_score ?? t.average_score) < 7).length;
      weak = strengthData.filter((t) => (t.avg_score ?? t.average_score) < 6).length;
    }

    const total = strong + middle + weak;
    if (total === 0 || chartsUnavailable()) {
      showChartEmpty(
        'strength-wrap',
        'strength-empty',
        chartsUnavailable()
          ? 'Chart.js could not be loaded from the CDN. Check your internet connection and refresh.'
          : 'Topic strengths appear once you have at least one evaluated session.'
      );
      return;
    }

    const canvas = App.byId('strength-chart');
    if (!canvas) return;

    charts.push(new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Strong (≥ 7)', 'On track (6–6.9)', 'Needs work (< 6)'],
        datasets: [{
          data: [strong, middle, weak],
          backgroundColor: [
            'rgba(52, 211, 153, 0.85)',
            'rgba(251, 191, 36, 0.85)',
            'rgba(248, 113, 113, 0.85)',
          ],
          borderColor: 'rgba(10, 16, 36, 0.9)',
          borderWidth: 3,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: { position: 'bottom' },
        },
      },
    }));
  }

  function renderTopicList(listId, emptyId, topics, emptyConfig) {
    const list = App.byId(listId);
    const empty = App.byId(emptyId);
    if (!list || !empty) return;
    App.clear(list);
    App.clear(empty);

    if (!topics.length) {
      list.hidden = true;
      empty.hidden = false;
      empty.appendChild(App.emptyState(emptyConfig));
      return;
    }

    list.hidden = false;
    empty.hidden = true;

    topics.forEach((topic) => {
      const score = Number(topic.avg_score ?? topic.average_score ?? 0);
      const item = App.el('div', 'topic-item');

      const info = App.el('div', 'topic-info');
      info.appendChild(App.el('span', 'topic-name', topic.topic_name));
      info.appendChild(App.el(
        'span',
        'topic-meta',
        topic.subject + ' · ' + topic.session_count + ' session' + (topic.session_count === 1 ? '' : 's')
      ));
      item.appendChild(info);

      const scoreWrap = App.el('div', 'topic-score');
      scoreWrap.appendChild(App.scoreBadge(score));
      item.appendChild(scoreWrap);

      list.appendChild(item);
    });
  }

  function renderRecent(sessions) {
    const body = App.byId('recent-body');
    const wrap = App.byId('recent-table-wrap');
    const empty = App.byId('recent-empty');
    if (!body || !wrap || !empty) return;

    App.clear(body);
    App.clear(empty);

    if (!sessions.length) {
      wrap.hidden = true;
      empty.hidden = false;
      empty.appendChild(App.emptyState({
        iconName: 'chat',
        title: 'No sessions yet',
        text: 'Your recent teaching conversations and evaluations will appear here.',
        actionLabel: 'Start your first session',
        onAction: () => { window.location.href = 'teach.html'; },
      }));
      return;
    }

    empty.hidden = true;
    wrap.hidden = false;

    sessions.forEach((session) => {
      const row = document.createElement('tr');

      const topicCell = document.createElement('td');
      topicCell.appendChild(App.el('span', 'cell-title', session.topic_name));
      topicCell.appendChild(App.el('span', 'cell-sub', session.subject));
      row.appendChild(topicCell);

      const personaCell = document.createElement('td');
      personaCell.appendChild(App.el('span', 'badge badge-persona', App.personaLabel(session.persona)));
      row.appendChild(personaCell);

      const dateCell = document.createElement('td');
      dateCell.textContent = App.formatDate(session.started_at);
      row.appendChild(dateCell);

      const statusCell = document.createElement('td');
      statusCell.appendChild(App.statusBadge(session.status));
      row.appendChild(statusCell);

      const scoreCell = document.createElement('td');
      scoreCell.appendChild(App.scoreBadge(session.overall_score));
      row.appendChild(scoreCell);

      const actionCell = document.createElement('td');
      const link = App.el('a', 'btn btn-outline btn-sm', 'Open');
      link.href = 'teach.html?session_id=' + encodeURIComponent(String(session.session_id));
      actionCell.appendChild(link);
      row.appendChild(actionCell);

      body.appendChild(row);
    });
  }

  function renderGaps(gaps) {
    const list = App.byId('gaps-list');
    const empty = App.byId('gaps-empty');
    if (!list || !empty) return;

    App.clear(list);
    App.clear(empty);

    if (!gaps.length) {
      list.hidden = true;
      empty.hidden = false;
      empty.appendChild(App.emptyState({
        iconName: 'check',
        title: 'No recurring gaps yet',
        text: 'When the same gap shows up in two or more sessions, it will be highlighted here.',
      }));
      return;
    }

    list.hidden = false;
    empty.hidden = true;

    gaps.forEach((gap) => {
      const item = App.el('div', 'gap-item');
      item.style.display = 'flex';
      item.style.alignItems = 'flex-start';
      item.style.gap = '0.75rem';
      item.style.padding = '0.75rem 0';
      item.style.borderBottom = '1px solid var(--line)';

      const iconWrap = App.el('div', 'gap-icon');
      iconWrap.style.color = 'var(--amber)';
      iconWrap.appendChild(App.icon('alert', 18));
      item.appendChild(iconWrap);

      const body = App.el('div', 'gap-body');
      const tagCapitalized = gap.gap_tag.charAt(0).toUpperCase() + gap.gap_tag.slice(1);
      const headline = App.el('div', '', tagCapitalized + ' missed in ' + gap.times_repeated + ' sessions');
      headline.style.fontWeight = '600';
      headline.style.fontSize = '0.9rem';

      const topicText = App.el('div', 'small muted', 'Topic: ' + gap.topic_name);
      body.appendChild(headline);
      body.appendChild(topicText);
      item.appendChild(body);

      list.appendChild(item);
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await App.init({ requireAuth: true });
    if (!user) return;
    initChartDefaults();
    await load();
  });
})();
