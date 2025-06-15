// --- START OF FILE js/sidebar.js (FULL REAL-TIME VERSION) ---

let isBotTyping = false;

function autoResizeChatTextarea(textarea) {
    if (!textarea) return;
    const inputArea = textarea.closest('.chat-box-input-area');
    
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';

    if (textarea.value.length > 0) {
        inputArea.classList.add('is-composing');
    } else {
        inputArea.classList.remove('is-composing');
    }
}

const handleAiChatMessageSend = async (event, textareaElement) => {
    if (isBotTyping) return;
    const inputElement = textareaElement || event.target;
    const chatBox = inputElement.closest('.chat-box');
    const messagesContainer = chatBox.querySelector('.chat-box-messages');

    const userMessage = inputElement.value.trim();
    if (!userMessage) return;

    appendChatMessage(userMessage, 'sent', messagesContainer, currentUser.id);
    inputElement.value = '';
    autoResizeChatTextarea(inputElement); 

    isBotTyping = true;
    inputElement.disabled = true;

    const typingIndicator = appendChatMessage(' ', 'received typing', messagesContainer, 'ai');

    try {
        const sanitizedUser = {
            id: currentUser.id, name: currentUser.name, email: currentUser.email, bio: currentUser.bio, skills: currentUser.skills,
            projects: (currentUser.projects || []).map(p => ({
                id: p.id, name: p.name, description: p.description, deadline: p.deadline,
                taskSummary: { total: (p.tasks || []).filter(t => t.status !== 'DOCS').length, todo: (p.tasks || []).filter(t => t.status === 'Việc Cần Làm').length, doing: (p.tasks || []).filter(t => t.status === 'Đang Làm').length, done: (p.tasks || []).filter(t => t.status === 'Đã Hoàn Thành').length, },
                documentCount: (p.tasks || []).filter(t => t.status === 'DOCS').length
            }))
        };
        const botResponse = await callGroqAPI(userMessage, sanitizedUser);
        typingIndicator.closest('.message-group').remove();
        appendChatMessage(botResponse, 'received', messagesContainer, 'ai');
    } catch (error) {
        console.error("Groq API Error:", error);
        typingIndicator.closest('.message-group')?.remove();
        appendChatMessage("Rất tiếc, đã có lỗi xảy ra.", 'received', messagesContainer, 'ai');
    } finally {
        isBotTyping = false;
        inputElement.disabled = false;
        inputElement.focus();
    }
};

const appendChatMessage = (message, type, targetContainer, senderId = null) => {
    if (!targetContainer) return null;
    const lastMessageGroup = targetContainer.lastElementChild;
    const isNewSender = !lastMessageGroup || lastMessageGroup.dataset.senderId !== String(senderId);

    let messageGroup;
    if (isNewSender) {
        messageGroup = document.createElement('div');
        messageGroup.className = `message-group ${type.split(' ')[0]}`;
        messageGroup.dataset.senderId = String(senderId);
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'chat-avatar';
        if (senderId === 'ai') {
            avatarDiv.classList.add('ai-icon');
            avatarDiv.innerHTML = `<i class="fas fa-robot"></i>`;
        } else {
            const user = String(senderId) === String(currentUser.id) ? currentUser : findUserById(senderId);
            const avatarHTML = user && user.avatar ? `<img src="${user.avatar}" alt="${user.name}" onerror="this.onerror=null; this.src='../images/default-avatar.png';">` : (user ? user.name.charAt(0).toUpperCase() : '');
            avatarDiv.innerHTML = avatarHTML;
        }
        const bubbleContainer = document.createElement('div');
        bubbleContainer.className = 'message-bubbles';
        messageGroup.appendChild(avatarDiv);
        messageGroup.appendChild(bubbleContainer);
        targetContainer.appendChild(messageGroup);
    } else {
        messageGroup = lastMessageGroup;
    }
    
    if (lastMessageGroup) lastMessageGroup.classList.remove('is-last-in-sequence');
    messageGroup.classList.add('is-last-in-sequence');

    const bubbleContainer = messageGroup.querySelector('.message-bubbles');
    const messageElement = document.createElement('div');
    messageElement.className = `chat-bubble`;
    if (message.trim() === '' && type.includes('typing')) messageElement.classList.add('typing');
    messageElement.innerHTML = message
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/(\r\n|\n|\r)/g, '<br>');
    
    bubbleContainer.appendChild(messageElement);
    targetContainer.scrollTop = targetContainer.scrollHeight;
    return messageElement;
};

const callGroqAPI = async (userMessage, userData) => { try { const response = await fetchWithAuth('/api/ai/chat', { method: 'POST', body: JSON.stringify({ userMessage, userData }) }); return response.message; } catch (error) { console.error("Lỗi khi gọi API AI của chúng ta:", error); return error.message || "Lỗi kết nối đến trợ lý AI."; } };

function renderFriendList() {
    const container = document.getElementById('friends-list-container');
    if (!container) return;
    const friendItems = container.querySelectorAll('.friend-item:not(#ai-assistant-chat-item)');
    friendItems.forEach(item => item.remove());
    if (!currentUser || !currentUser.friends || currentUser.friends.length === 0) {
        if (container.children.length <= 1 && !document.getElementById('no-friends-p')) { 
             const noFriendsEl = document.createElement('p');
             noFriendsEl.textContent = 'Chưa có bạn bè nào.';
             noFriendsEl.style.cssText = "padding: 15px; color: var(--text-light-color); font-size: 14px; text-align: center;";
             noFriendsEl.id = "no-friends-p";
             container.appendChild(noFriendsEl);
        }
        return;
    }
    const noFriendsP = document.getElementById('no-friends-p');
    if(noFriendsP) noFriendsP.remove();
    currentUser.friends.forEach(friendId => {
        const friendData = findUserById(friendId);
        if (friendData) {
            const isOnline = Math.random() > 0.5;
            const item = document.createElement('div');
            item.className = 'friend-item';
            item.dataset.action = 'open-chat';
            item.dataset.friendId = friendId;
            const avatarHTML = friendData.avatar ? `<img src="${friendData.avatar}" alt="${friendData.name}" onerror="this.onerror=null; this.src='../images/default-avatar.png';">` : friendData.name.charAt(0).toUpperCase();
            item.innerHTML = `<div class="friend-avatar">${avatarHTML}<div class="friend-status ${isOnline ? 'online' : ''}"></div></div><div class="friend-name">${friendData.name}</div>`;
            container.appendChild(item);
        }
    });
}

function renderNotifications() {
    const container = document.getElementById('notification-dropdown');
    const countBadge = document.getElementById('notification-count');
    if (!container || !countBadge) return;
    
    if (!container.querySelector('#notification-list')) {
        container.innerHTML = `
            <div class="notification-header">Thông báo</div>
            <div id="notification-list"></div>
        `;
    }
    const list = container.querySelector('#notification-list');
    list.innerHTML = '';
    
    let notifCount = 0;
    const friendRequests = currentUser.friendRequests || [];
    const projectInvites = currentUser.projectInvites || [];
    
    if (friendRequests.length === 0 && projectInvites.length === 0) {
        list.innerHTML = `<div class="no-notifications"><i class="fas fa-check-circle"></i><p>Không có thông báo mới.</p></div>`;
        countBadge.classList.add('hidden');
        return;
    }

    friendRequests.forEach(req => {
        notifCount++;
        const sender = findUserById(req.from);
        if (sender) {
            const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `
                <p><strong>${sender.name}</strong> đã gửi cho bạn một lời mời kết bạn.</p>
                <div class="actions">
                    <button class="btn btn-success btn-sm" data-action="accept-friend" data-sender-id="${req.from}">Đồng ý</button>
                    <button class="btn btn-danger btn-sm" data-action="decline-friend" data-sender-id="${req.from}">Từ chối</button>
                </div>`;
            list.appendChild(item);
        }
    });

    projectInvites.forEach(inv => {
        notifCount++;
        const inviter = findUserById(inv.from);
        if (inviter) {
             const item = document.createElement('div');
            item.className = 'notification-item';
            item.innerHTML = `
                <p><strong>${inviter.name}</strong> đã mời bạn vào dự án <strong>${inv.projectName}</strong>.</p>
                 <div class="actions">
                    <button class="btn btn-success btn-sm" data-action="accept-project" data-project-id="${inv.projectId}">Tham gia</button>
                    <button class="btn btn-danger btn-sm" data-action="decline-project" data-project-id="${inv.projectId}">Từ chối</button>
                </div>`;
            list.appendChild(item);
        }
    });

    countBadge.textContent = notifCount;
    countBadge.classList.toggle('hidden', notifCount === 0);
};

const openChatBox = async (friendId) => {
    const friendItem = document.querySelector(`.friend-item[data-friend-id="${friendId}"]`);
    const badge = friendItem?.querySelector('.message-badge');
    if (badge) badge.remove();
    
    const minimizedBubble = document.getElementById(`minimized-chat-${friendId}`); 
    if (minimizedBubble) { restoreChat(friendId); return; } 
    const chatContainer = document.getElementById('user-chat-container'); 
    const existingChat = document.getElementById(`chat-box-${friendId}`); 
    if (existingChat) { existingChat.querySelector('.chat-input-textarea').focus(); return; } 
    
    const template = document.getElementById('chat-box-template'); 
    const newChatBox = template.cloneNode(true); 
    newChatBox.id = `chat-box-${friendId}`; 
    newChatBox.dataset.friendId = friendId; 
    
    const messagesContainer = newChatBox.querySelector('.chat-box-messages'); 
    messagesContainer.innerHTML = ''; 
    const textarea = newChatBox.querySelector('.chat-input-textarea'); 
    const sendButton = newChatBox.querySelector('.send-btn'); 
    const headerAvatar = newChatBox.querySelector('.chat-box-header-avatar'); 
    const title = newChatBox.querySelector('.chat-box-title'); 
    const minimizeBtn = newChatBox.querySelector('.minimize-btn'); 
    const closeBtn = newChatBox.querySelector('.chat-close-btn'); 
    
    textarea.addEventListener('input', () => autoResizeChatTextarea(textarea)); 
    
    minimizeBtn.addEventListener('click', () => minimizeChat(friendId)); 
    closeBtn.addEventListener('click', () => newChatBox.remove()); 
    
    const sendAction = (e) => { 
        const currentFriendId = newChatBox.dataset.friendId; 
        if (currentFriendId === 'ai') { handleAiChatMessageSend(e, textarea); } 
        else { handleSendMessageInChat(e, textarea); } 
    }; 
    
    sendButton.addEventListener('click', sendAction); 
    textarea.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAction(e); } }); 
    
    if (friendId === 'ai') { 
        title.textContent = 'Người bạn AI'; 
        headerAvatar.innerHTML = `<i class="fas fa-robot"></i>`; 
        textarea.placeholder = 'Trò chuyện với HaiBanhU...'; 
        appendChatMessage('Chào bạn, tôi là HaiBanhU đây! Rất vui được gặp bạn. Có điều gì tôi có thể giúp hoặc bạn muốn trò chuyện không?', 'received', messagesContainer, 'ai'); 
    } else { 
        const friend = findUserById(friendId); 
        if (!friend) return; 
        title.textContent = friend.name; 
        headerAvatar.innerHTML = friend.avatar ? `<img src="${friend.avatar}" alt="${friend.name}" onerror="this.onerror=null; this.src='../images/default-avatar.png';">` : friend.name.charAt(0).toUpperCase(); 
        textarea.placeholder = `Nhắn tin tới ${friend.name}...`; 
        
        try {
            const history = await fetchWithAuth(`/api/chat/conversation/${friendId}`);
            if (history && history.length > 0) {
                history.forEach(msg => {
                    const senderType = String(msg.from) === String(currentUser.id) ? 'sent' : 'received';
                    appendChatMessage(msg.text, senderType, messagesContainer, msg.from);
                });
            }
        } catch (error) {
            showToast("Không thể tải lịch sử tin nhắn.", "error");
        }
    } 
    
    newChatBox.classList.remove('hidden'); 
    chatContainer.appendChild(newChatBox); 
    autoResizeChatTextarea(textarea);
    messagesContainer.scrollTop = messagesContainer.scrollHeight; 
    textarea.focus(); 
};

const handleSendMessageInChat = async (event, textareaElement) => {
    const input = textareaElement || event.target; 
    const text = input.value.trim(); 
    if (!text) return; 
    
    const chatBox = input.closest('.chat-box'); 
    const recipientId = chatBox.dataset.friendId; 
    const messagesContainer = chatBox.querySelector('.chat-box-messages'); 
    
    appendChatMessage(text, 'sent', messagesContainer, currentUser.id); 
    input.value = ''; 
    autoResizeChatTextarea(input); 

    socket.emit('sendMessage', {
        senderId: currentUser.id,
        recipientId: recipientId,
        text: text
    });
};

function minimizeChat(friendId) {
    const chatBox = document.getElementById(`chat-box-${friendId}`);
    if (!chatBox) return;

    chatBox.classList.add('hidden');
    
    const minimizedContainer = document.getElementById('minimized-chats-container');
    const existingBubble = document.getElementById(`minimized-chat-${friendId}`);
    if (existingBubble) return;

    const friend = friendId === 'ai' ? { id: 'ai', name: 'Người bạn AI' } : findUserById(friendId);
    if (!friend) return;

    const bubble = document.createElement('div');
    bubble.id = `minimized-chat-${friendId}`;
    bubble.className = 'minimized-chat-bubble';
    bubble.title = friend.name;
    bubble.dataset.friendId = friendId;
    bubble.addEventListener('click', () => restoreChat(friendId));

    if (friendId === 'ai') {
        bubble.innerHTML = '<i class="fas fa-robot"></i>';
    } else {
        bubble.innerHTML = friend.avatar ? `<img src="${friend.avatar}" alt="${friend.name}">` : friend.name.charAt(0).toUpperCase();
    }
    minimizedContainer.appendChild(bubble);
}

function restoreChat(friendId) {
    const chatBox = document.getElementById(`chat-box-${friendId}`);
    const bubble = document.getElementById(`minimized-chat-${friendId}`);
    if (chatBox) chatBox.classList.remove('hidden');
    if (bubble) bubble.remove();
    chatBox?.querySelector('.chat-input-textarea').focus();
}

function initializeSidebar() {
    renderFriendList();
    renderNotifications();

    socket.on('receiveMessage', (message) => {
        const senderId = message.sender.id || message.sender;
        const activeChatBox = document.querySelector(`.chat-box[data-friend-id="${senderId}"]`);

        if (activeChatBox && !activeChatBox.classList.contains('hidden')) {
            const messagesContainer = activeChatBox.querySelector('.chat-box-messages');
            appendChatMessage(message.text, 'received', messagesContainer, senderId);
        } else {
            const friendItem = document.querySelector(`.friend-item[data-friend-id="${senderId}"]`);
            if (friendItem) {
                let badge = friendItem.querySelector('.message-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'message-badge';
                    friendItem.appendChild(badge);
                }
                badge.textContent = (parseInt(badge.textContent) || 0) + 1;
                badge.style.display = 'flex';
            }
            showToast(`Bạn có tin nhắn mới`, 'info');
        }
    });
    
    if (!document.getElementById('sidebar-realtime-styles')) {
        const style = document.createElement('style');
        style.id = 'sidebar-realtime-styles';
        style.innerHTML = `
            .friend-item { position: relative; }
            .message-badge {
                position: absolute;
                top: 5px;
                right: 10px;
                background-color: var(--error-color);
                color: white;
                font-size: 10px;
                font-weight: bold;
                min-width: 18px;
                height: 18px;
                border-radius: 50%;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 0 4px;
                z-index: 1;
            }
        `;
        document.head.appendChild(style);
    }
}