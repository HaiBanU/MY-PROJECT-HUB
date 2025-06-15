// --- START OF FILE js/search.js (MODIFIED TO FIX FRIEND REQUEST) ---

// << THÊM HÀM NÀY VÀO ĐẦU FILE >>
async function sendFriendRequest(targetId) {
    if (!targetId) return;
    const actionButton = document.querySelector(`[data-action="add-friend"][data-target-id="${targetId}"]`);
    if (actionButton) {
        actionButton.disabled = true;
        actionButton.textContent = 'Đang gửi...';
    }

    try {
        const result = await fetchWithAuth(`/api/friends/request/${targetId}`, {
            method: 'POST'
        });
        showToast(result.message, 'success');
        
        // Cập nhật lại giao diện nút bấm ngay lập tức
        if (actionButton) {
            actionButton.textContent = 'Đã gửi yêu cầu';
            actionButton.dataset.action = ''; // Vô hiệu hóa hành động tiếp theo
        }

        // Cập nhật lại dữ liệu người dùng được gửi yêu cầu trong state `allUsers`
        const targetUserIndex = allUsers.findIndex(u => String(u.id) === String(targetId));
        if (targetUserIndex > -1) {
            if (!allUsers[targetUserIndex].friendRequests) {
                allUsers[targetUserIndex].friendRequests = [];
            }
            allUsers[targetUserIndex].friendRequests.push({ from: currentUser.id, status: 'pending' });
        }

    } catch (error) {
        showToast(error.message, 'error');
        if (actionButton) {
            actionButton.disabled = false;
            actionButton.innerHTML = '<i class="fas fa-user-plus"></i> Thêm bạn bè';
        }
    }
}

function renderSearchResults(results) {
    const container = document.getElementById('search-results-container');
    if (!container) return;

    container.innerHTML = '';
    if (!results || results.length === 0) {
        container.innerHTML = '<p>Không tìm thấy kết quả nào phù hợp.</p>';
        return;
    }

    results.forEach(user => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.dataset.userId = user.id; // Dùng để click xem profile
        
        const avatarHTML = user.avatar 
            ? `<img src="${user.avatar}" alt="${user.name}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;" onerror="this.onerror=null; this.src='../images/default-avatar.png';">` 
            : `<div class="profile-public-avatar" style="width: 50px; height: 50px; font-size: 1.5rem;">${user.name.charAt(0).toUpperCase()}</div>`;
            
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                 ${avatarHTML}
                 <div>
                    <h3>${user.name}</h3>
                    <p style="margin: 0; color: var(--text-light-color);">@${user.username}</p>
                 </div>
            </div>
            <div class="skills-container">${user.skills && user.skills.length > 0 ? user.skills.map(s => `<span class="skill-tag">${s}</span>`).join('') : '<p style="font-size: 14px; color: var(--text-light-color);">Chưa có kỹ năng.</p>'}</div>
        `;
        container.appendChild(item);
    });
}

function showPublicProfile(userId) {
    const targetUserId = String(userId);
    const user = findUserById(targetUserId);

    if (!user) { 
        showToast('Không tìm thấy người dùng này.', 'error'); 
        return; 
    }
    
    const searchView = document.getElementById('search-results-view');
    const profileView = document.getElementById('public-profile-view');
    if (searchView) searchView.classList.add('hidden');
    if (profileView) profileView.classList.remove('hidden');

    let actionButtonHTML = '';
    const currentUserIdString = String(currentUser.id);

    if (targetUserId === currentUserIdString) {
        actionButtonHTML = `<a href="/page/profile.html" class="btn btn-primary"><i class="fas fa-edit"></i> Chỉnh sửa Hồ sơ</a>`;
    } else {
        const isFriend = (currentUser.friends || []).map(String).includes(targetUserId);
        const hasSentRequest = (user.friendRequests || []).some(req => String(req.from) === currentUserIdString);
        const hasReceivedRequest = (currentUser.friendRequests || []).some(req => String(req.from) === targetUserId);

        if (isFriend) { 
            actionButtonHTML = '<button class="btn btn-secondary" disabled><i class="fas fa-user-check"></i> Bạn bè</button>'; 
        } else if (hasSentRequest) { 
            actionButtonHTML = '<button class="btn btn-secondary" disabled>Đã gửi yêu cầu</button>'; 
        } else if (hasReceivedRequest) { 
            actionButtonHTML = `<button class="btn btn-success" data-action="accept-friend" data-sender-id="${targetUserId}">Chấp nhận</button><button class="btn btn-danger" data-action="decline-friend" data-sender-id="${targetUserId}">Từ chối</button>`; 
        } else { 
            actionButtonHTML = `<button class="btn btn-primary" data-action="add-friend" data-target-id="${targetUserId}"><i class="fas fa-user-plus"></i> Thêm bạn bè</button>`; 
        }
    }
    
    let avatarHTML = user.avatar ? `<img src="${user.avatar}" alt="Ảnh đại diện của ${user.name}" onerror="this.onerror=null; this.src='../images/default-avatar.png';">` : (user.name ? user.name.charAt(0).toUpperCase() : '');
    
    profileView.innerHTML = `
        <div class="profile-public-header">
            <div class="profile-public-avatar">${avatarHTML}</div>
            <div class="profile-public-info">
                <h1>${user.name}</h1>
                <p>${user.bio || 'Người dùng này chưa có giới thiệu.'}</p>
                <div class="profile-actions">${actionButtonHTML}</div>
            </div>
        </div>
        <div class="profile-public-body">
            <div class="profile-section-card"><h3>Giới thiệu</h3><p>${user.bio || 'Chưa có thông tin.'}</p></div>
            <div class="profile-section-card"><h3>Kỹ năng</h3><div class="skills-container">${user.skills && user.skills.length > 0 ? user.skills.map(s => `<span class="skill-tag">${s}</span>`).join('') : '<p>Chưa cập nhật kỹ năng.</p>'}</div></div>
        </div>`;
}

function initializeSearchPage() {
    const waitForUsers = setInterval(() => {
        if (typeof allUsers !== 'undefined' && allUsers.length > 0 && currentUser) {
            clearInterval(waitForUsers);
            
            const urlParams = new URLSearchParams(window.location.search);
            const query = urlParams.get('q');
            
            if (query) {
                const queryDisplay = document.getElementById('search-query-display');
                if (queryDisplay) queryDisplay.textContent = query;
                 document.getElementById('main-search-bar').value = query;

                const decodedQuery = decodeURIComponent(query).toLowerCase();
                const filteredUsers = allUsers.filter(user => 
                    user.id !== currentUser.id && (
                        user.name.toLowerCase().includes(decodedQuery) ||
                        (user.skills && user.skills.some(skill => skill.toLowerCase().includes(decodedQuery))) ||
                        user.username.toLowerCase().includes(decodedQuery)
                    )
                );
                renderSearchResults(filteredUsers);
            }
        }
    }, 100);

    document.body.addEventListener('click', (e) => {
        const searchItem = e.target.closest('.search-result-item');
        if (searchItem && searchItem.dataset.userId) {
            showPublicProfile(searchItem.dataset.userId);
        }
    });
}