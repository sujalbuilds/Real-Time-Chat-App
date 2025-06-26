let socket;
let currentUser = null;
let currentRoom = null;
let typingTimer = null;
let isTyping = false;
let onlineUsers = [];

const elements = {
  //room
  roomsList: document.getElementById('roomsList'),
  newRoomName: document.getElementById('newRoomName'),
  newRoomDesc: document.getElementById('newRoomDesc'),
  newRoomPrivate: document.getElementById('newRoomPrivate'),
  createRoomBtn: document.getElementById('createRoomBtn'),

  //chat
  messagesContainer: document.getElementById('messages-container'),
  messageInput: document.getElementById('message-input'),
  sendButton: document.getElementById('send-button'),
  currentRoomName: document.getElementById('currentRoomName'),
  userList: document.getElementById('user-list'),
  typingIndicator: document.getElementById('typingIndicator'),
  typingStatus: document.getElementById('typingStatus'),

  //control
  leaveRoomBtn: document.getElementById('leaveRoomBtn'),
  logoutButton: document.getElementById('logoutButton'),
  emojiButton: document.getElementById('emojiButton'),
  emojiPickerContainer: document.getElementById('emojiPickerContainer'),

  //invitation
  inviteUserBtn: document.getElementById('inviteUserBtn'),
  inviteModal: document.getElementById('inviteModal'),
  inviteUsername: document.getElementById('inviteUsername'),
  sendInviteBtn: document.getElementById('sendInviteBtn'),
  cancelInviteBtn: document.getElementById('cancelInviteBtn'),
  invitationsList: document.getElementById('invitationsList'),
  inviteCount: document.getElementById('inviteCount'),
  notifications: document.getElementById('notifications'),
  closeModal: document.querySelector('.close')
};

async function initializeSocket() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) {
      return window.location.href = '/login.html';
    }

    currentUser = await res.json();

    connectSocket();
  } catch (err) {
    console.error('Initialization error:', err);
    window.location.href = '/login.html';
  }
}

function connectSocket() {

  socket = io({ withCredentials: true });

  socket.on('connect', () => {
    console.log('Connected to server');
    loadRooms();
    loadInvitations();
  });

  socket.on('connect_error', err => {
    console.error('Socket error:', err);
    if (err.message === 'Authentication error') {
      return window.location.href = '/login.html';
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  socket.on('chatMessage', (data) => {
    displayMessage(data.username, data.message, data.timestamp);
  });

  socket.on('chatHistory', (messages) => {
    elements.messagesContainer.innerHTML = '';
    messages.forEach(msg => {
      displayMessage(msg.username, msg.message, msg.timestamp);
    });
  });

  socket.on('system-message', (message) => {
    displaySystemMessage(message);
  });

  socket.on('userStartedTyping', (data) => {
    showTypingIndicator(data.username);
  });

  socket.on('userStoppedTyping', () => {
    hideTypingIndicator();
  });

  socket.on('user-connected', (user) => {
    if (!onlineUsers.find(u => u.id === user.id)) {
      onlineUsers.push({ id: user.id, username: user.username });
    }
    updateUserList();
  });

  socket.on('user-disconnected', (userId) => {
    onlineUsers = onlineUsers.filter(u => u.id !== userId);
    updateUserList();
  });

  socket.on('invitation-received', (data) => {
    showNotification(`Invitation received: ${data.invitedBy} invited you to "${data.roomName}"`, 'info');
    loadInvitations();
  });

  socket.on('invitation-responded', (data) => {
    if (data.response === 'accepted') {
      showNotification(`${data.username} joined the room`, 'success');
    }
  });
}

async function loadRooms() {
  try {
    const response = await fetch('/api/chat-rooms', {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to load rooms');
    }

    const rooms = await response.json();
    displayRooms(rooms);
  } catch (error) {
    console.error('Error loading rooms:', error);
    showNotification('Error loading rooms', 'error');

    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      window.location.href = '/login.html';
    }
  }
}

function displayRooms(rooms) {
  elements.roomsList.innerHTML = '';
  rooms.forEach(room => {
    const li = document.createElement('li');
    li.className = 'room-item';
    
    const creatorId = room.createdBy?._id || room.createdBy;
    const isCreator = creatorId === currentUser.id;

    li.innerHTML = `
      <div class="room-info">
        <h4>${room.name}${room.isPrivate ? ' 🔒' : ''}</h4>
        <p>${room.description}</p>
        <small>Created by: ${room.createdBy?.username || 'Unknown'}</small>
      </div>
      <button onclick="joinRoom('${room._id}')" class="join-btn">Join</button>
      ${isCreator
        ? `<button onclick="deleteRoom('${room._id}')" class="delete-btn">Delete</button>`
        : ''
      }
    `;
    elements.roomsList.appendChild(li);
  });
}


async function createRoom() {
  const name = elements.newRoomName.value.trim();
  const description = elements.newRoomDesc.value.trim();
  const isPrivate = elements.newRoomPrivate.checked;

  if (!name) {
    showNotification('Room name is required', 'error');
    return;
  }

  try {
    const response = await fetch('/api/chat-rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ name, description, isPrivate })
    });

    if (response.ok) {
      elements.newRoomName.value = '';
      elements.newRoomDesc.value = '';
      elements.newRoomPrivate.checked = false;
      showNotification('Room created successfully', 'success');
      loadRooms();
    } else {
      const error = await response.json();
      showNotification(error.message || 'Error creating room', 'error');
    }
  } catch (error) {
    console.error('Error creating room:', error);
    showNotification('Error creating room', 'error');
  }
}

async function joinRoom(roomId) {
  try {
    const response = await fetch(`/api/chat-rooms/${roomId}/join`, {
      method: 'POST',
      credentials: 'include'
    });

    if (response.ok) {
      currentRoom = roomId;
      socket.emit('join-room', roomId);

      const roomResponse = await fetch(`/api/chat-rooms/${roomId}`, {
        credentials: 'include'
      });
      const room = await roomResponse.json();

      elements.currentRoomName.textContent = room.name;
      elements.messageInput.disabled = false;
      elements.sendButton.disabled = false;
      elements.emojiButton.disabled = false;

      if (room.isPrivate) {
        elements.inviteUserBtn.style.display = 'inline-block';
      } else {
        elements.inviteUserBtn.style.display = 'none';
      }

      showNotification(`Joined ${room.name}`, 'success');
    } else {
      const error = await response.json();
      showNotification(error.message || 'Error joining room', 'error');
    }
  } catch (error) {
    console.error('Error joining room:', error);
    showNotification('Error joining room', 'error');
  }
}

function leaveRoom() {
  if (currentRoom) {
    socket.emit('leave-room', currentRoom);
    currentRoom = null;
    elements.currentRoomName.textContent = 'Chat Room';
    elements.messagesContainer.innerHTML = '';
    elements.messageInput.disabled = true;
    elements.sendButton.disabled = true;
    elements.emojiButton.disabled = true;
    elements.inviteUserBtn.style.display = 'none';
    showNotification('Left the room', 'info');
  }
}

function sendMessage() {
  const message = elements.messageInput.value.trim();
  if (!message || !currentRoom) return;

  socket.emit('chatMessage', {
    message,
    timestamp: new Date().toISOString(),
    roomId: currentRoom
  });

  elements.messageInput.value = '';
  stopTyping();
}

function displayMessage(username, message, timestamp) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';
  messageDiv.classList.add(
    username === currentUser?.username ? 'user' : 'other'
  );
  const time = new Date(timestamp).toLocaleTimeString();
  messageDiv.innerHTML = `
    <div class="message-header">
      <span class="username">${username}</span>
    </div>
    <div class="message-content">${escapeHtml(message)}</div>
    <div class="message-footer">
      <span class="timestamp">${time}</span>
    </div>
  `;

  elements.messagesContainer.appendChild(messageDiv);
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function displaySystemMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'system-message';
  messageDiv.textContent = message;
  elements.messagesContainer.appendChild(messageDiv);
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function startTyping() {
  if (!isTyping && currentRoom) {
    isTyping = true;
    socket.emit('startTyping', currentRoom);
  }

  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 3000);
}

function stopTyping() {
  if (isTyping && currentRoom) {
    isTyping = false;
    socket.emit('stopTyping', currentRoom);
  }
  clearTimeout(typingTimer);
}

function showTypingIndicator(username) {
  elements.typingStatus.textContent = `${username} is typing...`;
  elements.typingIndicator.style.display = 'block';
}

function hideTypingIndicator() {
  elements.typingIndicator.style.display = 'none';
}

async function loadInvitations() {
  try {
    const response = await fetch('/api/chat-rooms/invitations', {
      credentials: 'include'
    });
    const invitations = await response.json();
    displayInvitations(invitations);
  } catch (error) {
    console.error('Error loading invitations:', error);
  }
}

function displayInvitations(invitations) {
  elements.inviteCount.textContent = invitations.length;
  elements.invitationsList.innerHTML = '';

  if (invitations.length === 0) {
    elements.invitationsList.innerHTML = '<p class="no-invitations">No pending invitations</p>';
    return;
  }

  invitations.forEach(invitation => {
    const inviteDiv = document.createElement('div');
    inviteDiv.className = 'invitation-item';
    inviteDiv.innerHTML = `
      <h5>${invitation.roomName}</h5>
      <p><strong>From:</strong> ${invitation.invitedBy}</p>
      <p><strong>Description:</strong> ${invitation.roomDescription}</p>
      <div class="invitation-buttons">
        <button class="btn-accept" onclick="respondToInvitation('${invitation._id}', 'accepted')">
          Accept
        </button>
        <button class="btn-decline" onclick="respondToInvitation('${invitation._id}', 'declined')">
          Decline
        </button>
      </div>
    `;
    elements.invitationsList.appendChild(inviteDiv);
  });
}

async function respondToInvitation(inviteId, response) {
  try {
    const apiResponse = await fetch(`/api/chat-rooms/invitations/${inviteId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ response })
    });

    if (apiResponse.ok) {
      const result = await apiResponse.json();
      showNotification(result.message, response === 'accepted' ? 'success' : 'info');
      loadInvitations();
      loadRooms(); 

      socket.emit('invitation-responded', {
        response,
        roomId: result.roomId
      });
    } else {
      const error = await apiResponse.json();
      showNotification(error.message || 'Error responding to invitation', 'error');
    }
  } catch (error) {
    console.error('Error responding to invitation:', error);
    showNotification('Error responding to invitation', 'error');
  }
}

function showInviteModal() {
  if (!currentRoom) {
    showNotification('Please join a room first', 'error');
    return;
  }
  elements.inviteModal.style.display = 'block';
  elements.inviteUsername.focus();
}

function hideInviteModal() {
  elements.inviteModal.style.display = 'none';
  elements.inviteUsername.value = '';
}

async function sendInvitation() {
  const username = elements.inviteUsername.value.trim();
  if (!username) {
    showNotification('Please enter a username', 'error');
    return;
  }

  if (!currentRoom) {
    showNotification('No room selected', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/chat-rooms/${currentRoom}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ username })
    });

    if (response.ok) {
      const result = await response.json();
      showNotification(result.message, 'success');
      hideInviteModal();

      socket.emit('send-invitation', {
        username,
        roomName: result.roomName,
        roomId: currentRoom
      });
    } else {
      const error = await response.json();
      showNotification(error.message || 'Error sending invitation', 'error');
    }
  } catch (error) {
    console.error('Error sending invitation:', error);
    showNotification('Error sending invitation', 'error');
  }
}


function updateUserList() {
  elements.userList.innerHTML = '';    

  if (onlineUsers.length === 0) {
    elements.userList.innerHTML = '<p>No one is online</p>';
    return;
  }

  onlineUsers.forEach(user => {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.innerHTML = `
      <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
      <div class="user-name">${user.username}</div>
      <div class="status-indicator"></div>
    `;
    elements.userList.appendChild(div);
  });
}

function toggleEmojiPicker() {
  const container = elements.emojiPickerContainer;
  if (container.style.display === 'block') {
    container.style.display = 'none';
  } else {
    container.style.display = 'block';
    if (!container.innerHTML) {
      initEmojiPicker();
    }
  }
}

function initEmojiPicker() {
  const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
    '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
    '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
    '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
    '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
    '😔', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩',
    '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯',
    '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓',
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
    '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐',
    '🖖', '👋', '🤏', '✊', '👊', '🤛', '🤜', '👏',
    '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
    '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
    '💘', '💝', '💟', '☮️', '🔥', '⭐', '🌟', '✨',
    '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉'
  ];
  const container = elements.emojiPickerContainer;

  container.innerHTML = emojis.map(emoji =>
    `<span class="emoji-option" onclick="addEmoji('${emoji}')">${emoji}</span>`
  ).join('');
}

function addEmoji(emoji) {
  elements.messageInput.value += emoji;
  elements.emojiPickerContainer.style.display = 'none';
  elements.messageInput.focus();
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  elements.notifications.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 5000);
}

function logout() {
  fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    .finally(() => window.location.href = '/login.html');
}

document.addEventListener('DOMContentLoaded', () => {
  initializeSocket();

  elements.createRoomBtn?.addEventListener('click', createRoom);

  elements.sendButton?.addEventListener('click', sendMessage);
  elements.messageInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    } else {
      startTyping();
    }
  });

  elements.leaveRoomBtn?.addEventListener('click', leaveRoom);
  elements.logoutButton?.addEventListener('click', logout);
  elements.emojiButton?.addEventListener('click', toggleEmojiPicker);
  elements.inviteUserBtn?.addEventListener('click', showInviteModal);
  elements.sendInviteBtn?.addEventListener('click', sendInvitation);
  elements.cancelInviteBtn?.addEventListener('click', hideInviteModal);
  elements.closeModal?.addEventListener('click', hideInviteModal);
  elements.inviteModal?.addEventListener('click', (e) => {
    if (e.target === elements.inviteModal) {
      hideInviteModal();
    }
  });

  elements.inviteUsername?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendInvitation();
    }
  });

  document.addEventListener('click', (e) => {
    if (!elements.emojiButton?.contains(e.target) &&
      !elements.emojiPickerContainer?.contains(e.target)) {
      elements.emojiPickerContainer.style.display = 'none';
    }
  });

  const createSection = document.querySelector('.room-creation');
  const createToggle  = document.getElementById('createToggle');
  createToggle.addEventListener('click', () => {
    const collapsed = createSection.classList.toggle('collapsed');
   
    createToggle.textContent = collapsed ? '▴' : '▾';
    createToggle.setAttribute('aria-expanded', String(!collapsed));
  });

  const invitesSection = document.querySelector('.invitations-section');
  const invitesToggle  = document.getElementById('invitesToggle');
  invitesToggle.addEventListener('click', () => {
    const collapsed = invitesSection.classList.toggle('collapsed');
  
    invitesToggle.textContent = collapsed ? '▴' : '▾';
    invitesToggle.setAttribute('aria-expanded', String(!collapsed));
  });
});

async function deleteRoom(roomId) {

  if (!confirm('Are you sure you want to delete this room?')) return;

  try {
    const res = await fetch(`/api/chat-rooms/${roomId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    const json = await res.json();

    if (res.ok) {
      showNotification(json.message, 'info');
      loadRooms();                    
      if (currentRoom === roomId) {   
        leaveRoom();                  
      }
    } else {
      showNotification(json.message, 'error');
    }
  } catch (err) {
    console.error('Error deleting room:', err);
    showNotification('Failed to delete room', 'error');
  }
}

window.joinRoom = joinRoom;
window.respondToInvitation = respondToInvitation;
window.addEmoji = addEmoji;
