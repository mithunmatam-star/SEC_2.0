/* ============================================================
   Teach page state machine: setup → chat → evaluation report.
   Supports ?reteach=<session_id> (prefill a new attempt) and
   ?session_id=<session_id> (resume an active session / open a report).
   ============================================================ */

(() => {
  const state = {
    sessionId: null,
    subject: '',
    topicName: '',
    persona: 'beginner',
    previousSessionId: null,
    teacherMessages: 0,
    busy: false,
    ending: false,
    starting: false,
    status: 'setup',
  };

  let els = {};

  const CRITERIA = [
    { key: 'accuracy', label: 'Accuracy' },
    { key: 'clarity', label: 'Clarity' },
    { key: 'completeness', label: 'Completeness' },
    { key: 'examples', label: 'Examples' },
  ];

  /* ---------- Element cache ---------- */
  function cacheElements() {
    els = {
      setupView: App.byId('setup-view'),
      chatView: App.byId('chat-view'),
      reportView: App.byId('report-view'),
      setupForm: App.byId('setup-form'),
      setupSubmit: App.byId('setup-submit'),
      setupError: App.byId('setup-error'),
      subject: App.byId('setup-subject'),
      topic: App.byId('setup-topic'),
      subjectError: App.byId('setup-subject-error'),
      topicError: App.byId('setup-topic-error'),
      reteachBanner: App.byId('reteach-banner'),
      reteachText: App.byId('reteach-text'),
      chatTopicTitle: App.byId('chat-topic-title'),
      chatPersonaBadge: App.byId('chat-persona-badge'),
      chatSubject: App.byId('chat-subject'),
      chatStatusLabel: App.byId('chat-status-label'),
      chatMessages: App.byId('chat-messages'),
      chatForm: App.byId('chat-form'),
      chatInput: App.byId('chat-input'),
      chatError: App.byId('chat-error'),
      sendBtn: App.byId('send-btn'),
      charCount: App.byId('char-count'),
      typingRow: App.byId('typing-row'),
      typingLabel: App.byId('typing-label'),
      endSession: App.byId('end-session'),
      evalOverlay: App.byId('eval-overlay'),
      reportRoot: App.byId('report-root'),
      reportSubtitle: App.byId('report-subtitle'),
      endModal: App.byId('end-modal'),
      endModalText: App.byId('end-modal-text'),
      continueSession: App.byId('continue-session'),
      discardSession: App.byId('discard-session'),
    };
  }

  /* ---------- Views ---------- */
  function setView(name) {
    els.setupView.hidden = name !== 'setup';
    els.chatView.hidden = name !== 'chat';
    els.reportView.hidden = name !== 'report';
    state.status = name;
    if (name === 'chat') window.setTimeout(scrollMessages, 40);
    if (name === 'report') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setUrlSession(sessionId) {
    const url = sessionId
      ? 'teach.html?session_id=' + encodeURIComponent(String(sessionId))
      : 'teach.html';
    try {
      window.history.replaceState({}, '', url);
    } catch (error) {
      /* replaceState can fail in restricted environments — harmless */
    }
  }

  /* ---------- Setup form ---------- */
  function readPersona() {
    const checked = document.querySelector('input[name="persona"]:checked');
    return checked ? checked.value : 'beginner';
  }

  function setPersona(persona) {
    const input = document.querySelector('input[name="persona"][value="' + persona + '"]');
    if (input) input.checked = true;
  }

  function setSubmitLabel(label) {
    const span = App.byId('setup-submit-label');
    if (span) span.textContent = label;
  }

  function clearSetupErrors() {
    App.hideNotice(els.setupError);
    els.subject.classList.remove('invalid');
    els.topic.classList.remove('invalid');
    if (els.subjectError) els.subjectError.textContent = '';
    if (els.topicError) els.topicError.textContent = '';
  }

  function validateSetup() {
    let valid = true;
    const subject = els.subject.value.trim();
    const topic = els.topic.value.trim();

    if (subject.length < 1) {
      els.subject.classList.add('invalid');
      if (els.subjectError) els.subjectError.textContent = 'Enter a subject.';
      valid = false;
    }
    if (topic.length < 1) {
      els.topic.classList.add('invalid');
      if (els.topicError) els.topicError.textContent = 'Enter a topic.';
      valid = false;
    }
    return valid;
  }

  const SLOW_AI_MESSAGE = 'The AI is taking longer than usual. Please try again in a moment.';

  function friendlyAiMessage(error) {
    const message = error && error.message ? String(error.message) : '';
    if ((error && error.status === 504) || /took too long|taking longer/i.test(message)) {
      return SLOW_AI_MESSAGE;
    }
    return message || 'Something went wrong. Please try again.';
  }

  async function startSession(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (state.starting) return;
    clearSetupErrors();
    if (!validateSetup()) return;

    const subject = els.subject.value.trim();
    const topic = els.topic.value.trim();
    const persona = readPersona();

    state.starting = true;
    App.setButtonLoading(els.setupSubmit, true, state.previousSessionId ? 'Starting re-teach…' : 'Starting session…');

    try {
      const body = { subject, topic, persona };
      if (state.previousSessionId) body.previous_session_id = state.previousSessionId;

      const data = await App.api('start_session.php', { method: 'POST', body });

      state.sessionId = data.session_id;
      state.subject = data.subject;
      state.topicName = data.topic;
      state.persona = data.persona;
      state.previousSessionId = data.previous_session_id || null;
      state.teacherMessages = 0;

      els.chatMessages.replaceChildren();
      prepareChatShell();
      appendMessage('ai', data.opening_message.content, data.opening_message.sent_at);
      els.chatInput.value = '';
      resizeInput();
      updateCounter();
      setView('chat');
      setUrlSession(state.sessionId);
      els.chatInput.focus();
    } catch (error) {
      App.showNotice(els.setupError, friendlyAiMessage(error), 'error');
      const retryBtn = App.el('button', 'btn btn-outline btn-sm', 'Retry');
      retryBtn.type = 'button';
      retryBtn.style.marginLeft = '0.75rem';
      retryBtn.addEventListener('click', () => startSession());
      els.setupError.appendChild(retryBtn);
    } finally {
      state.starting = false;
      App.setButtonLoading(els.setupSubmit, false);
      setSubmitLabel(state.previousSessionId ? 'Start re-teach session' : 'Start teaching session');
      if (state.status === 'setup') els.setupSubmit.disabled = false;
    }
  }

  /* ---------- Chat ---------- */
  function prepareChatShell() {
    els.chatTopicTitle.textContent = state.topicName;
    els.chatSubject.textContent = state.subject;
    els.chatPersonaBadge.textContent = App.personaLabel(state.persona);
    els.chatStatusLabel.textContent = 'Active session';
    els.endSession.disabled = false;
    els.chatInput.disabled = false;
    els.sendBtn.disabled = false;
    els.evalOverlay.hidden = true;
    els.typingRow.hidden = true;
    App.hideNotice(els.chatError);
    updateCounter();
  }

  function appendMessage(sender, content, sentAt) {
    const isUser = sender === 'user';
    const wrap = App.el('div', 'message ' + (isUser ? 'message-user' : 'message-ai'));

    const label = App.el(
      'span',
      'message-label',
      isUser ? 'You (teacher)' : App.personaLabel(state.persona) + ' · AI student'
    );
    const bubble = App.el('div', 'message-bubble', content);
    const time = App.el('span', 'message-time', sentAt ? App.formatTime(sentAt) : 'just now');

    wrap.append(label, bubble, time);
    els.chatMessages.appendChild(wrap);
    scrollMessages();
    return { wrap, bubble, time };
  }

  function scrollMessages() {
    if (!els.chatMessages) return;
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }

  function resizeInput() {
    if (!els.chatInput) return;
    els.chatInput.style.height = 'auto';
    els.chatInput.style.height = Math.min(els.chatInput.scrollHeight || 48, 170) + 'px';
  }

  function updateCounter() {
    if (!els.charCount || !els.chatInput) return;
    els.charCount.textContent = els.chatInput.value.length + ' / 2000';
  }

  function showChatErrorWithRetry(message) {
    App.clear(els.chatError);
    els.chatError.hidden = false;

    const textSpan = App.el('span', '', message);
    const retryBtn = App.el('button', 'btn btn-outline btn-sm', 'Retry');
    retryBtn.type = 'button';
    retryBtn.style.marginLeft = '0.75rem';
    retryBtn.addEventListener('click', retryLastMessage);

    els.chatError.append(textSpan, retryBtn);
    scrollMessages();
  }

  async function retryLastMessage() {
    if (state.busy || state.ending || !state.sessionId) return;
    App.hideNotice(els.chatError);
    state.busy = true;
    els.sendBtn.disabled = true;
    els.endSession.disabled = true;
    els.typingLabel.textContent = App.personaLabel(state.persona) + ' is thinking…';
    els.typingRow.hidden = false;
    scrollMessages();

    try {
      const data = await App.api('chat.php', {
        method: 'POST',
        body: { session_id: state.sessionId, retry: true },
      });
      state.teacherMessages = data.student_message_count;
      appendMessage('ai', data.reply.content, data.reply.sent_at);
      App.hideNotice(els.chatError);
    } catch (error) {
      showChatErrorWithRetry(friendlyAiMessage(error));
    } finally {
      state.busy = false;
      els.typingRow.hidden = true;
      els.sendBtn.disabled = state.ending;
      els.endSession.disabled = state.ending;
      els.chatInput.focus();
    }
  }

  async function sendMessage(event) {
    if (event) event.preventDefault();
    if (state.busy || state.ending || !state.sessionId) return;

    const text = els.chatInput.value.trim();
    if (!text) {
      els.chatInput.focus();
      return;
    }

    App.hideNotice(els.chatError);
    state.busy = true;
    els.sendBtn.disabled = true;
    els.endSession.disabled = true;
    els.chatInput.value = '';
    resizeInput();
    updateCounter();

    const optimistic = appendMessage('user', text, null);
    els.typingLabel.textContent = App.personaLabel(state.persona) + ' is thinking…';
    els.typingRow.hidden = false;
    scrollMessages();

    try {
      const data = await App.api('chat.php', {
        method: 'POST',
        body: { session_id: state.sessionId, message: text },
      });
      optimistic.time.textContent = App.formatTime(data.reply.sent_at);
      state.teacherMessages = data.student_message_count;
      appendMessage('ai', data.reply.content, data.reply.sent_at);
    } catch (error) {
      // User message stays saved in DB and shown in UI; show error with retry button
      showChatErrorWithRetry(friendlyAiMessage(error));
    } finally {
      state.busy = false;
      els.typingRow.hidden = true;
      els.sendBtn.disabled = state.ending;
      els.endSession.disabled = state.ending;
      els.chatInput.focus();
    }
  }

  /* ---------- Ending ---------- */
  function openEndModal() {
    const count = state.teacherMessages;
    els.endModalText.textContent =
      'You have sent ' + count + ' teaching message' + (count === 1 ? '' : 's') +
      ' so far. A useful evaluation needs at least 3 so the evaluator has enough evidence. ' +
      'Keep teaching, or discard this session and start fresh.';
    App.openModal(els.endModal);
  }

  async function endSession() {
    if (state.busy || state.ending || !state.sessionId) return;
    if (state.teacherMessages < 3) {
      openEndModal();
      return;
    }
    await runEvaluation();
  }

  async function runEvaluation() {
    if (!state.sessionId) return;
    state.ending = true;
    App.hideNotice(els.chatError);
    App.closeModal(els.endModal);
    els.evalOverlay.hidden = false;
    els.endSession.disabled = true;
    els.sendBtn.disabled = true;
    els.chatInput.disabled = true;

    try {
      const data = await App.api('evaluate.php', {
        method: 'POST',
        body: { session_id: state.sessionId },
      });
      els.evalOverlay.hidden = true;
      renderReport(data.evaluation, data.comparison, {
        subject: state.subject,
        topic_name: state.topicName,
        persona: state.persona,
        ended_at: new Date().toISOString(),
      });
    } catch (error) {
      els.evalOverlay.hidden = true;
      if (error.data && error.data.code === 'too_few_messages') {
        state.teacherMessages = Number(error.data.user_messages) || state.teacherMessages;
        openEndModal();
      } else {
        App.showNotice(els.chatError, error.message, 'error');
      }
    } finally {
      state.ending = false;
      els.evalOverlay.hidden = true;
      els.chatInput.disabled = false;
      els.sendBtn.disabled = false;
      els.endSession.disabled = false;
      if (state.status === 'chat') els.chatInput.focus();
    }
  }

  async function discardCurrentSession() {
    if (!state.sessionId) return;
    const button = els.discardSession;
    App.setButtonLoading(button, true, 'Discarding…');
    try {
      await App.api('discard_session.php', {
        method: 'POST',
        body: { session_id: state.sessionId },
      });
      App.closeModal(els.endModal);
      resetToSetup();
      App.toast('Session discarded.', 'success');
    } catch (error) {
      App.toast(error.message, 'error');
    } finally {
      App.setButtonLoading(button, false);
    }
  }

  function resetToSetup() {
    state.sessionId = null;
    state.subject = '';
    state.topicName = '';
    state.persona = 'beginner';
    state.previousSessionId = null;
    state.teacherMessages = 0;
    state.busy = false;
    state.ending = false;

    els.subject.value = '';
    els.subject.readOnly = false;
    els.topic.value = '';
    els.topic.readOnly = false;
    setPersona('beginner');
    els.chatMessages.replaceChildren();
    els.chatInput.value = '';
    resizeInput();
    updateCounter();
    els.reteachBanner.hidden = true;
    App.clear(els.reteachText);
    els.reportRoot.replaceChildren();
    els.evalOverlay.hidden = true;
    App.hideNotice(els.setupError);
    App.hideNotice(els.chatError);
    setSubmitLabel('Start teaching session');
    setView('setup');
    setUrlSession(null);
    els.subject.focus();
  }

  /* ---------- Resume / re-teach ---------- */
  async function resumeSession(sessionId) {
    try {
      const data = await App.api('history.php?session_id=' + encodeURIComponent(sessionId));
      const session = data.session;

      state.sessionId = session.session_id;
      state.subject = session.subject;
      state.topicName = session.topic_name;
      state.persona = session.persona;
      state.previousSessionId = session.previous_session_id || null;
      state.teacherMessages = Array.isArray(data.messages)
        ? data.messages.filter((message) => message.sender === 'user').length
        : 0;

      if (session.status === 'completed' || data.evaluation) {
        if (!data.evaluation) {
          setView('setup');
          App.showNotice(els.setupError, 'This session was completed but has no evaluation attached.', 'error');
          return;
        }
        prepareChatShell();
        els.chatMessages.replaceChildren();
        (data.messages || []).forEach((message) => {
          appendMessage(message.sender, message.content, message.sent_at);
        });
        renderReport(data.evaluation, data.comparison, session);
        return;
      }

      prepareChatShell();
      els.chatMessages.replaceChildren();
      if (!data.messages || !data.messages.length) {
        const hint = App.el('div', 'chat-day', 'This session is active. Send your first explanation to begin.');
        els.chatMessages.appendChild(hint);
      } else {
        data.messages.forEach((message) => {
          appendMessage(message.sender, message.content, message.sent_at);
        });
      }
      setView('chat');
      setUrlSession(state.sessionId);
      els.chatInput.focus();
    } catch (error) {
      setView('setup');
      App.showNotice(els.setupError, error.message, 'error');
    }
  }

  async function prefillReteach(sessionId) {
    try {
      const data = await App.api('history.php?session_id=' + encodeURIComponent(sessionId));
      const session = data.session;

      if (!data.evaluation) {
        App.showNotice(els.setupError, 'That session does not have an evaluation yet, so it cannot be re-taught.', 'error');
        return;
      }

      state.previousSessionId = session.session_id;
      els.subject.value = session.subject;
      els.subject.readOnly = true;
      els.topic.value = session.topic_name;
      els.topic.readOnly = true;
      setPersona(session.persona);

      App.clear(els.reteachText);
      els.reteachText.appendChild(App.el('strong', '', 'Re-teach mode: '));
      els.reteachText.appendChild(
        App.el('span', '', session.subject + ' — ' + session.topic_name +
          ' · Previous overall score: ' + App.scoreText(data.evaluation.overall_score) + '/10')
      );
      els.reteachBanner.hidden = false;
      setSubmitLabel('Start re-teach session');
      els.setupSubmit.disabled = false;
      els.setupView.hidden = false;
      els.chatView.hidden = true;
      els.reportView.hidden = true;
      state.status = 'setup';
    } catch (error) {
      App.showNotice(els.setupError, error.message, 'error');
    }
  }

  /* ---------- Report ---------- */
  function scoreRingClass(score) {
    if (score >= 7) return 'ring-high';
    if (score >= 5) return 'ring-mid';
    return 'ring-low';
  }

  function criterionFillClass(score) {
    if (score >= 7) return 'fill-high';
    if (score >= 5) return 'fill-mid';
    return 'fill-low';
  }

  function reportList(title, items, variant, emptyMessage, iconName) {
    const card = App.el('article', 'card report-list ' + variant);
    const heading = App.el('h3');
    heading.appendChild(App.icon(iconName, 17));
    heading.appendChild(document.createTextNode(title));
    card.appendChild(heading);

    if (Array.isArray(items) && items.length) {
      const list = document.createElement('ul');
      items.forEach((item) => list.appendChild(App.el('li', '', item)));
      card.appendChild(list);
    } else {
      card.appendChild(App.el('p', 'small muted mb-0', emptyMessage));
    }
    return card;
  }

  function formatDiff(value) {
    const rounded = Math.round(value * 10) / 10;
    if (Number.isInteger(rounded)) return String(rounded);
    return rounded.toFixed(1);
  }

  function deltaChip(diff, status) {
    const stat = status || (diff > 0 ? 'improved' : (diff < 0 ? 'declined' : 'same'));
    if (stat === 'improved') return App.el('span', 'delta delta-up status-improved', '↑ Improved +' + formatDiff(diff));
    if (stat === 'declined') return App.el('span', 'delta delta-down status-declined', '↓ Declined ' + formatDiff(diff));
    return App.el('span', 'delta delta-same status-same', '= Same');
  }

  function buildComparison(evaluation, comparisonData) {
    if (!comparisonData) return null;

    const prev = comparisonData.previous || comparisonData;
    const curr = comparisonData.current || evaluation;
    const diffs = comparisonData.diff || null;
    const statuses = comparisonData.status || null;

    const card = App.el('section', 'card comparison');
    card.appendChild(App.el('h3', '', 'Previous vs new attempt'));
    card.appendChild(App.el(
      'p',
      '',
      'Compared with your previous attempt. Improved scores are marked in green, unchanged in grey, and declined in red.'
    ));

    const table = document.createElement('table');
    table.className = 'compare-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Criterion', 'Previous', 'New', 'Change'].forEach((label) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    CRITERIA.forEach((criterion) => {
      const oldScore = Number(prev[criterion.key] ?? 0);
      const newScore = Number(curr[criterion.key] ?? 0);
      const diff = diffs && diffs[criterion.key] !== undefined
        ? Number(diffs[criterion.key])
        : (newScore - oldScore);
      const stat = statuses ? statuses[criterion.key] : null;

      const row = document.createElement('tr');
      row.appendChild(App.el('td', '', criterion.label));
      row.appendChild(App.el('td', '', App.scoreText(oldScore)));
      row.appendChild(App.el('td', '', App.scoreText(newScore)));
      const deltaCell = document.createElement('td');
      deltaCell.appendChild(deltaChip(diff, stat));
      row.appendChild(deltaCell);
      tbody.appendChild(row);
    });

    const oldOverall = Number(prev.overall_score ?? 0);
    const newOverall = Number(curr.overall_score ?? evaluation.overall_score ?? 0);
    const overallDiff = diffs && diffs.overall_score !== undefined
      ? Number(diffs.overall_score)
      : (newOverall - oldOverall);
    const overallStat = statuses ? statuses.overall_score : null;

    const totalRow = document.createElement('tr');
    totalRow.className = 'total-row';
    totalRow.appendChild(App.el('td', '', 'Overall score'));
    totalRow.appendChild(App.el('td', '', App.scoreText(oldOverall)));
    totalRow.appendChild(App.el('td', '', App.scoreText(newOverall)));
    const totalDelta = document.createElement('td');
    totalDelta.appendChild(deltaChip(overallDiff, overallStat));
    totalRow.appendChild(totalDelta);
    tbody.appendChild(totalRow);

    table.appendChild(tbody);
    card.appendChild(table);
    return card;
  }

  function renderReport(evaluation, comparisonData, session) {
    state.status = 'report';
    els.chatView.hidden = true;
    els.setupView.hidden = true;
    els.reportView.hidden = false;
    els.reportRoot.replaceChildren();

    const overall = Number(evaluation.overall_score);
    const verdict = App.verdict(overall);
    const subject = (session && session.subject) || state.subject;
    const topic = (session && session.topic_name) || state.topicName;
    const persona = (session && session.persona) || state.persona;

    els.reportSubtitle.textContent =
      subject + ' — ' + topic + ' · ' + App.personaLabel(persona) + ' persona' +
      (session && session.ended_at ? ' · ' + App.formatDate(session.ended_at, true) : '');

    // Score hero
    const hero = App.el('section', 'score-hero');
    const ring = App.el('div', 'score-ring ' + scoreRingClass(overall));
    const ringInner = App.el('div', 'score-ring-inner');
    ringInner.appendChild(App.el('span', 'number', App.scoreText(overall)));
    ringInner.appendChild(App.el('span', 'outof', 'out of 10'));
    ring.appendChild(ringInner);
    hero.appendChild(ring);

    const summary = App.el('div', 'score-summary');
    summary.appendChild(App.el('span', 'score-verdict ' + verdict.className, verdict.label));
    summary.appendChild(App.el('h2', '', 'Overall score ' + App.scoreText(overall) + ' / 10'));
    summary.appendChild(App.el('p', '', evaluation.summary || 'The evaluator did not add a summary.'));
    summary.appendChild(App.el('p', 'small muted mt-2', 'Calculated by PHP as the average of the four criteria — never taken from the AI.'));
    hero.appendChild(summary);
    els.reportRoot.appendChild(hero);

    // Criteria cards
    const criteriaGrid = App.el('div', 'criteria-grid');
    CRITERIA.forEach((criterion) => {
      const score = Number(evaluation[criterion.key]);
      const card = App.el('article', 'criterion');
      const top = App.el('div', 'criterion-top');
      top.appendChild(App.el('span', '', criterion.label));
      top.appendChild(App.el('strong', '', App.scoreText(score)));
      card.appendChild(top);

      const bar = App.el('div', 'criterion-bar');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '10');
      bar.setAttribute('aria-valuenow', String(score));
      bar.setAttribute('aria-label', criterion.label + ' score');
      const fill = App.el('div', 'criterion-fill ' + criterionFillClass(score));
      fill.style.width = Math.max(0, Math.min(100, score * 10)) + '%';
      bar.appendChild(fill);
      card.appendChild(bar);
      criteriaGrid.appendChild(card);
    });
    els.reportRoot.appendChild(criteriaGrid);

    // Lists
    const grid = App.el('div', 'report-grid');
    grid.appendChild(reportList(
      'Knowledge gaps',
      evaluation.gaps,
      'list-warn',
      'No gaps were flagged. Make sure your explanation covered the core ideas.',
      'alert'
    ));
    grid.appendChild(reportList(
      'Misconceptions',
      evaluation.misconceptions,
      'list-danger',
      'No factual misconceptions detected in what you said.',
      'target'
    ));
    grid.appendChild(reportList(
      'Missing concepts',
      evaluation.missing_concepts,
      'list-warn',
      'No important concepts were flagged as missing.',
      'book'
    ));
    grid.appendChild(reportList(
      'Suggested next steps',
      evaluation.suggestions,
      'list-good',
      'No suggestions were returned. Re-teach with a different persona for another angle.',
      'spark'
    ));
    els.reportRoot.appendChild(grid);

    // Re-teach comparison
    const comparison = buildComparison(evaluation, comparisonData);
    if (comparison) els.reportRoot.appendChild(comparison);

    // Actions
    const actions = App.el('div', 'report-actions');
    const newButton = App.el('button', 'btn btn-primary', 'Teach something new');
    newButton.type = 'button';
    newButton.addEventListener('click', resetToSetup);
    actions.appendChild(newButton);

    if (overall < 6) {
      const reteach = App.el('a', 'btn btn-outline', 'Re-teach this topic');
      reteach.href = 'teach.html?reteach=' + encodeURIComponent(String(state.sessionId));
      actions.appendChild(reteach);
    }

    const history = App.el('a', 'btn btn-ghost', 'View history');
    history.href = 'history.html';
    actions.appendChild(history);
    els.reportRoot.appendChild(actions);
    els.reportRoot.appendChild(App.el(
      'p',
      'report-note',
      'This report is generated by an AI evaluator from this conversation only. It is a study aid — verify important facts with your course material.'
    ));

    setUrlSession(state.sessionId);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Animate score ring
    ring.style.setProperty('--pct', '0');
    window.requestAnimationFrame(() => {
      window.setTimeout(() => ring.style.setProperty('--pct', String(Math.max(0, Math.min(100, overall * 10)))), 60);
    });
  }

  /* ---------- Init ---------- */
  function bindEvents() {
    els.setupForm.addEventListener('submit', startSession);
    els.chatForm.addEventListener('submit', sendMessage);

    els.chatInput.addEventListener('input', () => {
      resizeInput();
      updateCounter();
    });
    els.chatInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (!els.sendBtn.disabled) els.chatForm.requestSubmit();
      }
    });

    els.endSession.addEventListener('click', endSession);
    els.continueSession.addEventListener('click', () => {
      App.closeModal(els.endModal);
      els.chatInput.focus();
    });
    els.discardSession.addEventListener('click', discardCurrentSession);

    [els.subject, els.topic].forEach((input) => {
      input.addEventListener('input', () => {
        input.classList.remove('invalid');
        if (input === els.subject && els.subjectError) els.subjectError.textContent = '';
        if (input === els.topic && els.topicError) els.topicError.textContent = '';
      });
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await App.init({ requireAuth: true });
    if (!user) return;

    cacheElements();
    bindEvents();
    resizeInput();
    updateCounter();

    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session_id') || params.get('session');
    const reteachParam = params.get('reteach');

    if (sessionParam) {
      await resumeSession(sessionParam);
    } else if (reteachParam) {
      await prefillReteach(reteachParam);
    } else {
      setView('setup');
      els.subject.focus();
    }
  });
})();
