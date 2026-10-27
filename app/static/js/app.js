/**
 * VocalFlow - Main Application Controller
 * Handles Studio Recording, Dashboard CRUD, TTS playback, and Settings.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const micBtn = document.getElementById('micBtn');
  const micPulseRing = document.getElementById('micPulseRing');
  const recordTimer = document.getElementById('recordTimer');
  const recordHint = document.getElementById('recordHint');
  const streamEditor = document.getElementById('streamEditor');
  const streamStatusBadge = document.getElementById('streamStatusBadge');
  const visualizerOverlayText = document.getElementById('visualizerOverlayText');
  const langSelect = document.getElementById('langSelect');
  const engineSelect = document.getElementById('engineSelect');
  
  // Analysis elements
  const langBadge = document.getElementById('langBadge');
  const hindiPctText = document.getElementById('hindiPctText');
  const englishPctText = document.getElementById('englishPctText');
  const ratioHindiBar = document.getElementById('ratioHindiBar');
  const ratioEnglishBar = document.getElementById('ratioEnglishBar');
  const wordCountBadge = document.getElementById('wordCountBadge');

  // Studio action buttons
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const playTtsBtn = document.getElementById('playTtsBtn');

  // Dashboard elements
  const searchInput = document.getElementById('searchInput');
  const langFilter = document.getElementById('langFilter');
  const sortSelect = document.getElementById('sortSelect');
  const transcriptionsTableBody = document.getElementById('transcriptionsTableBody');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const exportFormatSelect = document.getElementById('exportFormatSelect');
  const exportBtn = document.getElementById('exportBtn');
  
  // Pagination
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageInfoText = document.getElementById('pageInfoText');

  // KPI elements
  const kpiTotalTranscriptions = document.getElementById('kpiTotalTranscriptions');
  const kpiTotalWords = document.getElementById('kpiTotalWords');
  const kpiHinglishRatio = document.getElementById('kpiHinglishRatio');
  const kpiTotalDuration = document.getElementById('kpiTotalDuration');
  const dbStatusPill = document.getElementById('dbStatusPill');

  // Modals
  const editModal = document.getElementById('editModal');
  const editModalClose = document.getElementById('editModalClose');
  const editModalCancel = document.getElementById('editModalCancel');
  const editForm = document.getElementById('editForm');
  const editId = document.getElementById('editId');
  const editTitle = document.getElementById('editTitle');
  const editContent = document.getElementById('editContent');
  const editTags = document.getElementById('editTags');
  const editNotes = document.getElementById('editNotes');
  const editFavorite = document.getElementById('editFavorite');

  // State
  let visualizer = new AudioVisualizer('audioCanvas');
  let speechEngine = null;
  let timerInterval = null;
  let elapsedSeconds = 0;
  let recordedAudioBase64 = null;
  let currentPage = 1;
  let totalPages = 1;
  let selectedIds = new Set();
  let currentAudioPlayer = null;

  // Initialize SpeechEngine
  speechEngine = new SpeechEngine({
    language: langSelect ? langSelect.value : 'hi-IN',
    onInterim: (data) => {
      if (streamEditor) {
        streamEditor.innerText = data.combined;
      }
      updateWordCount(data.combined);
    },
    onFinal: (data) => {
      recordedAudioBase64 = data.audioBase64;
    },
    onAnalysis: (data) => {
      updateAnalysisUI(data.analysis || data);
    },
    onError: (err) => {
      showToast(err, 'error');
    },
    onStateChange: (recording, stream) => {
      if (recording) {
        micBtn.classList.add('recording');
        micPulseRing.classList.add('active');
        streamStatusBadge.classList.remove('idle');
        streamStatusBadge.innerHTML = '<span class="badge-blink"></span> Listening Live...';
        recordHint.innerText = 'Click mic to finish & process';
        if (visualizerOverlayText) visualizerOverlayText.style.display = 'none';
        if (stream) visualizer.start(stream);
        startTimer();
      } else {
        micBtn.classList.remove('recording');
        micPulseRing.classList.remove('active');
        streamStatusBadge.classList.add('idle');
        streamStatusBadge.innerHTML = 'Stream Idle';
        recordHint.innerText = 'Click mic to start real-time transcription';
        if (visualizerOverlayText) visualizerOverlayText.style.display = 'flex';
        visualizer.stop();
        stopTimer();
      }
    }
  });

  // Unified Tab switching helper
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const navMenuLinks = document.querySelectorAll('.nav-menu-link');

  function switchTab(tabId) {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    tabPanes.forEach(p => p.classList.toggle('active', p.id === tabId));
    navMenuLinks.forEach(n => n.classList.toggle('active', n.dataset.navtab === tabId));

    if (tabId === 'history-tab') {
      loadTranscriptions();
      loadStats();
    }
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  navMenuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(link.dataset.navtab);
    });
  });

  // Footer navigation links
  document.querySelectorAll('.footer-tab-trigger').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.dataset.target;
      if (target) {
        switchTab(target);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // Navbar Quick Record CTA Button
  const navQuickRecordBtn = document.getElementById('navQuickRecordBtn');
  if (navQuickRecordBtn) {
    navQuickRecordBtn.addEventListener('click', async () => {
      switchTab('studio-tab');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (speechEngine && !speechEngine.isRecording) {
        try {
          await speechEngine.start();
        } catch (e) {
          showToast('Could not access microphone: ' + e.message, 'error');
        }
      }
    });
  }

  // Back to Top Button
  const backToTopBtn = document.getElementById('backToTopBtn');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Language selector
  if (langSelect) {
    langSelect.addEventListener('change', () => {
      speechEngine.setLanguage(langSelect.value);
      showToast(`Language set to ${langSelect.options[langSelect.selectedIndex].text}`, 'info');
    });
  }

  // Mic Click Handler
  if (micBtn) {
    micBtn.addEventListener('click', async () => {
      if (!speechEngine.isRecording) {
        try {
          await speechEngine.start();
        } catch (e) {
          showToast('Could not access microphone: ' + e.message, 'error');
        }
      } else {
        await speechEngine.stop();
        showToast('Audio recorded. Ready to save or playback!', 'success');
      }
    });
  }

  // Timer functions
  function startTimer() {
    elapsedSeconds = 0;
    updateTimerDisplay();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      elapsedSeconds++;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  function updateTimerDisplay() {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    if (recordTimer) {
      recordTimer.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  function updateWordCount(text) {
    if (!wordCountBadge) return;
    const words = (text || '').trim().split(/\s+/).filter(Boolean);
    wordCountBadge.innerText = `${words.length} words`;
  }

  // Live Linguistic Analysis UI Updater
  function updateAnalysisUI(analysis) {
    if (!analysis) return;

    if (langBadge) {
      langBadge.innerText = analysis.label || 'Multilingual';
      langBadge.className = 'lang-badge';
      if ((analysis.label || '').includes('Hinglish')) {
        langBadge.classList.add('hinglish');
      } else if ((analysis.label || '').includes('Hindi')) {
        langBadge.classList.add('hindi');
      } else {
        langBadge.classList.add('english');
      }
    }

    const hindiPct = analysis.hindi_pct || 0;
    const englishPct = analysis.english_pct || 0;

    if (hindiPctText) hindiPctText.innerText = `${hindiPct}%`;
    if (englishPctText) englishPctText.innerText = `${englishPct}%`;
    if (ratioHindiBar) ratioHindiBar.style.width = `${hindiPct}%`;
    if (ratioEnglishBar) ratioEnglishBar.style.width = `${englishPct}%`;
  }

  // Stream Editor Live Input Event (user can edit live text)
  if (streamEditor) {
    streamEditor.addEventListener('input', debounce(async () => {
      const text = streamEditor.innerText.trim();
      updateWordCount(text);
      if (text) {
        try {
          const res = await fetch('/api/analyze-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
          });
          const analysis = await res.json();
          updateAnalysisUI(analysis);
        } catch (e) {}
      }
    }, 300));
  }

  // Quick Test Phrase Chips
  document.querySelectorAll('.phrase-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      const text = chip.dataset.phrase;
      if (streamEditor) {
        streamEditor.innerText = text;
        updateWordCount(text);
      }
      try {
        const res = await fetch('/api/analyze-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const analysis = await res.json();
        updateAnalysisUI(analysis);
      } catch (e) {}
      showToast('Sample Hinglish phrase loaded!', 'info');
    });
  });

  // Studio Action: Clear
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (streamEditor) streamEditor.innerText = '';
      updateWordCount('');
      updateAnalysisUI({ label: 'Multilingual', hindi_pct: 0, english_pct: 0 });
      recordedAudioBase64 = null;
      elapsedSeconds = 0;
      updateTimerDisplay();
      showToast('Studio cleared', 'info');
    });
  }

  // Studio Action: Save to Database
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const content = streamEditor ? streamEditor.innerText.trim() : '';
      if (!content) {
        showToast('Please speak or type a sentence before saving.', 'error');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerText = 'Saving...';

      try {
        const payload = {
          content: content,
          duration_seconds: Math.max(1, elapsedSeconds),
          audio_base64: recordedAudioBase64,
          engine_used: engineSelect ? engineSelect.options[engineSelect.selectedIndex].text : 'Real-time Multilingual Engine',
          tags: ['multilingual', 'live-recording']
        };

        const res = await fetch('/api/transcriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Failed to save');
        }

        const data = await res.json();
        showToast(`Saved to Database (ID: ${data.id})!`, 'success');
        loadStats();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save to Database';
      }
    });
  }

  // Studio Action: Play TTS
  if (playTtsBtn) {
    playTtsBtn.addEventListener('click', async () => {
      const content = streamEditor ? streamEditor.innerText.trim() : '';
      if (!content) {
        showToast('No text to synthesize.', 'error');
        return;
      }
      playTts(content);
    });
  }

  // Open-Source TTS Playback Function
  async function playTts(text, preferredLang = 'auto') {
    try {
      showToast('Synthesizing speech with Open-Source TTS...', 'info');
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, lang: preferredLang })
      });
      if (!res.ok) throw new Error('TTS generation failed');
      const data = await res.json();
      
      if (currentAudioPlayer) {
        currentAudioPlayer.pause();
      }
      currentAudioPlayer = new Audio(data.audio_url);
      currentAudioPlayer.play();
      showToast('Playing speech audio...', 'success');
    } catch (err) {
      // Browser Web Speech Synthesis Fallback
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = preferredLang === 'en' ? 'en-US' : 'hi-IN';
        window.speechSynthesis.speak(utterance);
        showToast('Playing browser speech synthesis...', 'success');
      } else {
        showToast('TTS playback failed: ' + err.message, 'error');
      }
    }
  }

  // ============================================================================
  // History Dashboard & CRUD Operations
  // ============================================================================

  async function loadTranscriptions() {
    if (!transcriptionsTableBody) return;
    transcriptionsTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">Loading transcriptions...</td></tr>';

    const q = searchInput ? searchInput.value.trim() : '';
    const lang = langFilter ? langFilter.value : 'all';
    const sortBy = sortSelect ? sortSelect.value : 'newest';

    const params = new URLSearchParams({
      page: currentPage,
      limit: 8,
      sort_by: sortBy
    });
    if (q) params.append('q', q);
    if (lang && lang !== 'all') params.append('lang', lang);

    try {
      const res = await fetch(`/api/transcriptions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch transcriptions');
      const data = await res.json();

      totalPages = data.total_pages || 1;
      updatePaginationControls(data.page, totalPages, data.total);
      renderTranscriptionsTable(data.items);
    } catch (err) {
      transcriptionsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--accent-rose);">Error: ${err.message}</td></tr>`;
    }
  }

  function renderTranscriptionsTable(items) {
    if (!items || items.length === 0) {
      transcriptionsTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2.5rem; color: var(--text-muted);">No transcriptions found. Speak something in the Studio to create one!</td></tr>';
      return;
    }

    transcriptionsTableBody.innerHTML = items.map(item => {
      const isSelected = selectedIds.has(item.id);
      const isFav = item.is_favorite;
      const langClass = (item.language || '').includes('Hinglish') ? 'hinglish' : (item.language || '').includes('Hindi') ? 'hindi' : 'english';
      const createdDate = item.created_at ? new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Just now';

      return `
        <tr data-id="${item.id}">
          <td style="width: 38px;">
            <input type="checkbox" class="row-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''} />
          </td>
          <td class="table-title-cell">
            <div class="table-title-text" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
            <div class="table-engine-tag">${escapeHtml(item.engine_used || 'Real-time Engine')}</div>
          </td>
          <td>
            <span class="lang-badge ${langClass}">${escapeHtml(item.language)}</span>
          </td>
          <td class="table-content-cell" title="${escapeHtml(item.content)}">
            ${escapeHtml(item.content)}
          </td>
          <td style="white-space: nowrap;">
            <div><strong>${item.word_count || 0}</strong> words</div>
            <div style="font-size: 0.74rem; color: var(--text-muted);">${item.duration_seconds || 0}s</div>
          </td>
          <td style="font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;">
            ${createdDate}
          </td>
          <td style="white-space: nowrap;">
            <div style="display: flex; gap: 0.25rem;">
              <button class="action-icon-btn play-btn" data-id="${item.id}" title="Play Audio / TTS">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </button>
              <button class="action-icon-btn fav-btn ${isFav ? 'active' : ''}" data-id="${item.id}" title="${isFav ? 'Unfavorite' : 'Favorite'}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              </button>
              <button class="action-icon-btn edit-btn" data-id="${item.id}" title="Edit Transcription">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="action-icon-btn delete-btn" data-id="${item.id}" title="Delete Transcription">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    attachTableEvents(items);
  }

  function attachTableEvents(items) {
    // Checkboxes
    document.querySelectorAll('.row-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = parseInt(e.target.dataset.id);
        if (e.target.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        updateBulkDeleteButton();
      });
    });

    // Play button
    document.querySelectorAll('.play-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const item = items.find(i => i.id === id);
        if (item) {
          if (item.audio_url) {
            if (currentAudioPlayer) currentAudioPlayer.pause();
            currentAudioPlayer = new Audio(item.audio_url);
            currentAudioPlayer.play().catch(() => playTts(item.content));
            showToast('Playing saved audio recording...', 'info');
          } else {
            playTts(item.content);
          }
        }
      });
    });

    // Favorite toggle
    document.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        const item = items.find(i => i.id === id);
        if (item) {
          const newFav = !item.is_favorite;
          try {
            await fetch(`/api/transcriptions/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_favorite: newFav })
            });
            item.is_favorite = newFav;
            loadTranscriptions();
          } catch (e) {
            showToast('Failed to toggle favorite', 'error');
          }
        }
      });
    });

    // Edit button
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const item = items.find(i => i.id === id);
        if (item) openEditModal(item);
      });
    });

    // Delete button
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        if (confirm(`Delete transcription #${id}?`)) {
          try {
            const res = await fetch(`/api/transcriptions/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            showToast(`Transcription #${id} deleted`, 'info');
            selectedIds.delete(id);
            loadTranscriptions();
            loadStats();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });
  }

  function updateBulkDeleteButton() {
    if (!bulkDeleteBtn) return;
    bulkDeleteBtn.style.display = selectedIds.size > 0 ? 'inline-flex' : 'none';
    bulkDeleteBtn.innerText = `Delete Selected (${selectedIds.size})`;
  }

  // Select all checkbox
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = isChecked;
        const id = parseInt(cb.dataset.id);
        if (isChecked) selectedIds.add(id);
        else selectedIds.delete(id);
      });
      updateBulkDeleteButton();
    });
  }

  // Bulk delete action
  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', async () => {
      if (selectedIds.size === 0) return;
      if (confirm(`Delete ${selectedIds.size} selected transcriptions?`)) {
        try {
          const res = await fetch('/api/transcriptions/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
          });
          const data = await res.json();
          showToast(`Deleted ${data.deleted_count} items`, 'success');
          selectedIds.clear();
          updateBulkDeleteButton();
          loadTranscriptions();
          loadStats();
        } catch (e) {
          showToast('Bulk delete failed: ' + e.message, 'error');
        }
      }
    });
  }

  // Pagination controls
  function updatePaginationControls(page, total, count) {
    currentPage = page;
    if (pageInfoText) {
      pageInfoText.innerText = `Page ${page} of ${total} (${count} items)`;
    }
    if (prevPageBtn) prevPageBtn.disabled = page <= 1;
    if (nextPageBtn) nextPageBtn.disabled = page >= total;
  }

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadTranscriptions();
      }
    });
  }
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        loadTranscriptions();
      }
    });
  }

  // Search, filter, and sort listeners
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      currentPage = 1;
      loadTranscriptions();
    }, 300));
  }
  if (langFilter) {
    langFilter.addEventListener('change', () => {
      currentPage = 1;
      loadTranscriptions();
    });
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentPage = 1;
      loadTranscriptions();
    });
  }

  // Export action
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const format = exportFormatSelect ? exportFormatSelect.value : 'json';
      window.open(`/api/transcriptions/export?format=${format}`, '_blank');
      showToast(`Exporting in ${format.toUpperCase()} format...`, 'info');
    });
  }

  // Edit Modal logic
  function openEditModal(item) {
    if (!editModal) return;
    editId.value = item.id;
    editTitle.value = item.title || '';
    editContent.value = item.content || '';
    editTags.value = Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || '');
    editNotes.value = item.notes || '';
    editFavorite.checked = !!item.is_favorite;
    editModal.classList.add('open');
  }

  function closeEditModal() {
    if (editModal) editModal.classList.remove('open');
  }

  if (editModalClose) editModalClose.addEventListener('click', closeEditModal);
  if (editModalCancel) editModalCancel.addEventListener('click', closeEditModal);

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = editId.value;
      const payload = {
        title: editTitle.value.trim(),
        content: editContent.value.trim(),
        tags: editTags.value.split(',').map(t => t.trim()).filter(Boolean),
        notes: editNotes.value.trim(),
        is_favorite: editFavorite.checked
      };

      try {
        const res = await fetch(`/api/transcriptions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Update failed');
        showToast('Transcription updated successfully', 'success');
        closeEditModal();
        loadTranscriptions();
        loadStats();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // KPI Statistics Loader
  async function loadStats() {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) return;
      const stats = await res.json();

      if (kpiTotalTranscriptions) kpiTotalTranscriptions.innerText = stats.total_transcriptions;
      if (kpiTotalWords) kpiTotalWords.innerText = stats.total_words;
      if (kpiHinglishRatio) kpiHinglishRatio.innerText = `${stats.hinglish_pct}%`;
      if (kpiTotalDuration) kpiTotalDuration.innerText = `${stats.total_duration_seconds}s`;
    } catch (e) {}
  }

  // Database Connection Health Check
  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) return;
      const data = await res.json();
      if (dbStatusPill) {
        dbStatusPill.innerHTML = `<span class="db-dot"></span> ${data.database.db_type}`;
      }
    } catch (e) {}
  }

  // Audio File Uploader tab
  const uploadForm = document.getElementById('uploadForm');
  const audioFileInput = document.getElementById('audioFileInput');
  const dropzone = document.getElementById('dropzone');
  const uploadTitleInput = document.getElementById('uploadTitleInput');
  const uploadStatus = document.getElementById('uploadStatus');

  if (dropzone && audioFileInput) {
    dropzone.addEventListener('click', () => audioFileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        audioFileInput.files = e.dataTransfer.files;
        handleFileSelect(audioFileInput.files[0]);
      }
    });

    audioFileInput.addEventListener('change', () => {
      if (audioFileInput.files.length > 0) {
        handleFileSelect(audioFileInput.files[0]);
      }
    });
  }

  function handleFileSelect(file) {
    if (dropzone) {
      dropzone.querySelector('.dropzone-text').innerText = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    }
  }

  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!audioFileInput.files || audioFileInput.files.length === 0) {
        showToast('Please select an audio file to upload.', 'error');
        return;
      }

      const file = audioFileInput.files[0];
      const formData = new FormData();
      formData.append('file', file);
      if (uploadTitleInput && uploadTitleInput.value.trim()) {
        formData.append('title', uploadTitleInput.value.trim());
      }

      if (uploadStatus) {
        uploadStatus.innerText = 'Transcribing and saving to database...';
        uploadStatus.style.display = 'block';
      }

      try {
        const res = await fetch('/api/transcribe/upload', {
          method: 'POST',
          body: formData
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Upload transcription failed');
        }
        const created = await res.json();
        showToast(`Uploaded & Transcribed: "${created.title}"`, 'success');
        if (uploadStatus) uploadStatus.style.display = 'none';
        uploadForm.reset();
        if (dropzone) {
          dropzone.querySelector('.dropzone-text').innerText = 'Drop audio files here (WAV, MP3, WebM, M4A) or click to browse';
        }
        loadStats();
      } catch (err) {
        if (uploadStatus) uploadStatus.style.display = 'none';
        showToast(err.message, 'error');
      }
    });
  }

  // Utilities
  function debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Initial load
  checkHealth();
  loadStats();
  loadTranscriptions();
});
