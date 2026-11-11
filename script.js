/* ================= БАЗА ДАННЫХ ================= */
let db;
const dbRequest = indexedDB.open('LumivoDB', 1);
dbRequest.onupgradeneeded = e => { db = e.target.result; if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' }); };
dbRequest.onsuccess = e => { db = e.target.result; initApp(); };
dbRequest.onerror = e => console.error('Ошибка IndexedDB:', e);

function saveFileToDB(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put({ id: fileId, name: file.name, type: file.type, size: file.size, data: event.target.result });
      tx.oncomplete = () => resolve(fileId);
      tx.onerror = () => reject(tx.error);
    };
    reader.readAsDataURL(file);
  });
}
function getFileFromDB(fileId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readonly');
    const request = tx.objectStore('files').get(fileId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ================= ДАННЫЕ (ТОЛЬКО БОТ) ================= */
const defaultChats = [
  { id: 'bot', name: 'Lumivo Bot', avatar: '🤖', phone: '@lumivo_bot', isBot: true, botState: 'unstarted', messages: [], reports: [] }
];
const defaultStatuses = [];

let chats = [], statuses = [], activeChatId = null, viewerState = { items: [], index: 0, timer: null };

/* ================= DOM ================= */
const chatListEl = document.getElementById('chatList'), chatAreaEl = document.getElementById('chatArea'), sidebarEl = document.getElementById('sidebar');
const messagesEl = document.getElementById('messages'), messageFormEl = document.getElementById('messageForm'), messageInputEl = document.getElementById('messageInput');
const startContainer = document.getElementById('startContainer'), startBotBtn = document.getElementById('startBotBtn');
const attachBtn = document.getElementById('attachBtn'), fileInput = document.getElementById('fileInput');
const chatNameEl = document.getElementById('chatName'), chatAvatarEl = document.getElementById('chatAvatar'), chatStatusEl = document.getElementById('chatStatus'), officialBadge = document.getElementById('officialBadge');
const searchInputEl = document.getElementById('searchInput'), newChatBtn = document.getElementById('newChatBtn'), backBtn = document.getElementById('backBtn');
const statusListEl = document.getElementById('statusList'), chatsTabEl = document.getElementById('chatsTab'), statusesTabEl = document.getElementById('statusesTab'), addStatusBtn = document.getElementById('addStatusBtn');
const statusViewerEl = document.getElementById('statusViewer'), statusProgress = document.getElementById('statusProgress'), viewerAvatarEl = document.getElementById('viewerAvatar');
const viewerNameEl = document.getElementById('viewerName'), viewerTimeEl = document.getElementById('viewerTime'), statusContent = document.getElementById('statusContent');
const closeStatusBtn = document.getElementById('closeStatusBtn'), navPrev = document.getElementById('navPrev'), navNext = document.getElementById('navNext');
const statusViewersList = document.getElementById('statusViewersList'), viewersContainer = document.getElementById('viewersContainer');
const contactModal = document.getElementById('contactModal'), contactName = document.getElementById('contactName'), contactPhone = document.getElementById('contactPhone');
const countryCode = document.getElementById('countryCode'), cancelContact = document.getElementById('cancelContact'), saveContact = document.getElementById('saveContact');
const statusUploader = document.getElementById('statusUploader'), textModeBtn = document.getElementById('textModeBtn'), imageModeBtn = document.getElementById('imageModeBtn');
const statusTextEl = document.getElementById('statusText'), statusImageEl = document.getElementById('statusImage'), cancelUpload = document.getElementById('cancelUpload'), postStatusBtn = document.getElementById('postStatus');
const audioCallBtn = document.getElementById('audioCallBtn'), videoCallBtn = document.getElementById('videoCallBtn'), callScreen = document.getElementById('callScreen');
const callAvatar = document.getElementById('callAvatar'), callName = document.getElementById('callName'), callStatus = document.getElementById('callStatus'), callTimer = document.getElementById('callTimer');
const videoContainer = document.getElementById('videoContainer'), localVideo = document.getElementById('localVideo'), remoteVideo = document.getElementById('remoteVideo');
const endCallBtn = document.getElementById('endCallBtn'), muteBtn = document.getElementById('muteBtn'), camBtn = document.getElementById('camBtn');
const chatMenuBtn = document.getElementById('chatMenuBtn'), chatMenu = document.getElementById('chatMenu');
const menuWallpaper = document.getElementById('menuWallpaper'), menuReport = document.getElementById('menuReport'), menuClearMe = document.getElementById('menuClearMe'), menuClearAll = document.getElementById('menuClearAll'), menuDeleteChat = document.getElementById('menuDeleteChat');
const reportModal = document.getElementById('reportModal'), reportReason = document.getElementById('reportReason'), cancelReport = document.getElementById('cancelReport'), submitReport = document.getElementById('submitReport');
const blockedOverlay = document.getElementById('blockedOverlay'), blockedReasonText = document.getElementById('blockedReasonText');
const wallpaperModal = document.getElementById('wallpaperModal'), customWallBtn = document.getElementById('customWallBtn'), wallpaperInput = document.getElementById('wallpaperInput'), cancelWallpaper = document.getElementById('cancelWallpaper');

/* ================= УТИЛИТЫ ================= */
function initApp() {
  chats = JSON.parse(localStorage.getItem('lumivo_chats')) || defaultChats;
  statuses = JSON.parse(localStorage.getItem('lumivo_statuses')) || defaultStatuses;
  chats.sort((a, b) => (a.id === 'bot' ? -1 : b.id === 'bot' ? 1 : 0));
  renderChatList(); renderStatuses();
}
function save() {
  const cleanChats = chats.map(c => ({ ...c, messages: c.messages.map(m => { if (m.type) { const { fileData, ...rest } = m; return rest; } return m; }) }));
  try { localStorage.setItem('lumivo_chats', JSON.stringify(cleanChats)); localStorage.setItem('lumivo_statuses', JSON.stringify(statuses)); } catch (e) { console.warn('localStorage переполнен'); }
}
function escapeHtml(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function lastMessage(chat) {
  if (chat.isBot && chat.botState === 'unstarted') return 'Нажмите START';
  if (!chat.messages.length) return 'Нет сообщений';
  const last = chat.messages[chat.messages.length - 1];
  if (last.system) return last.text;
  if (last.type === 'image') return '📷 Фото';
  if (last.type === 'video') return '🎞️ Видео';
  if (last.type === 'file') return '📎 Файл: ' + last.fileName;
  return last.text;
}
function timeAgo(ts) { const diff = Date.now() - ts; const m = Math.floor(diff / 60000); if (m < 1) return 'только что'; if (m < 60) return `${m} мин назад`; const h = Math.floor(m / 60); if (h < 24) return `${h} ч назад`; return `${Math.floor(h / 24)} дн назад`; }
function formatSize(bytes) { if (bytes < 1024) return bytes + ' B'; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / (1024 * 1024)).toFixed(1) + ' MB'; }

function applyWallpaper(chat) {
  if (!chat) return;
  const wall = chat.wallpaper || 'default';
  const gradients = {
    'gradient1': 'linear-gradient(135deg, #1e1b4b, #312e81)', 'gradient2': 'linear-gradient(135deg, #064e3b, #065f46)',
    'gradient3': 'linear-gradient(135deg, #4c1d95, #7c3aed)', 'gradient4': 'linear-gradient(135deg, #7f1d1d, #b91c1c)',
    'gradient5': 'linear-gradient(135deg, #134e4a, #0f766e)'
  };
  if (wall === 'default') { messagesEl.style.backgroundImage = 'none'; messagesEl.style.backgroundColor = '#0f172a'; }
  else if (gradients[wall]) { messagesEl.style.backgroundImage = gradients[wall]; messagesEl.style.backgroundColor = '#0f172a'; }
  else if (wall.startsWith('data:image')) { messagesEl.style.backgroundImage = `url(${wall})`; messagesEl.style.backgroundColor = '#0f172a'; }
}

/* ================= ВКЛАДКИ ================= */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
    if (tab.dataset.tab === 'chats') { chatsTabEl.classList.remove('hidden'); statusesTabEl.classList.add('hidden'); }
    else { chatsTabEl.classList.add('hidden'); statusesTabEl.classList.remove('hidden'); renderStatuses(); }
  });
});

/* ================= РЕНДЕР ================= */
function renderChatList(filter = '') {
  chatListEl.innerHTML = '';
  const f = filter.trim().toLowerCase();
  chats.filter(c => !c.isBanned && (c.name.toLowerCase().includes(f) || (c.phone && c.phone.includes(f)))).forEach(chat => {
    const hasUnviewed = !chat.isBot && statuses.some(s => s.userId === chat.id && !s.viewed);
    const li = document.createElement('li');
    li.className = 'chat-item' + (chat.id === activeChatId ? ' active' : '');
    const isTyping = chat.isTyping;
    const previewText = isTyping ? '<span class="typing-text">печатает...</span>' : escapeHtml(lastMessage(chat));
    let avatarHtml = `<div class="avatar${hasUnviewed ? ' has-status' : ''}${chat.isBot ? ' bot-avatar' : ''}"><span>${escapeHtml(chat.avatar)}</span></div>`;
    li.innerHTML = `${avatarHtml}<div class="chat-item-info"><h3>${escapeHtml(chat.name)} ${chat.isBot ? '<span class="official-badge">✔</span>' : ''}</h3><p>${previewText}</p></div>`;
    li.addEventListener('click', () => openChat(chat.id));
    chatListEl.appendChild(li);
  });
}

function createMessageElement(msg, fileData = '') {
  const div = document.createElement('div');
  div.className = 'message ' + (msg.system ? 'system-msg' : (msg.mine ? 'outgoing' : (msg.isBot ? 'incoming bot-msg' : 'incoming')));
  if (msg.id) div.dataset.id = msg.id;
  let contentHtml = '';
  if (msg.type === 'image') contentHtml = `<img src="${fileData}" class="msg-image" alt="Фото">`;
  else if (msg.type === 'video') contentHtml = `<video src="${fileData}" class="msg-video" controls></video>`;
  else if (msg.type === 'file') contentHtml = `<a href="${fileData}" download="${escapeHtml(msg.fileName)}" class="msg-file"><div class="msg-file-icon">📄</div><div class="msg-file-info"><div class="msg-file-name">${escapeHtml(msg.fileName)}</div><div class="msg-file-size">${formatSize(msg.fileSize)}</div></div></a>`;
  else contentHtml = escapeHtml(msg.text);
  if (msg.buttons) {
    contentHtml += `<div class="chat-btn-container">`;
    msg.buttons.forEach(btn => { contentHtml += `<button class="chat-btn ${btn.class || ''}" data-action="${btn.action}" data-target="${btn.data || ''}">${escapeHtml(btn.label)}</button>`; });
    contentHtml += `</div>`;
  }
  let checkHtml = '';
  if (msg.mine && !msg.system) checkHtml = msg.read ? `<span class="msg-check read">✔✔</span>` : `<span class="msg-check">✔</span>`;
  div.innerHTML = `${contentHtml}<span class="message-time">${escapeHtml(msg.time)} ${checkHtml}</span>`;
  return div;
}

async function renderMessages(chat) {
  if (!chat.messages.length) { messagesEl.innerHTML = ''; return; }
  const fileDataMap = {};
  for (const msg of chat.messages) { if (msg.fileId) { const fileRecord = await getFileFromDB(msg.fileId); if (fileRecord) fileDataMap[msg.fileId] = fileRecord.data; } }
  messagesEl.innerHTML = '';
  chat.messages.forEach(msg => { messagesEl.appendChild(createMessageElement(msg, fileDataMap[msg.fileId] || '')); });
  messagesEl.querySelectorAll('.chat-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); if (btn.disabled) return; btn.disabled = true; handleBotButton(btn.dataset.action, btn.dataset.target); });
  });
  requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
}

async function openChat(id) {
  activeChatId = id;
  const chat = chats.find(c => c.id === id); if (!chat) return;
  if (chat.isBanned) { blockedReasonText.textContent = 'Причина: ' + (chat.banReason || 'Нарушение правил'); blockedOverlay.classList.add('active'); return; }
  applyWallpaper(chat);
  chatNameEl.childNodes[0].nodeValue = chat.name + ' ';
  chatAvatarEl.textContent = chat.avatar; chatAvatarEl.className = 'avatar' + (chat.isBot ? ' bot-avatar' : '');
  if (chat.isBot) {
    chatStatusEl.textContent = 'официальный бот'; chatStatusEl.style.color = '#3b82f6'; officialBadge.style.display = 'inline';
    audioCallBtn.style.display = 'none'; videoCallBtn.style.display = 'none';
    if (chat.botState === 'unstarted') { startContainer.classList.add('active'); messageFormEl.style.display = 'none'; }
    else { startContainer.classList.remove('active'); messageFormEl.style.display = 'flex'; }
    if (chat.botState === 'unstarted') { messagesEl.innerHTML = `<div class="message incoming bot-msg">Добро пожаловать в Lumivo! 👋<br><br>Я официальный бот. Нажмите START ниже, чтобы активировать меня.<span class="message-time">Сейчас</span></div>`; }
    else await renderMessages(chat);
  } else {
    chatStatusEl.textContent = chat.isTyping ? 'печатает...' : 'в сети'; chatStatusEl.style.color = '#22c55e'; officialBadge.style.display = 'none';
    audioCallBtn.style.display = 'flex'; videoCallBtn.style.display = 'flex';
    startContainer.classList.remove('active'); messageFormEl.style.display = 'flex';
    await renderMessages(chat);
  }
  renderChatList(searchInputEl.value);
  if (window.innerWidth < 768) { sidebarEl.classList.add('hidden-mobile'); chatAreaEl.classList.add('active'); }
}

function closeChat() { chatAreaEl.classList.remove('active'); sidebarEl.classList.remove('hidden-mobile'); activeChatId = null; renderChatList(searchInputEl.value); }

/* ================= ОБОИ ================= */
menuWallpaper.addEventListener('click', () => {
  const chat = chats.find(c => c.id === activeChatId); if (!chat) return;
  chatMenu.classList.remove('active');
  const currentWall = chat.wallpaper || 'default';
  document.querySelectorAll('.wallpaper-option').forEach(el => { el.classList.toggle('active', el.dataset.wall === currentWall); });
  wallpaperModal.classList.add('active');
});
cancelWallpaper.addEventListener('click', () => wallpaperModal.classList.remove('active'));
document.querySelectorAll('.wallpaper-option').forEach(option => {
  option.addEventListener('click', () => {
    const chat = chats.find(c => c.id === activeChatId); if (!chat) return;
    const wall = option.dataset.wall; if (!wall) return;
    chat.wallpaper = wall; save(); applyWallpaper(chat); wallpaperModal.classList.remove('active');
  });
});
customWallBtn.addEventListener('click', () => { wallpaperInput.click(); });
wallpaperInput.addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const chat = chats.find(c => c.id === activeChatId); if (!chat) return;
  try {
    const fileId = await saveFileToDB(file); const fileRecord = await getFileFromDB(fileId);
    chat.wallpaper = fileRecord.data; save(); applyWallpaper(chat); wallpaperModal.classList.remove('active');
  } catch (err) { alert('Ошибка загрузки обоев'); }
  wallpaperInput.value = '';
});

/* ================= ЖАЛОБЫ ================= */
menuReport.addEventListener('click', () => {
  const chat = chats.find(c => c.id === activeChatId); if (!chat || chat.isBot) { alert('На бота нельзя пожаловаться'); return; }
  chatMenu.classList.remove('active'); reportModal.classList.add('active');
});
cancelReport.addEventListener('click', () => reportModal.classList.remove('active'));
submitReport.addEventListener('click', () => {
  const chat = chats.find(c => c.id === activeChatId); if (!chat) return;
  const reason = reportReason.value; const time = new Date().toLocaleTimeString().slice(0,5);
  let dialogText = '';
  chat.messages.forEach(m => { if (m.system) return; const author = m.mine ? 'Вы' : chat.name; const text = m.text || (m.type === 'image' ? '[Фото]' : m.type === 'video' ? '[Видео]' : '[Файл]'); dialogText += `${author}: ${text}\n`; });
  const bot = chats.find(c => c.id === 'bot');
  if (bot) {
    if (!bot.reports) bot.reports = [];
    const reportId = Date.now();
    bot.reports.push({ id: reportId, targetName: chat.name, targetId: chat.id, reason, dialog: dialogText, time });
    bot.messages.push({ id: reportId, text: `⚠️ НОВАЯ ЖАЛОБА!\n\n👤 Нарушитель: ${chat.name}\n📝 Причина: ${reason}\n\n💬 Переписка:\n${dialogText}\n\nВыберите действие:`, isBot: true, time, buttons: [{ label: '⚠️ Предупредить', action: 'warn', data: String(chat.id), class: 'secondary' }, { label: '🚫 Забанить', action: 'ban_report', data: String(chat.id), class: 'danger' }] });
    save();
  }
  reportModal.classList.remove('active'); alert('Жалоба отправлена администратору!');
});

function handleBotButton(action, data) {
  const bot = chats.find(c => c.id === 'bot'); if (!bot) return;
  const time = new Date().toLocaleTimeString().slice(0,5);
  if (action === 'warn') {
    const target = chats.find(c => String(c.id) === String(data));
    if (target) {
      target.warnings = (target.warnings || 0) + 1;
      bot.messages.push({ id: Date.now(), text: `⚠️ Пользователю "${target.name}" вынесено предупреждение (${target.warnings}/3).`, isBot: true, time });
      if (target.warnings >= 3) { target.isBanned = true; target.banReason = '3 предупреждения'; bot.messages.push({ id: Date.now(), text: `🚫 Пользователь "${target.name}" забанен за 3 предупреждения!`, isBot: true, time }); }
      save(); renderChatList(); if (activeChatId === 'bot') renderMessages(bot);
    }
  } else if (action === 'ban_report') {
    const target = chats.find(c => String(c.id) === String(data));
    if (target) {
      const reason = prompt('Введите причину бана для пользователя:', 'Нарушение правил');
      if (reason && reason.trim()) {
        target.isBanned = true; target.banReason = reason;
        bot.messages.push({ id: Date.now(), text: `🚫 Пользователь "${target.name}" забанен.\nПричина: ${reason}`, isBot: true, time });
        save(); renderChatList(); if (activeChatId === 'bot') renderMessages(bot);
      }
    }
  }
}

/* ================= БОТ ================= */
startBotBtn.addEventListener('click', () => {
  const chat = chats.find(c => c.id === 'bot'); if (!chat) return;
  chat.botState = 'started';
  chat.messages = [{ id: Date.now(), text: 'Бот активирован! ✅\nВведите /admin для входа в панель.\n\nДоступные команды:\n/clear — очистить историю бота', isBot: true, time: new Date().toLocaleTimeString().slice(0,5) }];
  save(); startContainer.classList.remove('active'); messageFormEl.style.display = 'flex';
  renderMessages(chat); renderChatList(); messageInputEl.focus();
});

function processBotCommand(text) {
  const chat = chats.find(c => c.id === 'bot'); if (!chat) return;
  const time = new Date().toLocaleTimeString().slice(0,5);
  chat.messages.push({ id: Date.now(), text, mine: true, time, read: true });
  const cmd = text.trim().toLowerCase(); const args = cmd.split(' ');

  setTimeout(() => {
    if (cmd === '/vitaliy-admin2026') { chat.botState = 'admin'; chat.messages.push({ id: Date.now(), text: '🔐 Доступ разрешён. Добро пожаловать в Админ-панель!\n\nКоманды:\n/ban Имя — забанить\n/unban Имя — разбанить\n/broadcast — рассылка\n/stats — статистика\n/clear — очистить историю', isBot: true, time }); } 
    else if (cmd === '/admin') { if (chat.botState === 'admin') chat.messages.push({ id: Date.now(), text: 'Вы уже в админ-панели.\n\n/ban Имя, /unban Имя, /broadcast, /stats, /clear', isBot: true, time }); else chat.messages.push({ id: Date.now(), text: 'У вас нет прав администратора.', isBot: true, time }); }
    else if (cmd === '/stats') { if (chat.botState === 'admin') chat.messages.push({ id: Date.now(), text: `📊 Статистика:\n\n👥 Чатов: ${chats.filter(c => !c.isBot && !c.isBanned).length}\n🚫 Забанено: ${chats.filter(c => c.isBanned).length}\n💬 Сообщений: ${chats.reduce((sum, c) => sum + c.messages.length, 0)}\n📸 Статусов: ${statuses.length}\n⚠️ Жалоб: ${(chat.reports || []).length}`, isBot: true, time }); }
    else if (args[0] === '/ban') {
      if (chat.botState !== 'admin') return chat.messages.push({ id: Date.now(), text: '❌ У вас нет прав.', isBot: true, time });
      const targetName = text.substring(5).trim(); const targetChat = chats.find(c => c.name.toLowerCase() === targetName.toLowerCase() && !c.isBot);
      if (!targetChat) chat.messages.push({ id: Date.now(), text: `❌ Пользователь "${targetName}" не найден.`, isBot: true, time });
      else if (targetChat.isBanned) chat.messages.push({ id: Date.now(), text: `⚠️ "${targetName}" уже забанен.`, isBot: true, time });
      else { targetChat.isBanned = true; targetChat.banReason = 'Решение администратора'; save(); renderChatList(); if (activeChatId === targetChat.id) closeChat(); chat.messages.push({ id: Date.now(), text: `🚫 Пользователь "${targetName}" забанен и скрыт из списка.`, isBot: true, time }); }
    }
    else if (args[0] === '/unban') {
      if (chat.botState !== 'admin') return chat.messages.push({ id: Date.now(), text: '❌ У вас нет прав.', isBot: true, time });
      const targetName = text.substring(7).trim(); const targetChat = chats.find(c => c.name.toLowerCase() === targetName.toLowerCase() && !c.isBot);
      if (!targetChat) chat.messages.push({ id: Date.now(), text: `❌ Пользователь "${targetName}" не найден.`, isBot: true, time });
      else if (!targetChat.isBanned) chat.messages.push({ id: Date.now(), text: `⚠️ "${targetName}" не забанен.`, isBot: true, time });
      else { targetChat.isBanned = false; targetChat.banReason = null; save(); renderChatList(); chat.messages.push({ id: Date.now(), text: `✅ Пользователь "${targetName}" разбанен и возвращён в список!`, isBot: true, time }); }
    }
    else if (cmd === '/broadcast') {
      if (chat.botState !== 'admin') return chat.messages.push({ id: Date.now(), text: '❌ У вас нет прав.', isBot: true, time });
      const msgText = prompt('Введите текст рассылки:');
      if (msgText && msgText.trim()) { const t2 = new Date().toLocaleTimeString().slice(0,5); chats.forEach(c => { if (!c.isBot && !c.isBanned) c.messages.push({ id: Date.now() + Math.random(), text: '📢 Рассылка от админа:\n' + msgText, mine: false, time: t2, read: false }); }); save(); chat.messages.push({ id: Date.now(), text: '✅ Рассылка отправлена!', isBot: true, time: t2 }); }
    }
    else if (cmd === '/clear') {
      chat.messages = []; chat.reports = [];
      if (chat.botState === 'admin') chat.messages.push({ id: Date.now(), text: '🧹 История очищена.\n\nВы в админ-панели.\n/ban, /unban, /broadcast, /stats, /clear', isBot: true, time });
      else if (chat.botState === 'started') chat.messages.push({ id: Date.now(), text: '🧹 История очищена.\n\nВведите /admin.', isBot: true, time });
      else { chat.botState = 'unstarted'; startContainer.classList.add('active'); messageFormEl.style.display = 'none'; renderMessages(chat); return; }
    }
    else if (cmd === '/start') chat.messages.push({ id: Date.now(), text: 'Бот уже активирован. Введите /admin.', isBot: true, time });
    else chat.messages.push({ id: Date.now(), text: 'Неизвестная команда. Введите /admin.', isBot: true, time });
    save(); if (activeChatId === chat.id) renderMessages(chat); renderChatList(searchInputEl.value);
  }, 600);
}

/* ================= МЕНЮ ДЕЙСТВИЙ ================= */
chatMenuBtn.addEventListener('click', () => {
  const chat = chats.find(c => c.id === activeChatId); if (!chat) return;
  if (chat.isBot) menuReport.style.display = 'none'; else menuReport.style.display = 'flex';
  chatMenu.classList.add('active');
});
chatMenu.addEventListener('click', (e) => { if (e.target === chatMenu) chatMenu.classList.remove('active'); });
menuClearMe.addEventListener('click', () => {
  const chat = chats.find(c => c.id === activeChatId); if (!chat) return;
  if (!confirm('Очистить историю только у себя?')) return;
  chat.messages = []; save(); renderMessages(chat); renderChatList(); chatMenu.classList.remove('active');
  if (chat.isBot) { chat.botState = 'unstarted'; startContainer.classList.add('active'); messageFormEl.style.display = 'none'; }
});
menuClearAll.addEventListener('click', () => {
  const chat = chats.find(c => c.id === activeChatId); if (!chat) return;
  if (!confirm('Очистить чат у всех?')) return;
  if (chat.isBot) { chat.messages = []; chat.botState = 'unstarted'; startContainer.classList.add('active'); messageFormEl.style.display = 'none'; }
  else chat.messages = [{ text: 'Чат очищен', system: true, time: new Date().toLocaleTimeString().slice(0,5) }];
  save(); renderMessages(chat); renderChatList(); chatMenu.classList.remove('active');
});
menuDeleteChat.addEventListener('click', () => {
  const chat = chats.find(c => c.id === activeChatId); if (!chat) return;
  if (chat.isBot) { alert('Бота нельзя удалить!'); chatMenu.classList.remove('active'); return; }
  if (!confirm('Удалить чат полностью?')) return;
  chats = chats.filter(c => c.id !== activeChatId); save(); closeChat(); chatMenu.classList.remove('active');
});

/* ================= ОТПРАВКА ================= */
attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files); if (!files.length) return;
  const chat = chats.find(c => c.id === activeChatId); if (!chat) return;
  if (chat.isBot) { alert('Боту нельзя отправлять файлы'); fileInput.value = ''; return; }
  const time = new Date().toLocaleTimeString().slice(0,5);
  for (const file of files) {
    try {
      const fileId = await saveFileToDB(file); let type = 'file'; if (file.type.startsWith('image/')) type = 'image'; else if (file.type.startsWith('video/')) type = 'video';
      const msg = { id: Date.now() + Math.random(), type, fileId, fileName: file.name, fileSize: file.size, mine: true, time, read: false };
      chat.messages.push(msg); save(); await renderMessages(chat); renderChatList(searchInputEl.value);
      setTimeout(() => { msg.read = true; save(); if (activeChatId === chat.id) renderMessages(chat); }, 3000);
    } catch (err) { alert('Ошибка отправки файла'); }
  }
  fileInput.value = '';
});

function sendMessage(text) {
  const chat = chats.find(c => c.id === activeChatId); if (!chat) return;
  if (chat.isBot) { if (chat.botState === 'unstarted') return alert('Сначала нажмите START'); processBotCommand(text); return; }
  const time = new Date().toLocaleTimeString().slice(0,5);
  const msg = { id: Date.now() + Math.random(), text, mine: true, time, read: false };
  chat.messages.push(msg); save(); renderMessages(chat); renderChatList(searchInputEl.value);
  setTimeout(() => { msg.read = true; save(); if (activeChatId === chat.id) renderMessages(chat); }, 2000);
  setTimeout(() => {
    chat.isTyping = true; renderChatList(searchInputEl.value); if (activeChatId === chat.id) chatStatusEl.textContent = 'печатает...';
    setTimeout(() => {
      chat.isTyping = false; if (activeChatId === chat.id) chatStatusEl.textContent = 'в сети';
      const replies = ['Интересно!', 'Понял тебя 👌', 'Хорошо', 'Ага', 'Отлично! 🔥']; const reply = replies[Math.floor(Math.random() * replies.length)];
      const time2 = new Date().toLocaleTimeString().slice(0,5);
      chat.messages.push({ id: Date.now() + Math.random(), text: reply, mine: false, time: time2, read: true });
      save(); if (activeChatId === chat.id) renderMessages(chat); renderChatList(searchInputEl.value);
    }, 2000);
  }, 1500);
}

/* ================= СТАТУСЫ ================= */
function renderStatuses() {
  statusListEl.innerHTML = '';
  const grouped = {}; statuses.forEach(s => { if (!grouped[s.userId]) grouped[s.userId] = []; grouped[s.userId].push(s); });
  const userIds = Object.keys(grouped).sort((a, b) => { const aUn = grouped[a].some(s => !s.viewed), bUn = grouped[b].some(s => !s.viewed); if (aUn !== bUn) return bUn - aUn; return grouped[b][0].timestamp - grouped[a][0].timestamp; });
  userIds.forEach(uid => {
    const userStatuses = grouped[uid].sort((a, b) => a.timestamp - b.timestamp); const latest = userStatuses[userStatuses.length - 1]; const hasUnviewed = userStatuses.some(s => !s.viewed);
    const li = document.createElement('li'); li.className = 'status-item';
    let previewHtml = latest.type === 'image' && latest.imageData ? `<img src="${latest.imageData}">` : `<div class="text-preview">${escapeHtml(latest.type === 'image' ? '📷' : latest.avatar)}</div>`;
    li.innerHTML = `<div class="status-preview${latest.type === 'text' ? ' text-preview' : ''}" style="border-color: ${hasUnviewed ? '#f09433' : '#475569'}">${previewHtml}</div><div class="status-meta"><h3>${escapeHtml(latest.name)}</h3><p>${timeAgo(latest.timestamp)}${userStatuses.length > 1 ? ` • ${userStatuses.length} обн.` : ''}</p></div>`;
    li.addEventListener('click', () => openStatusViewer(userStatuses)); statusListEl.appendChild(li);
  });
  if (userIds.length === 0) statusListEl.innerHTML = `<li style="padding:30px;text-align:center;color:#64748b;font-size:14px">Пока нет статусов.</li>`;
}
function openStatusViewer(items) { viewerState.items = items; viewerState.index = 0; statusViewerEl.classList.add('active'); showStatusItem(); }
function showStatusItem() {
  const items = viewerState.items, idx = viewerState.index, item = items[idx]; if (!item) return closeStatusViewer();
  item.viewed = true; if (item.userId !== 0) { if (!item.viewers) item.viewers = []; if (!item.viewers.includes('Вы')) item.viewers.push('Вы'); } save();
  viewerAvatarEl.textContent = item.avatar; viewerNameEl.textContent = item.name; viewerTimeEl.textContent = timeAgo(item.timestamp);
  statusProgress.innerHTML = '';
  items.forEach((_, i) => { const bar = document.createElement('div'); bar.className = 'bar'; if (i < idx) bar.classList.add('done'); if (i === idx) bar.classList.add('active'); bar.innerHTML = '<div class="fill"></div>'; statusProgress.appendChild(bar); });
  statusContent.querySelectorAll('img, .text-status').forEach(n => n.remove());
  if (item.type === 'image' && item.imageData) { const img = document.createElement('img'); img.src = item.imageData; statusContent.appendChild(img); }
  else { const div = document.createElement('div'); div.className = 'text-status'; div.textContent = item.text; statusContent.appendChild(div); }
  if (item.userId === 0 && item.viewers && item.viewers.length > 0) { statusViewersList.classList.add('active'); viewersContainer.innerHTML = item.viewers.map(v => `<div class="viewer-item"><div class="avatar">${escapeHtml(v.charAt(0))}</div><span>${escapeHtml(v)}</span></div>`).join(''); }
  else statusViewersList.classList.remove('active');
  clearTimeout(viewerState.timer); viewerState.timer = setTimeout(nextStatus, 5000);
}
function nextStatus() { if (viewerState.index < viewerState.items.length - 1) { viewerState.index++; showStatusItem(); } else closeStatusViewer(); }
function prevStatus() { if (viewerState.index > 0) { viewerState.index--; showStatusItem(); } }
function closeStatusViewer() { clearTimeout(viewerState.timer); statusViewerEl.classList.remove('active'); viewerState.items = []; renderStatuses(); renderChatList(searchInputEl.value); }
closeStatusBtn.addEventListener('click', closeStatusViewer); navNext.addEventListener('click', nextStatus); navPrev.addEventListener('click', prevStatus);

/* ================= КОНТАКТЫ ================= */
contactPhone.addEventListener('input', (e) => {
  let input = e.target.value.replace(/\D/g, ''); let formatted = '';
  if (countryCode.value === '+375') { if (input.length > 0) formatted = input.substring(0, 2); if (input.length > 2) formatted += ' ' + input.substring(2, 5); if (input.length > 5) formatted += '-' + input.substring(5, 7); if (input.length > 7) formatted += '-' + input.substring(7, 9); }
  else { if (input.length > 0) formatted = input.substring(0, 3); if (input.length > 3) formatted += ' ' + input.substring(3, 6); if (input.length > 6) formatted += '-' + input.substring(6, 8); if (input.length > 8) formatted += '-' + input.substring(8, 10); }
  e.target.value = formatted;
});
countryCode.addEventListener('change', () => { contactPhone.value = ''; contactPhone.placeholder = countryCode.value === '+375' ? '29 123-45-67' : '999 123-45-67'; });
newChatBtn.addEventListener('click', () => { contactName.value = ''; contactPhone.value = ''; countryCode.value = '+7'; contactPhone.placeholder = '999 123-45-67'; contactModal.classList.add('active'); setTimeout(() => contactName.focus(), 100); });
cancelContact.addEventListener('click', () => contactModal.classList.remove('active'));
saveContact.addEventListener('click', () => {
  const name = contactName.value.trim(); const rawPhone = contactPhone.value.replace(/\D/g, ''); const code = countryCode.value;
  if (!name) return alert('Введите имя'); if (code === '+7' && rawPhone.length !== 10) return alert('Номер РФ: 10 цифр'); if (code === '+375' && rawPhone.length !== 9) return alert('Номер Беларуси: 9 цифр');
  let fullPhone = code === '+7' ? `+7 ${rawPhone.substring(0,3)} ${rawPhone.substring(3,6)}-${rawPhone.substring(6,8)}-${rawPhone.substring(8,10)}` : `+375 ${rawPhone.substring(0,2)} ${rawPhone.substring(2,5)}-${rawPhone.substring(5,7)}-${rawPhone.substring(7,9)}`;
  if (chats.some(c => c.phone === fullPhone)) return alert('Контакт уже есть!');
  const newChat = { id: Date.now(), name, avatar: name.charAt(0).toUpperCase(), phone: fullPhone, messages: [] };
  chats.push(newChat); save(); contactModal.classList.remove('active'); renderChatList(searchInputEl.value); openChat(newChat.id);
});

/* ================= СТАТУСЫ ЗАГРУЗКА ================= */
addStatusBtn.addEventListener('click', () => { statusUploader.classList.add('active'); textModeBtn.classList.add('active'); imageModeBtn.classList.remove('active'); statusTextEl.style.display = 'block'; statusImageEl.style.display = 'none'; statusTextEl.value = ''; statusImageEl.value = ''; });
textModeBtn.addEventListener('click', () => { textModeBtn.classList.add('active'); imageModeBtn.classList.remove('active'); statusTextEl.style.display = 'block'; statusImageEl.style.display = 'none'; });
imageModeBtn.addEventListener('click', () => { imageModeBtn.classList.add('active'); textModeBtn.classList.remove('active'); statusTextEl.style.display = 'none'; statusImageEl.style.display = 'block'; statusImageEl.click(); });
cancelUpload.addEventListener('click', () => statusUploader.classList.remove('active'));
postStatusBtn.addEventListener('click', async () => {
  const now = Date.now(); const isText = textModeBtn.classList.contains('active');
  if (isText) {
    const text = statusTextEl.value.trim(); if (!text) return;
    statuses.push({ id: now, userId: 0, name: 'Вы', avatar: 'Я', type: 'text', text, timestamp: now, viewed: true, viewers: [] });
    save(); statusUploader.classList.remove('active'); renderStatuses();
  } else {
    const file = statusImageEl.files[0]; if (!file) return;
    try { const fileId = await saveFileToDB(file); const fileRecord = await getFileFromDB(fileId); statuses.push({ id: now, userId: 0, name: 'Вы', avatar: 'Я', type: 'image', imageData: fileRecord.data, timestamp: now, viewed: true, viewers: [] }); save(); statusUploader.classList.remove('active'); renderStatuses(); } catch (err) { alert('Ошибка'); }
  }
});

/* ================= ФОРМА И ЗВОНКИ ================= */
messageFormEl.addEventListener('submit', e => { e.preventDefault(); const text = messageInputEl.value.trim(); if (!text) return; sendMessage(text); messageInputEl.value = ''; messageInputEl.focus(); });
searchInputEl.addEventListener('input', e => renderChatList(e.target.value));
backBtn.addEventListener('click', closeChat);

let localStream = null, callInterval = null, callSeconds = 0, isMuted = false, isCamOff = false;
async function startCall(isVideo) {
  const chat = chats.find(c => c.id === activeChatId); if (!chat || chat.isBot) return;
  callAvatar.textContent = chat.avatar; callName.textContent = chat.name; callStatus.textContent = 'Вызов...'; callTimer.style.display = 'none'; callTimer.textContent = '00:00'; callAvatar.classList.remove('in-call');
  isMuted = false; isCamOff = false; muteBtn.classList.remove('active'); camBtn.classList.remove('active');
  camBtn.style.display = isVideo ? 'flex' : 'none'; videoContainer.classList.toggle('active', isVideo); callScreen.classList.add('active');
  try { localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo }); if (isVideo) localVideo.srcObject = localStream; } catch (err) { if (isVideo) videoContainer.classList.remove('active'); alert('Нет доступа к камере/микрофону'); }
  setTimeout(() => {
    if (!callScreen.classList.contains('active')) return;
    callStatus.textContent = 'Идёт разговор'; callTimer.style.display = 'block'; callAvatar.classList.add('in-call');
    callSeconds = 0; clearInterval(callInterval);
    callInterval = setInterval(() => { callSeconds++; callTimer.textContent = `${String(Math.floor(callSeconds/60)).padStart(2,'0')}:${String(callSeconds%60).padStart(2,'0')}`; }, 1000);
  }, 2500);
}
function endCall() { callScreen.classList.remove('active'); clearInterval(callInterval); callSeconds = 0; if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; } localVideo.srcObject = null; remoteVideo.srcObject = null; }
audioCallBtn.addEventListener('click', () => startCall(false)); videoCallBtn.addEventListener('click', () => startCall(true)); endCallBtn.addEventListener('click', endCall);
muteBtn.addEventListener('click', () => { if (!localStream) return; isMuted = !isMuted; localStream.getAudioTracks().forEach(t => t.enabled = !isMuted); muteBtn.classList.toggle('active', isMuted); });
camBtn.addEventListener('click', () => { if (!localStream) return; isCamOff = !isCamOff; localStream.getVideoTracks().forEach(t => t.enabled = !isCamOff); camBtn.classList.toggle('active', isCamOff); });