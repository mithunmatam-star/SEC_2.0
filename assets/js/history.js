/* ============================================================
   History: paginated session list, conversation / evaluation modal,
   continue active session, re-teach weak topic.
   ============================================================ */

(() => {
  const state = {
    sessions: [],
    total: 0,
    page: 1,
    perPage: 15,
    filter: 'all',
    currentId: null,
    activeTab: 'conversation',
    detailToken: 0,
  };

  const details = new Map();

  function filterValue() {
    const select = App.byId('history-filter');
    return select ? select.value : 'all';
  }

  function filteredSessions() {
    if (state.filter === 'all') return state.sessions;
    return state.sessions.filter((session) => session.status === state.filter);
  }

  async function loadHistory(page = 1) {
    state.page = page;
    const loading = App.byId('history-loading');
    const content = App.byId('history-content');
    const errorBox = App.byId('history-error');
    errorBox.hidden = true;
    App.clear(errorBox);
    loading.hidden = false;
    content.hidden = true;

    try {
      const data = await App.api('history.php?page=' + state.page + '&per_page=' + state.perPage);
      state.sessions = Array.isArray(data.sessions) ? data.sessions : [];
      state.total = Number(data.total) || state.sessions.length;
      state.filter = filterValue();
      renderList();
      renderPagination();
      loading.hidden = true;
      content.hidden = false;
    } catch (error) {
      loading.hidden = true;
      errorBox.hidden = false;
      errorBox.appendChild(App.emptyState({
        iconName: 'alert',
        title: 'We could not load your history',
        text: error.message,
        actionLabel: 'Try again',
        onAction: () => loadHistory(state.page),
      }));
    }
  }

  function renderPagination() {
    const bar = App.byId('history-pagination');
    const prevBtn = App.byId('page-prev');
    const nextBtn = App.byId('page-next');
    const pageInfo = App.byId('page-info');
    if (!bar || !prevBtn || !nextBtn || !pageInfo) return;

    const totalPages = Math.max(1, Math.ceil(state.total / state.perPage));
    if (totalPages <= 1) {
      bar.hidden = true;
      return;
    }

    bar.hidden = false;
    pageInfo.textContent = 'Page ' + state.page + ' of ' + totalPages + ' (' + state.total + ' total)';
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= totalPages;
  }

  function renderList() {
    const body = App.byId('history-body');
    const wrap = App.byId('history-table-wrap');
    const empty = App.byId('history-empty');
    const count = App.byId('history-count');
    if (!body || !wrap || !empty || !count) return;

    const sessions = filteredSessions();
    App.clear(body);
    App.clear(empty);

    count.textContent = state.total === 0
      ? 'No sessions yet'
      : (state.filter === 'all'
        ? state.total + ' session' + (state.total === 1 ? '' : 's')
        : sessions.length + ' of ' + state.total + ' sessions');

    if (!sessions.length) {
      wrap.hidden = true;
      empty.hidden = false;

      if (!state.sessions.length) {
        empty.appendChild(App.emptyState({
          iconName: 'chat',
          title: 'Your history is empty',
          text: 'Start a teaching session and your conversation and evaluation will be saved here.',
          actionLabel: 'Start teaching',
          onAction: () => { window.location.href = 'teach.html'; },
        }));
      } else {
        empty.appendChild(App.emptyState({
          iconName: 'inbox',
          title: 'No ' + state.filter + ' sessions',
          text: 'Try a different filter to see the rest of your history.',
          actionLabel: 'Show all sessions',
          onAction: () => {
            const select = App.byId('history-filter');
            if (select) select.value = 'all';
            state.filter = 'all';
            renderList();
          },
        }));
      }
      return;
    }

    wrap.hidden = false;
    empty.hidden = true;

    sessions.forEach((session) => {
      const row = document.createElement('tr');

      const topicCell = document.createElement('td');
      topicCell.appendChild(App.el('span', 'cell-title', session.topic_name));
      topicCell.appendChild(App.el(
        'span',
        'cell-sub',
        session.subject + (session.previous_session_id ? ' · Re-teach' : '')
      ));
      row.appendChild(topicCell);

      const personaCell = document.createElement('td');
      personaCell.appendChild(App.el('span', 'badge badge-persona', App.personaLabel(session.persona)));
      row.appendChild(personaCell);

      const dateCell = document.createElement('td');
      dateCell.appendChild(App.el('span', '', App.formatDate(session.started_at)));
      dateCell.appendChild(App.el('span', 'cell-sub', App.formatTime(session.started_at)));
      row.appendChild(dateCell);

      const statusCell = document.createElement('td');
      statusCell.appendChild(App.statusBadge(session.status));
      row.appendChild(statusCell);

      const scoreCell = document.createElement('td');
      scoreCell.appendChild(App.scoreBadge(session.overall_score));
      row.appendChild(scoreCell);

      const actionsCell = document.createElement('td');
      const actions = App.el('div', 'table-actions');

      const conversationBtn = App.el('button', 'btn btn-outline btn-sm', 'View conversation');
      conversationBtn.type = 'button';
      conversationBtn.addEventListener('click', () => openDetail(session.session_id, 'conversation'));
      actions.appendChild(conversationBtn);

      if (session.overall_score !== null) {
        const evaluationBtn = App.el('button', 'btn btn-outline btn-sm', 'View evaluation');
        evaluationBtn.type = 'button';
        evaluationBtn.addEventListener('click', () => openDetail(session.session_id, 'evaluation'));
        actions.appendChild(evaluationBtn);
      }

      if (session.status === 'active') {
        const resume = App.el('a', 'btn btn-primary btn-sm', 'Continue');
        resume.href = 'teach.html?session_id=' + encodeURIComponent(String(session.session_id));
        actions.appendChild(resume);
      }

      if (session.status === 'completed' && session.overall_score !== null && Number(session.overall_score) < 6) {
        const reteach = App.el('a', 'btn btn-outline btn-sm', 'Re-teach');
        reteach.href = 'teach.html?reteach=' + encodeURIComponent(String(session.session_id));
        actions.appendChild(reteach);
      }

      actionsCell.appendChild(actions);
      row.appendChild(actionsCell);
      body.appendChild(row);
    });
  }

  function setTab(tab) {
    state.activeTab = tab;
    const conversationTab = App.byId('tab-conversation');
    const evaluationTab = App.byId('tab-evaluation');
    const conversationPanel = App.byId('conversation-panel');
    const evaluationPanel = App.byId('evaluation-panel');

    const isConversation = tab === 'conversation';
    if (conversationTab) {
      conversationTab.classList.toggle('tab-active', isConversation);
      conversationTab.setAttribute('aria-selected', isConversation ? 'true' : 'false');
    }
    if (evaluationTab) {
      evaluationTab.classList.toggle('tab-active', !isConversation);
      evaluationTab.setAttribute('aria-selected', isConversation ? 'false' : 'true');
    }
    if (conversationPanel) conversationPanel.hidden = !isConversation;
    if (evaluationPanel) evaluationPanel.hidden = isConversation;
  }

  function showModalLoading() {
    App.byId('modal-loading').hidden = false;
    App.byId('modal-error').hidden = true;
    App.byId('modal-content').hidden = true;
    App.clear(App.byId('modal-error'));
  }

  function openDetail(sessionId, tab) {
    const summary = state.sessions.find((session) => session.session_id === Number(sessionId));
    state.detailToken += 1;
    state.currentId = Number(sessionId);
    state.activeTab = tab || 'conversation';

    App.byId('modal-title').textContent = summary ? summary.topic_name : 'Session';
    App.byId('modal-subtitle').textContent = summary
      ? summary.subject + ' · ' + App.personaLabel(summary.persona) + ' · ' + App.formatDate(summary.started_at)
      : '';

    setTab(state.activeTab);
    const modal = App.byId('history-modal');
    App.openModal(modal);

    if (details.has(state.currentId)) {
      displayDetail(details.get(state.currentId));
      return;
    }

    showModalLoading();
    fetchDetail(state.currentId);
  }

  async function fetchDetail(sessionId) {
    const token = ++state.detailToken;
    try {
      const data = await App.api('history.php?session_id=' + encodeURIComponent(String(sessionId)));
      if (token !== state.detailToken) return;
      details.set(Number(sessionId), data);
      displayDetail(data);
    } catch (error) {
      if (token !== state.detailToken) return;
      App.byId('modal-loading').hidden = true;
      App.byId('modal-content').hidden = true;
      const errorBox = App.byId('modal-error');
      errorBox.hidden = false;
      App.clear(errorBox);
      errorBox.appendChild(App.emptyState({
        iconName: 'alert',
        title: 'Could not load this session',
        text: error.message,
        actionLabel: 'Try again',
        onAction: () => {
          showModalLoading();
          fetchDetail(sessionId);
        },
      }));
    }
  }

  function displayDetail(data) {
    App.byId('modal-loading').hidden = true;
    App.byId('modal-error').hidden = true;
    App.byId('modal-content').hidden = false;

    const session = data.session;
    const conversationPanel = App.byId('modal-conversation');
    App.clear(conversationPanel);

    if (!data.messages || !data.messages.length) {
      conversationPanel.appendChild(App.emptyState({
        iconName: 'chat',
        title: 'No messages in this session',
        text: 'The conversation was either not started or no messages were sent.',
      }));
    } else {
      data.messages.forEach((msg) => {
        const isUser = msg.sender === 'user';
        const wrap = App.el('div', 'message ' + (isUser ? 'message-user' : 'message-ai'));
        const label = App.el(
          'span',
          'message-label',
          isUser ? 'You (teacher)' : App.personaLabel(session.persona) + ' · AI student'
        );
        const bubble = App.el('div', 'message-bubble', msg.content);
        const time = App.el('span', 'message-time', App.formatTime(msg.sent_at));
        wrap.append(label, bubble, time);
        conversationPanel.appendChild(wrap);
      });
    }

    const evaluationPanel = App.byId('evaluation-panel');
    App.clear(evaluationPanel);

    if (!data.evaluation) {
      evaluationPanel.appendChild(App.emptyState({
        iconName: 'spark',
        title: session.status === 'active' ? 'Session is still active' : 'No evaluation attached',
        text: session.status === 'active'
          ? 'Continue this teaching session and click End & evaluate to generate the report.'
          : 'This session has ended without an evaluation.',
      }));
    } else {
      renderModalEvaluation(evaluationPanel, data.evaluation, data.comparison, session);
    }

    // Modal action button
    const actionBtn = App.byId('modal-action');
    if (session.status === 'active') {
      actionBtn.hidden = false;
      actionBtn.className = 'btn btn-primary';
      actionBtn.textContent = 'Continue session';
      actionBtn.href = 'teach.html?session_id=' + encodeURIComponent(String(session.session_id));
    } else if (session.overall_score !== null && Number(session.overall_score) < 6) {
      actionBtn.hidden = false;
      actionBtn.className = 'btn btn-outline';
      actionBtn.textContent = 'Re-teach this topic';
      actionBtn.href = 'teach.html?reteach=' + encodeURIComponent(String(session.session_id));
    } else {
      actionBtn.hidden = true;
    }
  }

  function renderModalEvaluation(root, evaluation, comparison, session) {
    const overall = Number(evaluation.overall_score);
    const verdict = App.verdict(overall);

    const head = App.el('div', 'modal-eval-head');
    head.style.display = 'flex';
    head.style.alignItems = 'center';
    head.style.gap = '1.2rem';
    head.style.marginBottom = '1.2rem';

    const scoreBadge = App.el('div', 'score-badge-lg ' + App.scoreClass(overall));
    scoreBadge.style.fontSize = '1.4rem';
    scoreBadge.style.fontWeight = '800';
    scoreBadge.textContent = App.scoreText(overall) + ' / 10';
    head.appendChild(scoreBadge);

    const summaryBox = App.el('div');
    summaryBox.appendChild(App.el('span', 'score-verdict ' + verdict.className, verdict.label));
    summaryBox.appendChild(App.el('p', 'mt-1 mb-0', evaluation.summary || ''));
    head.appendChild(summaryBox);
    root.appendChild(head);

    // Criteria breakdown
    const grid = App.el('div', 'criteria-grid');
    const criteria = [
      { key: 'accuracy', label: 'Accuracy' },
      { key: 'clarity', label: 'Clarity' },
      { key: 'completeness', label: 'Completeness' },
      { key: 'examples', label: 'Examples' },
    ];
    criteria.forEach((c) => {
      const s = Number(evaluation[c.key]);
      const card = App.el('article', 'criterion');
      const top = App.el('div', 'criterion-top');
      top.appendChild(App.el('span', '', c.label));
      top.appendChild(App.el('strong', '', App.scoreText(s) + ' / 10'));
      card.appendChild(top);

      const bar = App.el('div', 'criterion-bar');
      const fill = App.el('div', 'criterion-fill ' + (s >= 7 ? 'fill-high' : s >= 5 ? 'fill-mid' : 'fill-low'));
      fill.style.width = Math.max(0, Math.min(100, s * 10)) + '%';
      bar.appendChild(fill);
      card.appendChild(bar);
      grid.appendChild(card);
    });
    root.appendChild(grid);

    // Feedback lists
    const listsGrid = App.el('div', 'report-grid mt-3');
    listsGrid.appendChild(makeListCard('Knowledge gaps', evaluation.gaps, 'list-warn', 'alert'));
    listsGrid.appendChild(makeListCard('Misconceptions', evaluation.misconceptions, 'list-danger', 'target'));
    listsGrid.appendChild(makeListCard('Missing concepts', evaluation.missing_concepts, 'list-warn', 'book'));
    listsGrid.appendChild(makeListCard('Suggestions', evaluation.suggestions, 'list-good', 'spark'));
    root.appendChild(listsGrid);
  }

  function makeListCard(title, items, variant, iconName) {
    const card = App.el('article', 'card report-list ' + variant);
    const heading = App.el('h3');
    heading.appendChild(App.icon(iconName, 17));
    heading.appendChild(document.createTextNode(' ' + title));
    card.appendChild(heading);

    if (Array.isArray(items) && items.length) {
      const ul = document.createElement('ul');
      items.forEach((item) => ul.appendChild(App.el('li', '', item)));
      card.appendChild(ul);
    } else {
      card.appendChild(App.el('p', 'small muted mb-0', 'None recorded.'));
    }
    return card;
  }

  function bindEvents() {
    const filterSelect = App.byId('history-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', () => {
        state.filter = filterSelect.value;
        renderList();
      });
    }

    const prevBtn = App.byId('page-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (state.page > 1) loadHistory(state.page - 1);
      });
    }

    const nextBtn = App.byId('page-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(state.total / state.perPage);
        if (state.page < totalPages) loadHistory(state.page + 1);
      });
    }

    const tabConvo = App.byId('tab-conversation');
    if (tabConvo) tabConvo.addEventListener('click', () => setTab('conversation'));

    const tabEval = App.byId('tab-evaluation');
    if (tabEval) tabEval.addEventListener('click', () => setTab('evaluation'));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await App.init({ requireAuth: true });
    if (!user) return;
    bindEvents();
    await loadHistory(1);
  });
})();
