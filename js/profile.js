// --- START OF FILE js/profile.js (CẬP NHẬT HOÀN CHỈNH) ---

// === CÁC HÀM XỬ LÝ LOGIC ===

async function handleLeaveProject(projectId) {
    const project = currentUser.projects.find(p => p.id === projectId);
    if (!project) return;

    const confirmed = await showConfirmationModal(`Bạn có chắc chắn muốn rời khỏi dự án "${project.name}" không?`, 'Xác nhận rời dự án');
    if (!confirmed) return;

    try {
        const result = await fetchWithAuth(`/api/projects/${projectId}/leave`, {
            method: 'DELETE'
        });
        showToast(result.message, 'success');
        
        currentUser = result.user;
        saveCurrentUserToSession(currentUser);
        populateProfileForm(); 

    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleDisconnectGoogle() {
    const confirmed = await showConfirmationModal("Bạn có chắc chắn muốn hủy liên kết tài khoản Google không? Các quy trình tự động hóa sử dụng Gmail sẽ không hoạt động.", "Xác nhận Hủy liên kết");
    if (!confirmed) return;

    try {
        const result = await fetchWithAuth('/api/user/disconnect/google', {
            method: 'POST'
        });
        showToast(result.message, 'success');
        
        currentUser = result.user;
        saveCurrentUserToSession(currentUser);
        renderConnections(); 

        if (document.getElementById('automation-config-details') && typeof renderAutomationConfig === 'function') {
            renderAutomationConfig();
        }

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// === CÁC HÀM RENDER GIAO DIỆN ===

function populateProfileForm() {
    if (!currentUser) return;
    
    // Cập nhật thẻ profile bên trái
    const avatarImg = document.getElementById('profile-avatar-img');
    if (avatarImg) avatarImg.src = currentUser.avatar || '../images/default-avatar.png';
    
    document.getElementById('profile-sidebar-name').textContent = currentUser.name;
    document.getElementById('profile-sidebar-title').textContent = currentUser.title || 'Chưa có chức danh';
    
    // Điền form chỉnh sửa
    document.getElementById('profile-name').value = currentUser.name || '';
    document.getElementById('profile-title').value = currentUser.title || '';
    document.getElementById('profile-email').value = currentUser.email || '';
    document.getElementById('profile-email').disabled = !!currentUser.email;
    document.getElementById('profile-bio').value = currentUser.bio || '';
    document.getElementById('profile-skills').value = currentUser.skills ? currentUser.skills.join(', ') : '';

    // Render danh sách dự án
    const projectsListContainer = document.getElementById('profile-projects-list');
    if (projectsListContainer) {
        projectsListContainer.innerHTML = '';
        if (currentUser.projects && currentUser.projects.length > 0) {
            currentUser.projects.forEach(project => {
                const projectItem = document.createElement('div');
                projectItem.className = 'project-item';
                
                const isOwner = String(project.ownerId) === String(currentUser.id);
                const actionButton = isOwner
                    ? `<span class="skill-tag" style="background: var(--accent-color)">Chủ sở hữu</span>`
                    : `<button class="btn btn-secondary btn-sm" data-action="leave-project" data-project-id="${project.id}">Rời khỏi</button>`;

                projectItem.innerHTML = `
                    <a href="/page/projects.html?viewProject=${project.id}" class="project-item-link">
                        <div class="project-item-icon"><i class="fas fa-table-columns"></i></div>
                        <div class="project-item-info">
                            <h4>${project.name}</h4>
                            <p>${project.description || 'Không có mô tả'}</p>
                        </div>
                    </a>
                    <div class="project-item-actions">
                        ${actionButton}
                    </div>
                `;
                projectsListContainer.appendChild(projectItem);
            });
        } else {
            projectsListContainer.innerHTML = '<p>Bạn chưa tham gia dự án nào.</p>';
        }
    }
}

function renderConnections() {
    const container = document.getElementById('connections-list');
    if(!container) return;

    const gmailConn = currentUser.connections?.gmail;
    let gmailHTML = `
        <div class="connection-item">
            <div class="connection-info">
                <i class="fab fa-google" style="color: #DB4437;"></i>
                <div class="connection-details">
                    <span class="connection-name">Google / Gmail</span>
                    <span class="connection-email">${gmailConn?.connected ? gmailConn.name : 'Chưa liên kết'}</span>
                </div>
            </div>
            <button class="btn ${gmailConn?.connected ? 'btn-danger' : 'btn-primary'}" id="google-connect-btn" data-action="${gmailConn?.connected ? 'disconnect-google' : 'connect-google'}">
                ${gmailConn?.connected ? 'Hủy liên kết' : 'Liên kết'}
            </button>
        </div>
    `;
    container.innerHTML = gmailHTML;
}

// === CÁC HÀM KHỞI TẠO VÀ SỰ KIỆN ===

function initializeProfilePage() {
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        populateProfileForm();
        profileForm.addEventListener('submit', handleProfileFormSubmit);
    }

    document.body.addEventListener('change', (e) => {
        if (e.target.id === 'avatar-upload-input') handleAvatarChange(e);
    });

    const projectList = document.getElementById('profile-projects-list');
    if (projectList) {
        projectList.addEventListener('click', (e) => {
            const leaveBtn = e.target.closest('[data-action="leave-project"]');
            if (leaveBtn) {
                handleLeaveProject(leaveBtn.dataset.projectId);
            }
        });
    }
}

function initializeSettingsPage() {
    const tabsContainer = document.getElementById('settings-tabs-container');
    const tabContents = document.querySelectorAll('.settings-tab-content');

    if (tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('.settings-tab-btn');
            if (!tabBtn) return;
            tabsContainer.querySelector('.active').classList.remove('active');
            tabBtn.classList.add('active');
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`settings-tab-${tabBtn.dataset.tab}`).classList.add('active');
        });
    }
    
    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) changePasswordForm.addEventListener('submit', handleChangePassword);
    
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', handleDeleteAccount);
    
    const deleteConfirmInput = document.getElementById('delete-confirm-input');
    const finalDeleteBtn = document.getElementById('final-delete-btn');
    if (deleteConfirmInput && finalDeleteBtn) {
        deleteConfirmInput.addEventListener('input', () => {
            finalDeleteBtn.disabled = deleteConfirmInput.value !== currentUser.username;
        });
        finalDeleteBtn.addEventListener('click', handleFinalDelete);
    }
    
    renderConnections();

    const connectionsList = document.getElementById('connections-list');
    if (connectionsList) {
        connectionsList.addEventListener('click', (e) => {
            const connectBtn = e.target.closest('[data-action]');
            if (!connectBtn) return;
            const action = connectBtn.dataset.action;
            if (action === 'disconnect-google') {
                handleDisconnectGoogle();
            } else if (action === 'connect-google') {
                showToast("Vui lòng liên kết trong trang Tự động hóa.", "info");
                window.location.href = '/page/automation.html';
            }
        });
    }
}

// --- CÁC HÀM GỐC KHÔNG ĐỔI ---
async function handleProfileFormSubmit(e) { e.preventDefault(); if (currentUser) { currentUser.name = document.getElementById('profile-name').value; currentUser.title = document.getElementById('profile-title').value; currentUser.bio = document.getElementById('profile-bio').value; currentUser.skills = document.getElementById('profile-skills').value.split(',').map(s => s.trim()).filter(Boolean); await updateUserOnServer(); document.getElementById('username-display').textContent = currentUser.name; document.getElementById('dropdown-username').textContent = currentUser.name; populateProfileForm(); showToast('Cập nhật thông tin thành công!', 'success'); } }
const handleAvatarChange = async (e) => { const file = e.target.files[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { showToast('Lỗi: Kích thước tệp không được vượt quá 2MB.', 'error'); return; } const base64String = await fileToBase64(file); currentUser.avatar = base64String; await updateUserOnServer(); document.getElementById('user-avatar-nav').src = base64String; populateProfileForm(); showToast('Đã cập nhật ảnh đại diện.', 'success'); };
const handleChangePassword = async (e) => { e.preventDefault(); const form = e.target; const currentPassword = document.getElementById('current-password').value; const newPassword = document.getElementById('new-password').value; const confirmNewPassword = document.getElementById('confirm-new-password').value; if (newPassword !== confirmNewPassword) { showToast("Mật khẩu mới không khớp.", "error"); return; } if (!currentUser.password) { showToast("Không thể đổi mật khẩu cho tài khoản đăng nhập bằng Google.", "error"); form.reset(); return; } try { const result = await fetchWithAuth('/api/user/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); showToast(result.message, 'success'); form.reset(); } catch (error) { showToast(error.message, 'error'); } };
const handleDeleteAccount = async () => { const verificationDiv = document.getElementById('delete-account-verification'); verificationDiv.classList.remove('hidden'); document.getElementById('delete-account-confirm').textContent = currentUser.username; };
const handleFinalDelete = async () => { try { const result = await fetchWithAuth('/api/user/delete-account', { method: 'DELETE' }); showToast(result.message, 'info'); setTimeout(handleLogout, 2000); } catch (error) { showToast(error.message, 'error'); } };