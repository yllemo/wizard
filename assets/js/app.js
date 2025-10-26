// Utility functions
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// Safe element access with null checking
function safeSetStyle(element, property, value) {
  if (element && element.style) {
    element.style[property] = value;
  }
}

function safeSetTextContent(element, text) {
  if (element) {
    element.textContent = text;
  }
}

// Safe JSON parsing with error handling
async function safeJsonParse(response, context = 'API response') {
  try {
    const text = await response.text();
    
    // Check if response is HTML (common for timeouts/errors)
    if (text.trim().startsWith('<')) {
      const errorMsg = `${context}: Fick HTML-svar istället för JSON (möjlig timeout eller serverfel)`;
      const details = {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        responseText: text.substring(0, 500) + (text.length > 500 ? '...' : '')
      };
      throw new Error(errorMsg, details);
    }
    
    // Try to parse as JSON
    try {
      return JSON.parse(text);
    } catch (jsonError) {
      const errorMsg = `${context}: Ogiltigt JSON-svar`;
      const details = {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        jsonError: jsonError.message,
        responseText: text.substring(0, 500) + (text.length > 500 ? '...' : '')
      };
      throw new Error(errorMsg, details);
    }
  } catch (error) {
    // Re-throw with additional context
    error.response = response;
    throw error;
  }
}

// Enhanced fetch with comprehensive error handling
async function safeFetch(url, options = {}, context = 'API call') {
  try {
    const response = await fetch(url, options);
    
    // Check for HTTP errors
    if (!response.ok) {
      const errorMsg = `${context}: HTTP ${response.status} ${response.statusText}`;
      const details = {
        status: response.status,
        statusText: response.statusText,
        url: url,
        method: options.method || 'GET'
      };
      
      // Try to get response text for more details
      try {
        const responseText = await response.text();
        details.responseText = responseText.substring(0, 500) + (responseText.length > 500 ? '...' : '');
      } catch (e) {
        details.responseText = 'Kunde inte läsa svar';
      }
      
      const error = new Error(errorMsg);
      error.details = details;
      throw error;
    }
    
    return response;
  } catch (error) {
    // Add context to network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new Error(`${context}: Nätverksfel - kontrollera internetanslutning`);
      networkError.details = {
        originalError: error.message,
        url: url,
        method: options.method || 'GET'
      };
      throw networkError;
    }
    throw error;
  }
}

// Toast notification system
function toast(message, type = 'success') {
  const el = $('#toast');
  if (!el) return; // Exit if toast element doesn't exist
  
  el.textContent = message;
  
  // Update styling based on type
  el.className = 'toast';
  if (type === 'error') {
    el.classList.add('error');
    el.style.color = 'var(--err)';
  } else if (type === 'warning') {
    el.classList.add('warning');
    el.style.color = 'var(--warning)';
  } else {
    el.classList.add('success');
    el.style.color = 'var(--ok)';
  }
  
  el.classList.add('show');
  
  // Longer display time for errors, shorter for success
  const displayTime = type === 'error' ? 8000 : type === 'warning' ? 6000 : 4000;
  setTimeout(() => el.classList.remove('show'), displayTime);
  
  // Add click to dismiss functionality
  el.onclick = () => el.classList.remove('show');
}

// Error modal system
function showErrorModal(error, details = null) {
  const modal = $('#errorModal');
  const errorMessage = $('#errorMessage');
  const errorDetails = $('#errorDetails');
  
  if (!modal || !errorMessage || !errorDetails) return; // Exit if elements don't exist
  
  errorMessage.textContent = error;
  
  if (details) {
    errorDetails.textContent = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
  } else {
    errorDetails.textContent = 'Inga ytterligare detaljer tillgängliga.';
  }
  
  modal.style.display = 'block';
}

function hideErrorModal() {
  const errorModal = $('#errorModal');
  if (errorModal) {
    errorModal.style.display = 'none';
  }
}

// Enhanced error handling function
function handleError(error, details = null, showModal = true) {
  console.error('Application error:', error, details);
  
  // Show toast notification
  toast(error, 'error');
  
  // Show detailed error modal for serious errors
  if (showModal && (error.length > 50 || details)) {
    showErrorModal(error, details);
  }
}

// AI Processing Indicator Functions
function showAIProcessingIndicator(type, title, detail) {
  // Remove any existing indicator
  hideAIProcessingIndicator();
  
  const indicator = document.createElement('div');
  indicator.id = 'ai-processing-indicator';
  indicator.className = `ai-status ${type}`;
  
  const icon = type === 'transcribing' ? '🎤' : '🤖';
  
  indicator.innerHTML = `
    <div class="ai-status-icon">${icon}</div>
    <div>
      <div class="ai-status-text">${title}</div>
      <div class="ai-status-detail">${detail}</div>
    </div>
    <div class="loading-spinner"></div>
  `;
  
  // Insert at the top of the current panel
  const currentPanel = document.querySelector('.step:not([style*="display: none"])');
  if (currentPanel) {
    currentPanel.insertBefore(indicator, currentPanel.firstChild);
  } else {
    // Fallback: insert at the top of the body if no panel found
    document.body.insertBefore(indicator, document.body.firstChild);
  }
}

function hideAIProcessingIndicator() {
  const indicator = document.getElementById('ai-processing-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Application state
const state = {
  meetingId: null,
  uploaded: null,
  transcript: '',
  filled: '',
  currentStep: 'agenda'
};

// Settings management (only for user-configurable settings)
const settings = {
  llmModel: 'gpt-4o-mini',
  llmTemperature: 0.2,
  llmSystemPrompt: 'Du är en expert på att fylla i mötesmallar baserat på transkript. Du ska vara noggrann, tydlig och följa exakt samma struktur som originalmallen. Använd svenska och var professionell i tonen.'
};

// Chat state
const chatState = {
  messages: [],
  isProcessing: false
};

// Initialize application
function init() {
  // Check if meeting ID is provided in URL
  const urlParams = new URLSearchParams(window.location.search);
  const meetingId = urlParams.get('meeting');
  
  if (meetingId && meetingId.trim() !== '') {
    // Validate meeting ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(meetingId)) {
      const errorMsg = 'Ogiltigt mötes-ID format i URL';
      handleError(errorMsg, {meetingId: meetingId}, true);
      showMeetingSelection();
      return;
    }
    
    // Load existing meeting
    state.meetingId = meetingId;
    updateMeetingIdDisplay(meetingId);
    loadMeetingFromServer(meetingId);
    
    // Load audio files
    loadAudioFiles();
  } else {
    // No meeting selected - show meeting selection interface
    state.meetingId = null;
    showMeetingSelection();
  }
  
  window.state = state;
  window.loadAudioFiles = loadAudioFiles; // Make globally available for recorder.js
  
  // Initialize theme
  initTheme();
  
  // Initialize touch-friendly interactions
  initTouchInteractions();
  
  // Setup modal close functionality
  setupModalCloseOnOutsideClick();
  
  // Load settings from localStorage
  loadSettings();
  
  // Load available templates
  loadTemplates();
  
  // Load state from localStorage
  const savedState = localStorage.getItem('meetingState');
  if (savedState) {
    try {
      const parsedState = JSON.parse(savedState);
      Object.assign(state, parsedState);
      console.log('Loaded state from localStorage:', state);
    } catch (error) {
      console.error('Error loading state from localStorage:', error);
    }
  }
  
  // Initialize mermaid
  initializeMermaid();
  
  // Initialize step indicators
  updateStepIndicators();
  
  // Load meeting state from server if meeting ID is provided
  if (meetingId) {
    console.log('Loading meeting state for:', meetingId);
    loadMeetingState(meetingId);
  }
}

// Theme management
function initTheme() {
  const savedTheme = localStorage.getItem('meetingAssistantTheme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

// Initialize touch-friendly interactions
function initTouchInteractions() {
  // Add touch-friendly classes for mobile devices
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.body.classList.add('touch-device');
  }
  
  // Prevent zoom on input focus for mobile
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      if (window.innerWidth <= 768) {
        document.querySelector('meta[name=viewport]').setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
      }
    });
    
    input.addEventListener('blur', () => {
      if (window.innerWidth <= 768) {
        document.querySelector('meta[name=viewport]').setAttribute('content', 'width=device-width, initial-scale=1');
      }
    });
  });
  
  // Improve modal touch interactions
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.addEventListener('touchstart', (e) => {
      if (e.target === modal) {
        e.preventDefault();
      }
    }, { passive: false });
  });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('meetingAssistantTheme', newTheme);
  updateThemeIcon(newTheme);
  
  toast(`Tema ändrat till ${newTheme === 'light' ? 'ljus' : 'mörk'}`, 'success');
  console.log('Theme toggled to:', newTheme);
}

function updateThemeIcon(theme) {
  const themeIcon = $('.theme-icon');
  if (themeIcon) {
    themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
  }
}

// Settings management functions
function loadSettings() {
  const savedSettings = localStorage.getItem('meetingAssistantSettings');
  if (savedSettings) {
    const parsed = JSON.parse(savedSettings);
    Object.assign(settings, parsed);
  }
  updateSettingsUI();
}

function saveSettings() {
  localStorage.setItem('meetingAssistantSettings', JSON.stringify(settings));
  toast('Inställningar sparade', 'success');
}

function updateSettingsUI() {
  $('#llmModel').value = settings.llmModel;
  $('#llmTemperature').value = settings.llmTemperature;
  $('#llmSystemPrompt').value = settings.llmSystemPrompt;
}

function collectSettingsFromUI() {
  settings.llmModel = $('#llmModel').value;
  settings.llmTemperature = parseFloat($('#llmTemperature').value);
  settings.llmSystemPrompt = $('#llmSystemPrompt').value;
}

function resetSettings() {
  settings.llmModel = 'gpt-4o-mini';
  settings.llmTemperature = 0.2;
  settings.llmSystemPrompt = 'Du är en expert på att fylla i mötesmallar baserat på transkript. Du ska vara noggrann, tydlig och följa exakt samma struktur som originalmallen. Använd svenska och var professionell i tonen.';
  updateSettingsUI();
  toast('Inställningar återställda', 'success');
}

// Chat functionality
function addChatMessage(content, type = 'user') {
  const chatMessages = $('#chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${type}`;
  messageDiv.innerHTML = content;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChat() {
  $('#chatMessages').innerHTML = `
    <div class="chat-message system">
      <strong>System:</strong> Välkommen! Jag kommer att fylla i mallen baserat på transkriptet och dina instruktioner. Varje meddelande du skickar kommer att uppdatera den ifyllda mallen.
    </div>
  `;
  chatState.messages = [];
}

// Meeting management functions
function showMeetingSelection() {
  // Hide main content and show meeting selection
  document.querySelectorAll('.panel').forEach(panel => {
    panel.style.display = 'none';
  });
  
  // Show meeting selection interface
  const meetingSelection = document.getElementById('meetingSelection');
  if (meetingSelection) {
    meetingSelection.style.display = 'block';
  }
  
  // No need to load existing meetings on start page
}

// Removed meeting listing functions - keeping only new meeting creation

async function createNewMeeting() {
  try {
    const formData = new FormData();
    formData.append('action', 'create_meeting');
    
    const response = await fetch('index.php', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.ok && result.meetingId) {
      // Navigate to new meeting
      window.location.href = `?meeting=${result.meetingId}`;
    } else {
      toast('Fel vid skapande av nytt möte', 'error');
    }
  } catch (error) {
    toast('Fel vid skapande av nytt möte', 'error');
    console.error('Create meeting error:', error);
  }
}

async function loadMeetingFromServer(meetingId) {
  if (!meetingId || meetingId.trim() === '') {
    const errorMsg = 'Ogiltigt mötes-ID';
    handleError(errorMsg, {meetingId: meetingId}, true);
    return;
  }
  
  try {
    const response = await safeFetch(`index.php?action=load_meeting&meetingId=${encodeURIComponent(meetingId)}`, {}, 'Mötesladdning');
    const result = await safeJsonParse(response, 'Mötesladdning');
    
    if (result.ok && result.meeting) {
      const meeting = result.meeting;
      
      // Load meeting state and set meetingId
      state.meetingId = meetingId;
      state.agenda = meeting.agenda || '';
      state.transcript = meeting.transcript || '';
      state.filled = meeting.filled || '';
      state.uploaded = meeting.uploaded || null;
      state.currentStep = meeting.currentStep || 'agenda';
      
      // Load chat dialog if exists
      if (meeting.chatDialog) {
        try {
          chatState.messages = JSON.parse(meeting.chatDialog);
          console.log('Loaded chat dialog with', chatState.messages.length, 'messages');
        } catch (error) {
          console.error('Error parsing chat dialog:', error);
          chatState.messages = [];
        }
      } else {
        chatState.messages = [];
      }
      
      // Update UI elements
      updateUIFromState();
      updateStepIndicators();
      
      // Switch to current step
      switchTab(state.currentStep);
      
      console.log('Meeting loaded from server:', meeting);
    } else {
      const errorMsg = result.error || 'Fel vid laddning av möte';
      handleError(errorMsg, result, true);
    }
  } catch (error) {
    const errorMsg = 'Fel vid laddning av möte: ' + error.message;
    handleError(errorMsg, error.details || error, true);
  }
}

// Removed switchToMeeting function - not needed with simplified interface

// Template filling is now handled by sendChatMessage and btnRegenerate

async function sendChatMessage() {
  const input = $('#chatInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  // Add user message
  addChatMessage(message, 'user');
  chatState.messages.push({ role: 'user', content: message });
  
  // Clear input
  input.value = '';
  
  // Show AI processing indicator
  showAIProcessingIndicator('chatting', 'AI bearbetar din fråga...', 'Genererar svar baserat på transkriptet');
  
  // Show processing
  const processingDiv = document.createElement('div');
  processingDiv.className = 'chat-message assistant';
  processingDiv.innerHTML = '<div class="loading-indicator"><div class="loading-spinner"></div>Bearbetar med AI...</div>';
  $('#chatMessages').appendChild(processingDiv);
  
  try {
    // Get agenda and extract template
    const agendaText = $('#agendaText').value;
    const transcript = state.transcript;
    
    if (!agendaText.trim()) {
      throw new Error('Ingen agenda hittad. Gå till steg 1 först.');
    }
    
    if (!transcript.trim()) {
      throw new Error('Inget transkript hittat. Gå till steg 3 först.');
    }
    
    // Extract template from agenda (second section)
    const { secondSection: template } = splitAgenda(agendaText);
    
    if (!template) {
      throw new Error('Kunde inte hitta mall-sektion i agendan. Kontrollera att agendan har två #-rubriker.');
    }
    
    // Prepare messages with full chat history
    const messages = [
      { role: 'system', content: settings.llmSystemPrompt }
    ];
    
    // Add initial context with template and transcript
    const initialContext = `MALL ATT FYLLA I:
${template}

MÖTESTRANSKRIPT:
${transcript}

VIKTIGT: Fyll i mallen baserat på transkriptet och instruktionerna som följer. Svara ALLTID med den ifyllda mallen som innehåller konkret information från mötet.`;
    
    messages.push({ role: 'user', content: initialContext });
    
    // Add all chat history
    chatState.messages.forEach(msg => {
      messages.push({ role: msg.role, content: msg.content });
    });
    
    // Add the new message
    messages.push({ role: 'user', content: message });
    
    // Call LLM with retry logic
    const result = await retryWithBackoff(async () => {
      const formData = new FormData();
      formData.append('action', 'llm_chat');
      formData.append('meetingId', state.meetingId);
      formData.append('messages', JSON.stringify(messages));
      formData.append('model', settings.llmModel);
      formData.append('temperature', settings.llmTemperature);
      
      const response = await safeFetch('index.php', {
        method: 'POST',
        body: formData
      }, 'LLM Chat');
      
      const result = await safeJsonParse(response, 'LLM Chat');
      
      if (!result.ok) {
        console.error('LLM chat error details:', result);
        
        // Handle rate limit specifically
        if (result.status === 429) {
          const errorMsg = 'Rate limit nådd för LLM. Försök igen om några minuter.';
          const details = {
            status: result.status,
            error: result.error,
            raw: result.raw
          };
          const error = new Error(errorMsg);
          error.details = details;
          throw error;
        }
        
        const errorMsg = result.error || 'LLM-fel';
        const details = {
          status: result.status,
          raw: result.raw
        };
        const error = new Error(errorMsg);
        error.details = details;
        throw error;
      }
      
      return result;
    });
    
    // Remove processing message
    processingDiv.remove();
    
    // Always treat the response as a filled template and show it in the right panel
    if (result.filledTemplate) {
      // Update filled template state
      state.filled = result.filledTemplate;
      
      // Show in right panel as rendered markdown
      const filledPreview = $('#filledPreview');
      if (filledPreview) {
        filledPreview.innerHTML = renderMarkdown(result.filledTemplate);
        renderMermaidDiagrams(filledPreview);
      }
      
      // Add simple confirmation message to chat
      addChatMessage('✅ Mall uppdaterad baserat på dina instruktioner', 'assistant');
      chatState.messages.push({ role: 'assistant', content: 'Mall uppdaterad' });
      
      // Save state and update indicators
      saveState();
      updateStepIndicators();
      
    } else if (result.response) {
      // Fallback: treat response as filled template
      state.filled = result.response;
      
      const filledPreview = $('#filledPreview');
      if (filledPreview) {
        filledPreview.innerHTML = renderMarkdown(result.response);
        renderMermaidDiagrams(filledPreview);
      }
      
      addChatMessage('✅ Mall uppdaterad baserat på dina instruktioner', 'assistant');
      chatState.messages.push({ role: 'assistant', content: 'Mall uppdaterad' });
      
      // Save chat dialog to server
      await saveChatToServer();
      
      saveState();
      updateStepIndicators();
      
    } else {
      addChatMessage('❌ Kunde inte uppdatera mallen. Försök igen.', 'system');
    }
    
  } catch (error) {
    processingDiv.remove();
    addChatMessage(`<strong>Fel:</strong> ${error.message}`, 'system');
    handleError(error.message, error.details || error, true);
  } finally {
    // Hide AI processing indicator
    hideAIProcessingIndicator();
  }
}

// Modal management
function openSettingsModal() {
  const settingsModal = $('#settingsModal');
  if (settingsModal) {
    settingsModal.style.display = 'block';
    updateSettingsUI();
  }
}

function closeSettingsModal() {
  const modal = $('#settingsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Close modal when clicking outside of it or pressing ESC
function setupModalCloseOnOutsideClick() {
  // Settings modal
  const settingsModal = $('#settingsModal');
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        closeSettingsModal();
      }
    });
  }
  
  // Meeting modal
  const meetingModal = $('#meetingModal');
  if (meetingModal) {
    meetingModal.addEventListener('click', (e) => {
      if (e.target === meetingModal) {
        closeMeetingModal();
      }
    });
  }
  
  // Close when pressing ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const settingsModal = $('#settingsModal');
      const meetingModal = $('#meetingModal');
      
      if (settingsModal && settingsModal.style.display === 'block') {
        closeSettingsModal();
      } else if (meetingModal && meetingModal.style.display === 'block') {
        closeMeetingModal();
      }
    }
  });
}

// Agenda modal management
async function openAgendaModal() {
  const agendaText = $('#agendaText').value;
  if (!agendaText.trim()) {
    toast('Ingen agenda att visa. Gå till steg 1 först.', 'warning');
    return;
  }
  
  // Show only first section (agenda) on step 2
  const { firstSection, secondSection } = splitAgenda(agendaText);
  console.log('Agenda modal - Full agenda text:', agendaText);
  console.log('Agenda modal - First section:', firstSection);
  console.log('Agenda modal - Second section:', secondSection);
  console.log('Agenda modal - First section length:', firstSection.length);
  
  const agendaContent = $('#agendaContent');
  
  if (firstSection && firstSection.trim()) {
    console.log('Using first section for agenda modal');
    agendaContent.innerHTML = renderMarkdown(firstSection);
  } else {
    console.log('No first section found, showing full agenda');
    agendaContent.innerHTML = renderMarkdown(agendaText);
  }
  
  const agendaModal = $('#agendaModal');
  if (agendaModal) {
    agendaModal.style.display = 'block';
  }
  
  // Render mermaid diagrams if any
  await renderMermaidDiagrams(agendaContent);
}

function closeAgendaModal() {
  const agendaModal = $('#agendaModal');
  if (agendaModal) {
    agendaModal.style.display = 'none';
  }
}

// Close preview modal
function closePreviewModal() {
  const modal = $('#previewModal');
  if (modal) {
    modal.remove();
  }
}

// Toggle collapsible section
function toggleCollapsible(sectionId) {
  const content = document.getElementById(sectionId);
  const arrow = content.previousElementSibling.querySelector('.collapsible-arrow');
  
  if (content.classList.contains('expanded')) {
    content.classList.remove('expanded');
    arrow.classList.remove('expanded');
  } else {
    content.classList.add('expanded');
    arrow.classList.add('expanded');
  }
}

async function refreshAgenda() {
  const agendaText = $('#agendaText').value;
  $('#agendaContent').innerHTML = renderMarkdown(agendaText);
  
  // Render mermaid diagrams if any
  await renderMermaidDiagrams($('#agendaContent'));
  
  toast('Agenda uppdaterad', 'success');
}

// Template management functions
async function loadTemplates() {
  try {
    const response = await fetch('templates/index.php');
    if (!response.ok) {
      console.log('Templates API not accessible, using fallback');
      loadFallbackTemplates();
      return;
    }
    
    const templates = await response.json();
    const templateSelect = $('#templateSelect');
    templateSelect.innerHTML = '<option value="">-- Välj en mall --</option>';
    
    templates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.filename;
      option.textContent = template.name;
      templateSelect.appendChild(option);
    });
    
  } catch (error) {
    console.log('Error loading templates:', error);
    loadFallbackTemplates();
  }
}

function loadFallbackTemplates() {
  const templateSelect = $('#templateSelect');
  templateSelect.innerHTML = `
    <option value="">-- Välj en mall --</option>
    <option value="veckomote.md">Veckomöte</option>
    <option value="projektstart.md">Projektstart</option>
    <option value="retrospektiv.md">Retrospektiv</option>
    <option value="strategimote.md">Strategimöte</option>
  `;
}

async function loadTemplate(templateName) {
  try {
    const response = await fetch(`templates/${templateName}`);
    if (!response.ok) {
      throw new Error('Template not found');
    }
    
    const content = await response.text();
    $('#agendaText').value = content;
    updateAgendaPreview(content);
    toast(`Mall "${templateName}" laddad`, 'success');
    updateStepIndicators();
    
  } catch (error) {
    const errorMsg = `Fel vid laddning av mall: ${error.message}`;
    handleError(errorMsg, error, true);
  }
}

// Load all audio files for current meeting
async function loadAudioFiles() {
  if (!state.meetingId) return;
  
  try {
    const response = await fetch(`index.php?action=list_audio_files&meetingId=${encodeURIComponent(state.meetingId)}`);
    const result = await response.json();
    
    if (result.ok && result.files) {
      displayAudioFiles(result.files);
    }
  } catch (error) {
    console.error('Error loading audio files:', error);
  }
}

// Display audio files in both step 2 and step 3
function displayAudioFiles(files) {
  const audioFilesList = $('#audioFilesList');
  const transcribeFilesList = $('#transcribeFilesList');
  const audioFileCount = $('#audioFileCount');
  const transcribeFileCount = $('#transcribeFileCount');
  
  if (audioFileCount) audioFileCount.textContent = files.length;
  if (transcribeFileCount) transcribeFileCount.textContent = files.length;
  
  if (files.length === 0) {
    if (audioFilesList) {
      audioFilesList.innerHTML = '<p class="muted">Inga filer ännu</p>';
    }
    if (transcribeFilesList) {
      transcribeFilesList.innerHTML = '<p class="muted">Inga ljudfiler uppladdade ännu</p>';
    }
    return;
  }
  
  const fileHTML = files.map(file => {
    const size = formatFileSize(file.size);
    const date = new Date(file.uploaded * 1000).toLocaleString('sv-SE');
    
    return `
      <div class="audio-file-item" data-filename="${file.filename}" data-path="${file.path}">
        <div class="audio-file-info">
          <div class="audio-file-name">🎵 ${file.filename}</div>
          <div class="audio-file-details">
            <span>${size}</span>
            <span>${date}</span>
          </div>
        </div>
        <div class="audio-file-actions">
          <button class="btn small" onclick="downloadAudioFile('${file.filename}')">⬇️ Ladda ner</button>
        </div>
      </div>
    `;
  }).join('');
  
  if (audioFilesList) {
    audioFilesList.innerHTML = fileHTML;
  }
  
  // For transcribe step, add transcribe button
  if (transcribeFilesList) {
    const transcribeHTML = files.map(file => {
      const size = formatFileSize(file.size);
      const date = new Date(file.uploaded * 1000).toLocaleString('sv-SE');
      
      return `
        <div class="audio-file-item" data-filename="${file.filename}" data-path="${file.path}">
          <div class="audio-file-info">
            <div class="audio-file-name">🎵 ${file.filename}</div>
            <div class="audio-file-details">
              <span>${size}</span>
              <span>${date}</span>
            </div>
          </div>
          <div class="audio-file-actions">
            <button class="btn small primary" onclick="transcribeFile('${file.path}', '${file.filename}')">🎤 Transkribera</button>
            <button class="btn small" onclick="downloadAudioFile('${file.filename}')">⬇️ Ladda ner</button>
          </div>
        </div>
      `;
    }).join('');
    
    transcribeFilesList.innerHTML = transcribeHTML;
  }
}

// Download specific audio file
function downloadAudioFile(filename) {
  if (!state.meetingId) {
    toast('Inget möte valt', 'error');
    return;
  }
  
  const url = `index.php?action=download_audio&meetingId=${encodeURIComponent(state.meetingId)}&filename=${encodeURIComponent(filename)}`;
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  toast('Ljudfil laddas ner...', 'success');
}

// Transcribe individual file
async function transcribeFile(path, filename) {
  const button = event.target;
  const originalText = button.textContent;
  
  try {
    button.textContent = 'Transkriberar...';
    button.disabled = true;
    
    const lang = $('#transcriptLang')?.value || 'sv';
    
    const result = await retryWithBackoff(async () => {
      const formData = new FormData();
      formData.append('action', 'transcribe');
      formData.append('meetingId', state.meetingId);
      formData.append('path', path);
      formData.append('filename', filename);
      formData.append('lang', lang);
      formData.append('append', 'true'); // Append to existing transcript
      
      const response = await safeFetch('index.php', {
        method: 'POST',
        body: formData
      }, `Transkribering av ${filename}`);
      
      const result = await safeJsonParse(response, `Transkribering av ${filename}`);
      
      if (!result.ok) {
        console.error('Transcription error details:', result);
        
        if (result.status === 429) {
          const errorMsg = 'Rate limit nådd. Försök igen om några minuter.';
          const details = {
            status: result.status,
            error: result.error,
            raw: result.raw,
            filename: filename
          };
          const error = new Error(errorMsg);
          error.details = details;
          throw error;
        }
        
        const errorMsg = result.error || 'Transkriberingsfel';
        const details = {
          status: result.status,
          raw: result.raw,
          filename: filename
        };
        const error = new Error(errorMsg);
        error.details = details;
        throw error;
      }
      
      return result;
    });
    
    // Update transcript with combined text
    state.transcript = result.transcript || '';
    const transcriptElement = $('#transcript');
    if (transcriptElement) {
      transcriptElement.value = state.transcript;
    }
    
    saveState();
    toast(`${filename} transkriberad`, 'success');
    updateStepIndicators();
    
    // Mark file as transcribed
    button.textContent = '✅ Klar';
    button.classList.remove('primary');
    
  } catch (error) {
    const errorMsg = error.message || 'Transkriberingsfel';
    handleError(errorMsg, error.details || error, true);
    button.textContent = originalText;
    button.disabled = false;
  }
}

// Clear all transcripts
async function clearAllTranscripts() {
  if (!confirm('Är du säker på att du vill rensa hela transkriptet?')) {
    return;
  }
  
  const transcriptElement = $('#transcript');
  if (transcriptElement) {
    transcriptElement.value = '';
    state.transcript = '';
    saveState();
    
    // Save empty transcript to server
    await saveTranscriptToServer();
    
    toast('Transkript rensat', 'success');
  }
}

// Audio upload functionality
async function handleAudioUpload(file) {
  if (!file) return;
  
  // Validate file type - only formats supported by Whisper API
  const allowedTypes = [
    'audio/flac', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 
    'audio/mp4', 'audio/m4a', 'audio/mpeg', 'audio/mpga', 'video/mp4'
  ];
  
  // Also check file extension as fallback
  const allowedExtensions = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
  const fileExtension = file.name.split('.').pop().toLowerCase();
  
  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
    // Suggest format conversion for common unsupported formats
    const conversionMap = {
      'aac': 'MP3',
      'aiff': 'WAV',
      'au': 'WAV', 
      'ra': 'WAV',
      'wma': 'MP3',
      'm4v': 'MP4',
      'mov': 'MP4',
      'avi': 'MP4'
    };
    
    const suggestedFormat = conversionMap[fileExtension.toLowerCase()];
    let errorMessage = `Ogiltigt ljudformat: ${fileExtension.toUpperCase()}. Stödda format: FLAC, M4A, MP3, MP4, MPEG, MPGA, OGA, OGG, WAV, WebM`;
    
    if (suggestedFormat) {
      errorMessage += `. Försök konvertera till ${suggestedFormat} format.`;
    }
    
    toast(errorMessage, 'error');
    return;
  }
  
  // Validate file size (max 100MB)
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    toast('Filen är för stor. Max storlek: 100MB', 'error');
    return;
  }
  
  try {
    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('meetingId', state.meetingId);
    formData.append('audio', file);
    
    const response = await fetch('index.php', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.error || 'Uppladdning misslyckades');
    }
    
    // Update state and UI
    state.uploaded = result;
    toast('Ljudfil uppladdad', 'success');
    updateStepIndicators();
    
    // Reload audio files list
    await loadAudioFiles();
    
  } catch (error) {
    toast(`Uppladdningsfel: ${error.message}`, 'error');
    console.error('Upload error:', error);
  }
}

function updateFileInfo(uploadResult, file) {
  console.log('File uploaded successfully:');
  console.log('- Filename:', uploadResult.filename);
  console.log('- Path:', uploadResult.path);
  console.log('- MIME:', uploadResult.mime);
  console.log('- Size:', formatFileSize(file.size));
  
  const uploadInfo = $('#uploadInfo');
  const fileInfo = $('#fileInfo');
  const audioActions = $('#audioActions');
  
  if (uploadInfo) uploadInfo.style.display = 'none';
  if (fileInfo) fileInfo.style.display = 'block';
  if (audioActions) audioActions.style.display = 'block';
  
  $('#fileName').textContent = uploadResult.filename;
  $('#fileSize').textContent = formatFileSize(file.size);
  $('#fileType').textContent = file.type;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Enhanced tab switching with progress tracking
function switchTab(id) {
  console.log('Switching to tab:', id);
  console.log('Current state before switch:', state);
  
  // Update tab states
  $$('.tab').forEach(t => {
    const isActive = t.dataset.tab === id;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive);
    t.setAttribute('tabindex', isActive ? '0' : '-1');
  });
  $$('.step').forEach(s => {
    const isVisible = s.id === id;
    s.style.display = isVisible ? 'block' : 'none';
    s.setAttribute('aria-hidden', !isVisible);
  });
  
  // Update current step
  state.currentStep = id;
  updateStepIndicators();
  
  // Auto-save current content when switching tabs
  saveCurrentContent();
  
  // Load audio files when entering record or transcribe step
  if (id === 'record' || id === 'transcribe') {
    loadAudioFiles();
  }
  
  // Special handling for template step - load transcript if needed
  if (id === 'template') {
    console.log('Entering template step, checking for transcript...');
    
    // Always ensure transcript is loaded and displayed
    const loadAndDisplayTranscript = async () => {
      let transcript = state.transcript;
      
      if (!transcript) {
        // Try to load from server
        transcript = await loadTranscriptFromServer(state.meetingId);
        if (transcript) {
          state.transcript = transcript;
          saveState();
        }
      }
      
      // Display in the collapsible transcript textarea on step 4
      const templateTranscriptElement = $('#templateTranscript');
      if (templateTranscriptElement) {
        templateTranscriptElement.value = transcript || '';
        console.log('Transcript displayed in template textarea:', transcript ? transcript.substring(0, 100) + '...' : 'Empty');
      } else {
        console.log('Template transcript element not found');
      }
      
      console.log('Transcript loaded and displayed:', transcript ? 'Yes' : 'No');
      console.log('Current state.transcript:', state.transcript ? state.transcript.substring(0, 100) + '...' : 'Empty');
    };
    
    loadAndDisplayTranscript();
  }
  
  // Transcript is now only shown in collapsible section
  
  console.log('State after switch:', state);
}

// Transcript is now only shown in the collapsible section below

// Update step indicators based on completion status
function updateStepIndicators() {
  const steps = ['agenda', 'record', 'transcribe', 'template', 'export'];
  steps.forEach((step, index) => {
    const tab = $(`#tab-${step}`);
    if (tab) {
      tab.classList.remove('completed', 'current');
      
      if (step === state.currentStep) {
        tab.classList.add('current');
      } else if (isStepCompleted(step)) {
        tab.classList.add('completed');
      }
    }
  });
}

// Check if a step is completed
function isStepCompleted(step) {
  switch (step) {
    case 'agenda':
      return $('#agendaText').value.trim() !== '';
    case 'record':
      return state.uploaded !== null;
    case 'transcribe':
      return state.transcript.trim() !== '';
    case 'template':
      return state.filled.trim() !== '';
    case 'export':
      return state.filled.trim() !== '';
    default:
      return false;
  }
}

// Save state to localStorage
function saveState() {
  try {
    localStorage.setItem('meetingState', JSON.stringify(state));
    console.log('State saved to localStorage:', state);
  } catch (error) {
    console.error('Error saving state to localStorage:', error);
  }
}

// Save agenda to server
async function saveAgendaToServer(agendaContent) {
  try {
    const formData = new FormData();
    formData.append('action', 'save_agenda');
    formData.append('meetingId', state.meetingId);
    formData.append('agendaContent', agendaContent);
    
    const response = await fetch('index.php', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    if (result.ok) {
      console.log('Agenda saved to server');
    } else {
      console.error('Failed to save agenda to server:', result.error);
    }
  } catch (error) {
    console.error('Error saving agenda to server:', error);
  }
}

// Save transcript to server
async function saveTranscriptToServer() {
  if (!state.meetingId) {
    toast('Inget möte valt', 'error');
    return;
  }
  
  const transcriptElement = $('#transcript');
  if (!transcriptElement) {
    toast('Inget transkript att spara', 'error');
    return;
  }
  
  const transcriptContent = transcriptElement.value;
  
  try {
    const formData = new FormData();
    formData.append('action', 'save_transcript');
    formData.append('meetingId', state.meetingId);
    formData.append('transcriptContent', transcriptContent);
    
    const response = await fetch('index.php', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    if (result.ok) {
      // Update state with new transcript
      state.transcript = transcriptContent;
      saveState();
      
      console.log('Transcript saved to server');
      toast('Transkript sparat', 'success');
      updateStepIndicators();
    } else {
      console.error('Failed to save transcript to server:', result.error);
      toast('Fel vid sparande av transkript', 'error');
    }
  } catch (error) {
    console.error('Error saving transcript to server:', error);
    toast('Fel vid sparande av transkript', 'error');
  }
}

// Save chat dialog to server
async function saveChatToServer() {
  if (!state.meetingId || chatState.messages.length === 0) return;
  
  try {
    const formData = new FormData();
    formData.append('action', 'save_chat');
    formData.append('meetingId', state.meetingId);
    formData.append('chatData', JSON.stringify(chatState.messages));
    
    const response = await fetch('index.php', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    if (result.ok) {
      console.log('Chat saved to server');
    } else {
      console.error('Failed to save chat to server:', result.error);
    }
  } catch (error) {
    console.error('Error saving chat to server:', error);
  }
}

// Save current content to state
function saveCurrentContent() {
  if (state.currentStep === 'agenda') {
    // Save agenda content to server
    const agendaText = $('#agendaText').value;
    if (agendaText && agendaText.trim()) {
      state.agenda = agendaText;
      saveAgendaToServer(agendaText);
    }
  } else if (state.currentStep === 'transcribe') {
    const transcriptElement = $('#transcript');
    if (transcriptElement) {
      const transcriptContent = transcriptElement.value;
      
      // Only save if content has changed
      if (transcriptContent !== state.transcript) {
        state.transcript = transcriptContent;
        console.log('Auto-saving transcript from transcribe step:', state.transcript.substring(0, 100) + '...');
        console.log('Transcript length:', state.transcript.length);
        
        // Save to server
        if (state.meetingId && transcriptContent) {
          const formData = new FormData();
          formData.append('action', 'save_transcript');
          formData.append('meetingId', state.meetingId);
          formData.append('transcriptContent', transcriptContent);
          
          fetch('index.php', {
            method: 'POST',
            body: formData
          }).then(response => response.json())
            .then(result => {
              if (result.ok) {
                console.log('Transcript auto-saved to server');
              }
            })
            .catch(error => console.error('Error auto-saving transcript:', error));
        }
        
        saveState();
      }
    } else {
      console.log('No transcript element found in transcribe step');
    }
  } else if (state.currentStep === 'template') {
    const filledElement = $('#filled');
    if (filledElement) {
      state.filled = filledElement.value;
    }
    
    // Show template section and transcript when entering step 4
    const agendaText = $('#agendaText').value;
    console.log('Agenda text:', agendaText);
    
    if (agendaText) {
      // Extract second section (template) using splitAgenda function
      const { firstSection, secondSection } = splitAgenda(agendaText);
      console.log('First section:', firstSection);
      console.log('Second section:', secondSection);
      
      if (secondSection) {
        // Show template in preview
        const templatePreview = $('#templatePreview');
        if (templatePreview) {
          templatePreview.innerHTML = renderMarkdown(secondSection);
          renderMermaidDiagrams(templatePreview);
        }
        
        // Pre-fill the filled template with template content
        const filledPreview = $('#filledPreview');
        if (filledPreview) {
          filledPreview.innerHTML = renderMarkdown(secondSection);
          renderMermaidDiagrams(filledPreview);
        }
      } else {
        console.log('No second section found');
        // Show error message
        const templatePreview = $('#templatePreview');
        if (templatePreview) {
          templatePreview.innerHTML = '<p class="muted">Ingen mall-sektion hittad. Kontrollera att agendan har två #-rubriker.</p>';
        }
      }
    }
    
    // Show transcript if available
    console.log('Step 4 - state.transcript:', state.transcript);
    console.log('Step 4 - transcript length:', state.transcript ? state.transcript.length : 0);
    
    // Try to load transcript from localStorage as fallback
    const savedState = localStorage.getItem('meetingState');
    if (savedState && !state.transcript) {
      try {
        const parsedState = JSON.parse(savedState);
        if (parsedState.transcript) {
          state.transcript = parsedState.transcript;
          console.log('Loaded transcript from localStorage:', state.transcript.substring(0, 100) + '...');
        }
      } catch (error) {
        console.error('Error loading transcript from localStorage:', error);
      }
    }
    
    // Also try to load transcript directly from transcribe step textarea
    const transcribeTextarea = $('#transcript');
    if (transcribeTextarea && transcribeTextarea.value && !state.transcript) {
      state.transcript = transcribeTextarea.value;
      console.log('Loaded transcript from transcribe textarea:', state.transcript.substring(0, 100) + '...');
    }
    
    const transcriptElement = $('#transcript');
    console.log('Step 4 - transcript element found:', !!transcriptElement);
    
    if (transcriptElement) {
      if (state.transcript && state.transcript.trim()) {
        transcriptElement.value = state.transcript;
        console.log('Transcript set in textarea:', state.transcript.substring(0, 100) + '...');
      } else {
        transcriptElement.value = '';
        console.log('No transcript content to set');
      }
    } else {
      console.log('Transcript element not found');
    }
  }
  
  // Save meeting state to server
  saveMeetingState();
}

// Save meeting state to server
function saveMeetingState() {
  const meetingData = {
    meetingId: state.meetingId,
    currentStep: state.currentStep,
    agenda: state.agenda || $('#agendaText')?.value || '',
    transcript: state.transcript || $('#transcript')?.value || '',
    filled: state.filled || '',
    uploaded: state.uploaded || null,
    settings: settings,
    timestamp: new Date().toISOString()
  };
  
  fetch('index.php?action=save_meeting_state', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(meetingData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.ok) {
      console.log('Meeting state saved successfully');
    } else {
      console.error('Failed to save meeting state:', data.error);
    }
  })
  .catch(error => {
    console.error('Error saving meeting state:', error);
  });
}

// Load transcript from server
function loadTranscriptFromServer(meetingId) {
  return fetch(`index.php?action=load_transcript&meetingId=${encodeURIComponent(meetingId)}`)
    .then(response => response.json())
    .then(data => {
      if (data.ok && data.transcript) {
        return data.transcript;
      }
      return null;
    })
    .catch(error => {
      console.error('Error loading transcript from server:', error);
      return null;
    });
}

// Load meeting state from server
function loadMeetingState(meetingId) {
  return fetch(`index.php?action=load_meeting_state&meetingId=${encodeURIComponent(meetingId)}`)
    .then(response => response.json())
    .then(data => {
      if (data.ok && data.meetingState) {
        const meetingState = data.meetingState;
        
        // Update state and set meetingId
        state.meetingId = meetingId;
        state.currentStep = meetingState.currentStep || 'agenda';
        state.agenda = meetingState.agenda || '';
        state.transcript = meetingState.transcript || '';
        state.filled = meetingState.filled || '';
        state.uploaded = meetingState.uploaded || null;
        
        // Update settings
        if (meetingState.settings) {
          Object.assign(settings, meetingState.settings);
          updateSettingsUI();
        }
        
        // Update UI elements
        updateUIFromState();
        
        console.log('Meeting state loaded successfully:', meetingState);
        return true;
      } else {
        console.log('No meeting state found, using defaults');
        return false;
      }
    })
    .catch(error => {
      const errorMsg = 'Error loading meeting state: ' + error.message;
      handleError(errorMsg, error, false); // Don't show modal for this, just log
      return false;
    });
}

// Update UI elements from state
function updateUIFromState() {
  // Update agenda
  const agendaTextarea = $('#agendaText');
  if (agendaTextarea && state.agenda) {
    agendaTextarea.value = state.agenda;
    updateAgendaPreview();
  }
  
  // Update transcript
  const transcriptTextarea = $('#transcript');
  if (transcriptTextarea && state.transcript) {
    transcriptTextarea.value = state.transcript;
  }
  
  // Update filled template
  const filledTextarea = $('#filled');
  if (filledTextarea && state.filled) {
    filledTextarea.value = state.filled;
  }
  
  // Update uploaded file info
  if (state.uploaded) {
    const uploadInfo = $('#uploadInfo');
    const fileInfo = $('#fileInfo');
    const audioActions = $('#audioActions');
    const fileName = $('#fileName');
    const fileSize = $('#fileSize');
    
    if (uploadInfo) uploadInfo.style.display = 'none';
    if (fileInfo) fileInfo.style.display = 'block';
    if (audioActions) audioActions.style.display = 'block';
    if (fileName) fileName.textContent = state.uploaded.filename;
    if (fileSize) fileSize.textContent = state.uploaded.mime;
    const fileType = $('#fileType');
    if (fileType) fileType.textContent = state.uploaded.mime;
  }
  
  // Update current step
  if (state.currentStep) {
    switchTab(state.currentStep);
  }
}

// Split agenda into two sections based on # headers
function splitAgenda(agendaText) {
  if (!agendaText.trim()) {
    return { firstSection: '', secondSection: '' };
  }
  
  const lines = agendaText.split('\n');
  console.log('All lines:', lines);
  
  let firstSectionStart = -1;
  let secondSectionStart = -1;
  
  // Find all # headers first
  const headerLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('# ')) {
      headerLines.push({ index: i, text: lines[i] });
      console.log(`Found header at line ${i}: "${lines[i]}"`);
    }
  }
  
  console.log('All headers found:', headerLines);
  
  // Look for the second # header (template section)
  for (let i = 0; i < headerLines.length; i++) {
    const line = headerLines[i].text.toLowerCase();
    console.log(`Checking header: "${line}"`);
    
    if (line.includes('protokoll') || line.includes('mall') || line.includes('template') || line.includes('dokumentation')) {
      secondSectionStart = headerLines[i].index;
      console.log(`Found second section at line ${secondSectionStart}`);
      break;
    }
  }
  
  // Fallback: if we didn't find specific patterns, use second # header
  if (secondSectionStart === -1) {
    console.log('Using fallback logic - looking for second # header');
    if (headerLines.length >= 2) {
      secondSectionStart = headerLines[1].index;
      console.log(`Fallback: second at ${secondSectionStart}`);
    }
  }
  
  let firstSection = '';
  let secondSection = '';
  
  console.log(`Final: firstSectionStart=${firstSectionStart}, secondSectionStart=${secondSectionStart}`);
  
  if (secondSectionStart !== -1) {
    // First section: from beginning to second # (exclusive)
    firstSection = lines.slice(0, secondSectionStart).join('\n');
    // Second section: from second # to end
    secondSection = lines.slice(secondSectionStart).join('\n');
  } else {
    // No second section found, use everything as first section
    firstSection = lines.slice(0).join('\n');
    console.log('No second section found, using entire document as first section');
  }
  
  console.log('First section result:', firstSection);
  console.log('Second section result:', secondSection);
  
  return { firstSection, secondSection };
}

// Advanced markdown renderer with full support
function renderMarkdown(text) {
  if (!text) return '';
  
  // Configure marked.js
  marked.setOptions({
    highlight: function(code, lang) {
      if (typeof hljs !== 'undefined') {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (err) {
            console.warn('Highlight.js error:', err);
          }
        }
        try {
          return hljs.highlightAuto(code).value;
        } catch (err) {
          return code;
        }
      }
      return code;
    },
    breaks: true,
    gfm: true, // GitHub Flavored Markdown
    tables: true,
    pedantic: false,
    sanitize: false,
    smartLists: true,
    smartypants: false
  });
  
  // Render markdown
  let html = marked.parse(text);
  
  // Process mermaid diagrams
  html = processMermaidDiagrams(html);
  
  return html;
}

// Process mermaid diagrams in the HTML
function processMermaidDiagrams(html) {
  const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g;
  let diagramCounter = 0;
  
  return html.replace(mermaidRegex, (match, diagramCode) => {
    const id = `mermaid-${++diagramCounter}`;
    return `<div class="mermaid" id="${id}">${diagramCode}</div>`;
  });
}

// Initialize mermaid diagrams
function initializeMermaid() {
  if (typeof mermaid !== 'undefined') {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#0077BC',
          primaryTextColor: '#FFFFFF',
          primaryBorderColor: '#008767',
          lineColor: '#FFCD37',
          sectionBkgColor: '#2C2C2E',
          altSectionBkgColor: '#1C1C1E',
          gridColor: '#3C3C3E',
          secondaryColor: '#008767',
          tertiaryColor: '#FFCD37'
        }
      });
    } catch (error) {
      console.warn('Mermaid initialization error:', error);
    }
  }
}

// Render mermaid diagrams in a container
async function renderMermaidDiagrams(container) {
  if (typeof mermaid === 'undefined') return;
  
  const mermaidElements = container.querySelectorAll('.mermaid');
  if (mermaidElements.length === 0) return;
  
  try {
    await mermaid.run({
      querySelector: '.mermaid'
    });
  } catch (error) {
    console.warn('Mermaid rendering error:', error);
  }
}

// Enhanced agenda import with markdown preview
async function importAgenda(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    $('#agendaText').value = text;
    updateAgendaPreview(text);
    
    // Save agenda to server
    const formData = new FormData();
    formData.append('action', 'save_agenda');
    formData.append('meetingId', state.meetingId);
    formData.append('agendaContent', text);
    
    const response = await fetch('index.php', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    if (result.ok) {
      console.log('Agenda saved to server');
    } else {
      console.error('Failed to save agenda to server:', result.error);
    }
    
    toast('Agenda importerad', 'success');
    updateStepIndicators();
  } catch (error) {
    toast('Fel vid import av agenda', 'error');
    console.error('Import error:', error);
  }
}

// Update agenda preview with markdown rendering
async function updateAgendaPreview(text) {
  const preview = $('#agendaPreview');
  if (text.trim()) {
    // Show full agenda (both sections) on step 1
    preview.innerHTML = renderMarkdown(text);
    preview.classList.add('markdown-content');
    
    // Render mermaid diagrams if any
    await renderMermaidDiagrams(preview);
  } else {
    preview.textContent = 'Förhandsgranskning visas här...';
    preview.classList.remove('markdown-content');
  }
}

// Retry function with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message.includes('Rate limit') && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i); // Exponential backoff
        console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${i + 1}/${maxRetries})`);
        toast(`Rate limit nådd, försöker igen om ${Math.ceil(delay/1000)} sekunder...`, 'warning');
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

// Enhanced transcription with progress indication
async function transcribe() {
  if (!state.uploaded) {
    toast('Ladda upp/spela in audio först', 'error');
    return;
  }
  
  const button = $('#btnTranscribe');
  const originalText = button.textContent;
  
  try {
    // Show loading state
    button.classList.add('loading');
    button.disabled = true;
    
    // Show AI processing indicator
    showAIProcessingIndicator('transcribing', 'Transkriberar ljudfil...', 'Detta kan ta några minuter beroende på filstorlek');
    
    const result = await retryWithBackoff(async () => {
      const formData = new FormData();
      formData.append('action', 'transcribe');
      formData.append('meetingId', state.meetingId);
      formData.append('path', state.uploaded.path);
      formData.append('lang', $('#transcriptLang').value || 'sv');
      
      const response = await safeFetch('index.php', {
        method: 'POST',
        body: formData
      }, 'Transkribering');
      
      const result = await safeJsonParse(response, 'Transkribering');
      
      if (!result.ok) {
        console.error('Transcription error details:', result);
        
        // Handle rate limit specifically
        if (result.status === 429) {
          const errorMsg = 'Rate limit nådd. Försök igen om några minuter.';
          const details = {
            status: result.status,
            error: result.error,
            raw: result.raw
          };
          const error = new Error(errorMsg);
          error.details = details;
          throw error;
        }
        
        const errorMsg = result.error || 'Transkriberingsfel';
        const details = {
          status: result.status,
          raw: result.raw
        };
        const error = new Error(errorMsg);
        error.details = details;
        throw error;
      }
      
      return result;
    });
    
    state.transcript = result.transcript || '';
    const transcriptElement = $('#transcript');
    if (transcriptElement) {
      transcriptElement.value = state.transcript;
    }
    console.log('Transcript saved after transcription:', state.transcript);
    console.log('State after transcription:', state);
    saveState();
    toast('Transkription klar', 'success');
    updateStepIndicators();
    
  } catch (error) {
    const errorMsg = error.message || 'Transkriberingsfel';
    handleError(errorMsg, error.details || error, true);
  } finally {
    // Hide loading state
    button.classList.remove('loading');
    button.textContent = originalText;
    button.disabled = false;
    
    // Hide AI processing indicator
    hideAIProcessingIndicator();
  }
}

// Enhanced template filling with progress indication
async function fillTemplate() {
  const template = $('#templateText').value;
  if (!template) {
    toast('Ladda mall först', 'error');
    return;
  }
  
  const button = $('#btnFill');
  const originalText = button.textContent;
  
  try {
    button.textContent = 'Genererar...';
    button.disabled = true;
    
    const formData = new FormData();
    formData.append('action', 'llm_fill');
    formData.append('meetingId', state.meetingId);
    formData.append('templateMarkdown', template);
    formData.append('systemPrompt', $('#systemPrompt').value);
    formData.append('taskPrompt', $('#taskPrompt').value);
    formData.append('model', settings.llmModel);
    formData.append('temperature', settings.llmTemperature);
    formData.append('apiKey', settings.llmApiKey);
    formData.append('apiUrl', settings.llmApiUrl);
    
    const response = await fetch('index.php', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.error || 'LLM-fel');
    }
    
    state.filled = result.filledMarkdown || '';
    $('#filled').value = state.filled;
    updateFilledPreview(state.filled);
    toast('Mallen är ifylld', 'success');
    updateStepIndicators();
    
  } catch (error) {
    toast(error.message || 'LLM-fel', 'error');
    console.error('Template filling error:', error);
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

// Update filled template preview
async function updateFilledPreview(text) {
  // Add a preview area if it doesn't exist
  let preview = $('#filledPreview');
  if (!preview) {
    const container = $('#filled').parentNode;
    preview = document.createElement('div');
    preview.id = 'filledPreview';
    preview.className = 'markdown-content';
    preview.style.marginTop = '12px';
    container.appendChild(preview);
  }
  
  if (text.trim()) {
    preview.innerHTML = renderMarkdown(text);
    if (preview) preview.style.display = 'block';
    
    // Render mermaid diagrams if any
    await renderMermaidDiagrams(preview);
  } else {
    if (preview) preview.style.display = 'none';
  }
}

// Enhanced section refinement
async function refineSection() {
  const name = $('#refineSectionName').value.trim();
  if (!name) {
    toast('Ange sektionsnamn', 'error');
    return;
  }
  
  const button = $('#btnRefine');
  const originalText = button.textContent;
  
  try {
    button.textContent = 'Förfinar...';
    button.disabled = true;
    
    const formData = new FormData();
    formData.append('action', 'llm_refine');
    formData.append('meetingId', state.meetingId);
    formData.append('sectionName', name);
    formData.append('sectionText', $('#refineSectionText').value);
    formData.append('instructions', $('#refineInstructions').value);
    formData.append('systemPrompt', $('#systemPrompt').value);
    formData.append('model', settings.llmModel);
    formData.append('temperature', settings.llmTemperature);
    formData.append('apiKey', settings.llmApiKey);
    formData.append('apiUrl', settings.llmApiUrl);
    
    const response = await fetch('index.php', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.error || 'Refine-fel');
    }
    
    $('#refineResult').value = result.updatedSection;
    toast('Sektionen uppdaterad', 'success');
    
  } catch (error) {
    toast(error.message || 'Refine-fel', 'error');
    console.error('Refinement error:', error);
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

// Export document
function exportDoc(format) {
  if (!state.meetingId) {
    toast('Inget möte valt', 'error');
    return;
  }
  
  const filename = state.meetingId;
  
  window.location = `index.php?action=export&meetingId=${encodeURIComponent(state.meetingId)}&format=${encodeURIComponent(format)}&filename=${encodeURIComponent(filename)}`;
}

// Export all data as ZIP
function exportAll() {
  if (!state.meetingId) {
    toast('Inget möte valt', 'error');
    return;
  }
  
  const filename = state.meetingId;
  
  console.log('Exporting ZIP for meeting:', state.meetingId);
  console.log('Filename:', filename);
  
  window.location = `index.php?action=export_all&meetingId=${encodeURIComponent(state.meetingId)}&filename=${encodeURIComponent(filename)}`;
}

// Export as Word document
function exportWord() {
  if (!state.meetingId) {
    toast('Inget möte valt', 'error');
    return;
  }
  
  const filename = state.meetingId;
  
  window.location = `index.php?action=export_word&meetingId=${encodeURIComponent(state.meetingId)}&filename=${encodeURIComponent(filename)}`;
}

// Meeting Manager functions
function openMeetingModal() {
  const modal = $('#meetingModal');
  if (modal) {
    modal.style.display = 'block';
    
    // Show/hide current meeting section
    const currentMeetingSection = $('#currentMeetingSection');
    const currentMeetingIdDisplay = $('#currentMeetingIdDisplay');
    const renameMeetingInput = $('#renameMeetingInput');
    
    if (state.meetingId && currentMeetingSection) {
      currentMeetingSection.style.display = 'block';
      if (currentMeetingIdDisplay) {
        currentMeetingIdDisplay.textContent = state.meetingId;
      }
      if (renameMeetingInput) {
        renameMeetingInput.value = state.meetingId;
        renameMeetingInput.placeholder = `Nytt namn (nuvarande: ${state.meetingId})`;
      }
    } else if (currentMeetingSection) {
      currentMeetingSection.style.display = 'none';
    }
    
    loadMeetings();
  }
}

function closeMeetingModal() {
  const modal = $('#meetingModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function loadMeetings() {
  const meetingList = $('#meetingList');
  if (!meetingList) return;
  
  meetingList.innerHTML = '<div class="loading">Laddar möten...</div>';
  
  fetch('index.php?action=list_meetings')
    .then(response => response.json())
    .then(data => {
      if (data.ok && data.meetings) {
        displayMeetings(data.meetings);
      } else {
        meetingList.innerHTML = '<div class="no-meetings"><h4>Inga möten hittades</h4><p>Skapa ditt första möte genom att börja med steg 1.</p></div>';
      }
    })
    .catch(error => {
      const errorMsg = 'Fel vid laddning av möten: ' + error.message;
      handleError(errorMsg, error, false); // Don't show modal for this
      meetingList.innerHTML = '<div class="no-meetings"><h4>Fel vid laddning</h4><p>Kunde inte ladda möten. Försök igen.</p></div>';
    });
}

function displayMeetings(meetings) {
  const meetingList = $('#meetingList');
  if (!meetingList) return;
  
  if (meetings.length === 0) {
    meetingList.innerHTML = '<div class="no-meetings"><h4>Inga möten hittades</h4><p>Skapa ditt första möte genom att börja med steg 1.</p></div>';
    return;
  }
  
  const currentMeetingId = state.meetingId;
  
  meetingList.innerHTML = meetings.map(meeting => {
    // Handle both timestamp (number) and date string formats
    let createdDate = 'Okänt';
    let modifiedDate = 'Okänt';
    
    try {
      if (typeof meeting.created === 'number') {
        createdDate = new Date(meeting.created * 1000).toLocaleDateString('sv-SE');
      } else if (typeof meeting.created === 'string') {
        createdDate = new Date(meeting.created).toLocaleDateString('sv-SE');
      }
    } catch (e) {
      console.error('Error parsing created date:', meeting.created, e);
    }
    
    try {
      if (typeof meeting.modified === 'number') {
        modifiedDate = new Date(meeting.modified * 1000).toLocaleDateString('sv-SE');
      } else if (typeof meeting.modified === 'string') {
        modifiedDate = new Date(meeting.modified).toLocaleDateString('sv-SE');
      }
    } catch (e) {
      console.error('Error parsing modified date:', meeting.modified, e);
    }
    
    // Determine status
    let status = 'empty';
    let statusText = 'Tomt';
    
    if (meeting.hasFilled) {
      status = 'completed';
      statusText = 'Klart';
    } else if (meeting.hasTranscript) {
      status = 'in-progress';
      statusText = 'Pågår';
    } else if (meeting.hasAgenda) {
      status = 'in-progress';
      statusText = 'Pågår';
    }
    
    const isCurrent = meeting.id === currentMeetingId;
    
    return `
      <div class="meeting-item ${isCurrent ? 'current' : ''}" data-meeting-id="${meeting.id}">
        <div class="meeting-info">
          <div class="meeting-id">${meeting.id}</div>
          <div class="meeting-details">
            <span>Skapad: ${createdDate}</span>
            <span>Ändrad: ${modifiedDate}</span>
          </div>
        </div>
        <div class="meeting-status">
          <div class="status-dot ${status}"></div>
          <span>${statusText}</span>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click listeners to meeting items
  meetingList.querySelectorAll('.meeting-item').forEach(item => {
    item.addEventListener('click', () => {
      const meetingId = item.dataset.meetingId;
      if (meetingId && meetingId.trim() !== '' && meetingId !== currentMeetingId) {
        switchToMeeting(meetingId);
      } else if (!meetingId || meetingId.trim() === '') {
        const errorMsg = 'Ogiltigt mötes-ID i möteslista';
        handleError(errorMsg, {meetingId: meetingId}, true);
      }
    });
  });
}

function switchToMeeting(meetingId) {
  if (!meetingId || meetingId.trim() === '') {
    const errorMsg = 'Ogiltigt mötes-ID för byte';
    handleError(errorMsg, {meetingId: meetingId}, true);
    return;
  }
  
  // Validate meeting ID format
  if (!/^[a-zA-Z0-9_-]+$/.test(meetingId)) {
    const errorMsg = 'Ogiltigt mötes-ID format för byte';
    handleError(errorMsg, {meetingId: meetingId}, true);
    return;
  }
  
  // Update URL with meeting parameter
  const url = new URL(window.location);
  url.searchParams.set('meeting', meetingId);
  window.location.href = url.toString();
}

// Update meeting ID display
function updateMeetingIdDisplay(meetingId) {
  const meetingIdElement = $('#meetingId');
  if (meetingIdElement) {
    meetingIdElement.textContent = meetingId;
  }
  // Update state
  state.meetingId = meetingId;
}

// Rename meeting directory from modal
async function renameMeeting() {
  if (!state.meetingId) {
    toast('Inget möte valt', 'error');
    return;
  }
  
  const renameMeetingInput = $('#renameMeetingInput');
  if (!renameMeetingInput) return;
  
  const newName = renameMeetingInput.value.trim();
  
  if (!newName || newName === state.meetingId) {
    toast('Ange ett nytt namn', 'warning');
    return;
  }
  
  // Validate name
  if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
    toast('Ogiltigt namn. Använd endast bokstäver, siffror, bindestreck och understreck.', 'error');
    return;
  }
  
  if (!confirm(`Är du säker på att du vill byta namn på mötet från "${state.meetingId}" till "${newName}"?\n\nDetta kommer att uppdatera URL:en och mappen.`)) {
    return;
  }
  
  try {
    const formData = new FormData();
    formData.append('action', 'rename_meeting');
    formData.append('oldMeetingId', state.meetingId);
    formData.append('newMeetingId', newName);
    
    const response = await fetch('index.php', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.ok) {
      toast('Möte bytte namn! Laddar om...', 'success');
      closeMeetingModal();
      
      // Redirect to new meeting URL
      setTimeout(() => {
        window.location.href = `?meeting=${encodeURIComponent(result.newMeetingId)}`;
      }, 1000);
    } else {
      toast(result.error || 'Fel vid namnbyte', 'error');
    }
  } catch (error) {
    toast('Fel vid namnbyte', 'error');
    console.error('Rename meeting error:', error);
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  init();
  switchTab('agenda');
  
  // Tab navigation with null checks and keyboard support
  const tabAgenda = $('#tab-agenda');
  const tabRecord = $('#tab-record');
  const tabTranscribe = $('#tab-transcribe');
  const tabTemplate = $('#tab-template');
  const tabExport = $('#tab-export');
  
  const tabs = [tabAgenda, tabRecord, tabTranscribe, tabTemplate, tabExport];
  const tabIds = ['agenda', 'record', 'transcribe', 'template', 'export'];
  
  tabs.forEach((tab, index) => {
    if (tab) {
      tab.onclick = () => switchTab(tabIds[index]);
      tab.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          switchTab(tabIds[index]);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nextIndex = (index + 1) % tabs.length;
          switchTab(tabIds[nextIndex]);
          tabs[nextIndex]?.focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prevIndex = (index - 1 + tabs.length) % tabs.length;
          switchTab(tabIds[prevIndex]);
          tabs[prevIndex]?.focus();
        }
      };
    }
  });
  
  // File imports with null checks
  const agendaFile = $('#agendaFile');
  const templateFile = $('#templateFile');
  
  if (agendaFile) agendaFile.addEventListener('change', importAgenda);
  if (templateFile) {
    templateFile.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        $('#templateText').value = await file.text();
        toast('Mall inläst', 'success');
      } catch (error) {
        toast('Fel vid import av mall', 'error');
      }
    });
  }
  
  // Template selection with null check
  const templateSelect = $('#templateSelect');
  if (templateSelect) {
    templateSelect.addEventListener('change', async e => {
      const selectedTemplate = e.target.value;
      if (selectedTemplate) {
        await loadTemplate(selectedTemplate);
      }
    });
  }
  
  // Real-time preview updates with null checks
  const agendaText = $('#agendaText');
  const templateText = $('#templateText');
  
  if (agendaText) {
    agendaText.addEventListener('input', e => {
      updateAgendaPreview(e.target.value);
      updateStepIndicators();
    });
  }
  
  if (templateText) {
    templateText.addEventListener('input', e => {
      updateFilledPreview(e.target.value);
    });
  }
  
  // Action buttons with null checks
  const btnTranscribe = $('#btnTranscribe');
  const btnSaveTranscript = $('#btnSaveTranscript');
  const btnClearTranscript = $('#btnClearTranscript');
  const btnFill = $('#btnFill');
  const btnRefine = $('#btnRefine');
  const btnExportMd = $('#btnExportMd');
  const btnExportJson = $('#btnExportJson');
  
  if (btnTranscribe) btnTranscribe.onclick = transcribe;
  if (btnSaveTranscript) btnSaveTranscript.onclick = saveTranscriptToServer;
  if (btnClearTranscript) btnClearTranscript.onclick = clearAllTranscripts;
  if (btnFill) btnFill.onclick = fillTemplate;
  if (btnRefine) btnRefine.onclick = refineSection;
  if (btnExportMd) btnExportMd.onclick = () => exportDoc('md');
  
  // New export buttons
  const btnExportZip = $('#btnExportZip');
  const btnExportWord = $('#btnExportWord');
  
  if (btnExportZip) btnExportZip.onclick = exportAll;
  if (btnExportWord) btnExportWord.onclick = exportWord;
  
  // Meeting Manager event listeners
  const meetingIdBadge = $('#meetingIdBadge');
  const closeMeetingModalBtn = $('#closeMeetingModal');
  const closeMeetingBtn = $('#closeMeetingBtn');
  const refreshMeetings = $('#refreshMeetings');
  const newMeetingFromModal = $('#newMeetingFromModal');
  
  if (meetingIdBadge) meetingIdBadge.onclick = openMeetingModal;
  if (closeMeetingModalBtn) closeMeetingModalBtn.onclick = closeMeetingModal;
  if (closeMeetingBtn) closeMeetingBtn.onclick = closeMeetingModal;
  if (refreshMeetings) refreshMeetings.onclick = loadMeetings;
  if (newMeetingFromModal) newMeetingFromModal.onclick = () => {
    closeMeetingModal();
    createNewMeeting();
  };
  
  // Theme toggle with null check
  const themeBtn = $('#themeBtn');
  if (themeBtn) themeBtn.onclick = toggleTheme;
  
  // Settings modal with null checks
  const settingsBtn = $('#settingsBtn');
  const closeSettings = $('#closeSettings');
  const closeSettingsFooter = $('#closeSettingsFooter');
  const saveSettings = $('#saveSettings');
  const resetSettings = $('#resetSettings');
  const settingsModal = $('#settingsModal');
  
  if (settingsBtn) settingsBtn.onclick = openSettingsModal;
  if (closeSettings) closeSettings.onclick = closeSettingsModal;
  if (closeSettingsFooter) closeSettingsFooter.onclick = closeSettingsModal;
  if (saveSettings) {
    saveSettings.onclick = () => {
      collectSettingsFromUI();
      saveSettings();
      closeSettingsModal();
    };
  }
  if (resetSettings) resetSettings.onclick = resetSettings;
  
  // Close modal when clicking outside
  if (settingsModal) {
    settingsModal.onclick = (e) => {
      if (e.target === settingsModal) {
        closeSettingsModal();
      }
    };
  }
  
  // Agenda modal with null checks
  const btnShowAgenda = $('#btnShowAgenda');
  const closeAgenda = $('#closeAgenda');
  const closeAgendaBtn = $('#closeAgendaBtn');
  const refreshAgenda = $('#refreshAgenda');
  const agendaModal = $('#agendaModal');
  
  if (btnShowAgenda) btnShowAgenda.onclick = openAgendaModal;
  if (closeAgenda) closeAgenda.onclick = closeAgendaModal;
  if (closeAgendaBtn) closeAgendaBtn.onclick = closeAgendaModal;
  if (refreshAgenda) refreshAgenda.onclick = refreshAgenda;
  
  if (agendaModal) {
    agendaModal.onclick = (e) => {
      if (e.target === agendaModal) {
        closeAgendaModal();
      }
    };
  }
  
  // Audio upload with null check
  const audioUpload = $('#audioUpload');
  if (audioUpload) {
    audioUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handleAudioUpload(file);
      }
    });
  }
  
  // Rename meeting functionality in modal
  const renameMeetingBtn = $('#renameMeetingBtn');
  const renameMeetingInput = $('#renameMeetingInput');
  
  if (renameMeetingBtn) renameMeetingBtn.onclick = renameMeeting;
  
  if (renameMeetingInput) {
    renameMeetingInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        renameMeeting();
      }
    });
  }
  
  // Chat functionality with null checks
  const btnSendChat = $('#btnSendChat');
  const btnClearChat = $('#btnClearChat');
  const chatInput = $('#chatInput');
  
  if (btnSendChat) btnSendChat.onclick = sendChatMessage;
  if (btnClearChat) btnClearChat.onclick = clearChat;
  
  // No longer need fill template button - chat always fills template
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }
  
  // Preview filled template with null check
  const btnPreviewFilled = $('#btnPreviewFilled');
  if (btnPreviewFilled) {
    btnPreviewFilled.onclick = async () => {
      const filledPreview = $('#filledPreview');
      if (!filledPreview || !filledPreview.innerHTML.trim()) {
        toast('Ingen ifylld mall att visa', 'warning');
        return;
      }
      
      // Create preview modal similar to agenda modal
      const previewModal = document.createElement('div');
      previewModal.className = 'modal';
      previewModal.id = 'previewModal';
      previewModal.style.display = 'block';
      previewModal.innerHTML = `
        <div class="modal-content agenda-modal">
          <div class="modal-header">
            <h2>👁️ Förhandsgranskning - Ifylld mall</h2>
            <button class="modal-close" onclick="closePreviewModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="markdown-content" id="previewContent"></div>
          </div>
          <div class="modal-footer">
            <button class="btn primary" onclick="closePreviewModal()">Stäng</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(previewModal);
      
      // Copy the rendered content from filledPreview
      const previewContent = previewModal.querySelector('#previewContent');
      previewContent.innerHTML = filledPreview.innerHTML;
      
      // Close modal when clicking outside
      previewModal.onclick = (e) => {
        if (e.target === previewModal) {
          closePreviewModal();
        }
      };
    };
  }
  
  // Regenerate template with null check
  const btnRegenerate = $('#btnRegenerate');
  if (btnRegenerate) {
    btnRegenerate.onclick = async () => {
    if (!state.transcript.trim()) {
      toast('Inget transkript att använda', 'warning');
      return;
    }
    
    const agendaText = $('#agendaText').value;
    if (!agendaText.trim()) {
      toast('Ingen agenda hittad', 'warning');
      return;
    }
    
    // Extract template using splitAgenda function
    const { secondSection: template } = splitAgenda(agendaText);
    
    if (!template) {
      toast('Kunde inte hitta mall-sektion i agendan', 'error');
      return;
    }
    
    // Use same logic as sendChatMessage but without user input
    try {
      const formData = new FormData();
      formData.append('action', 'llm_fill');
      formData.append('meetingId', state.meetingId);
      formData.append('templateMarkdown', template);
      formData.append('systemPrompt', settings.llmSystemPrompt);
      formData.append('taskPrompt', 'Fyll i mallen baserat på transkriptet. Använd information från mötet för att fylla i alla sektioner.');
      
      const response = await fetch('index.php', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Fel vid mall-fyllning');
      }
      
      // Update filled template
      state.filled = result.filledMarkdown || '';
      const filledPreview = $('#filledPreview');
      if (filledPreview) {
        filledPreview.innerHTML = renderMarkdown(state.filled);
        renderMermaidDiagrams(filledPreview);
      }
      
      // Save chat dialog to server
      await saveChatToServer();
      
      // Save state
      saveState();
      
      toast('Mall genererad om', 'success');
      updateStepIndicators();
      
    } catch (error) {
      handleError(error.message || 'Fel vid omgenerering', error, true);
    }
    };
  }
  
  // Error modal event listeners
  $('#closeErrorModal').addEventListener('click', hideErrorModal);
  $('#closeErrorBtn').addEventListener('click', hideErrorModal);
  
  $('#copyErrorBtn').addEventListener('click', () => {
    const errorMessage = $('#errorMessage').textContent;
    const errorDetails = $('#errorDetails').textContent;
    const errorText = `Fel: ${errorMessage}\n\nDetaljer:\n${errorDetails}`;
    
    navigator.clipboard.writeText(errorText).then(() => {
      toast('Fel kopierat till urklipp', 'success');
    }).catch(() => {
      toast('Kunde inte kopiera fel', 'error');
    });
  });
  
  $('#viewErrorLogBtn').addEventListener('click', () => {
    if (state.meetingId) {
      const errorLogUrl = `index.php?action=download_error_log&meetingId=${state.meetingId}`;
      window.open(errorLogUrl, '_blank');
    } else {
      toast('Inget aktivt möte', 'error');
    }
  });
  
  // Close error modal when clicking outside
  $('#errorModal').addEventListener('click', (e) => {
    if (e.target === $('#errorModal')) {
      hideErrorModal();
    }
  });
});
