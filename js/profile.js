// --- START OF FILE js/profile.js --- (PHIÊN BẢN SỬA LỖI TÌM KIẾM)

function populateProfileForm() {
    if (currentUser) {
        const avatarWrapper = document.querySelector('.profile-avatar-wrapper');
        if (avatarWrapper) {
            if (currentUser.avatar) {
                avatarWrapper.innerHTML = `
                    <img id="profile-avatar-img" src="${currentUser.avatar}" alt="Ảnh đại diện" onerror="this.onerror=null; this.src='../images/default-avatar.png';">
                    <div class="profile-avatar-overlay"><i class="fas fa-camera"></i><span>Thay đổi</span></div>
                `;
            } else {
                const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '?';
                avatarWrapper.innerHTML = `
                    <div class="profile-avatar-initials">${initial}</div>
                    <div class="profile-avatar-overlay"><i class="fas fa-camera"></i><span>Thay đổi</span></div>
                `;
            }
        }
        
        document.getElementById('profile-name').value = currentUser.name;
        document.getElementById('profile-email').value = currentUser.email || '';
        document.getElementById('profile-email').disabled = !!currentUser.email;
        document.getElementById('profile-bio').value = currentUser.bio || '';
        document.getElementById('profile-skills').value = currentUser.skills ? currentUser.skills.join(', ') : '';
    }
}

async function handleProfileFormSubmit(e) {
    e.preventDefault();
    if (currentUser) {
        currentUser.name = document.getElementById('profile-name').value;
        currentUser.bio = document.getElementById('profile-bio').value;
        currentUser.skills = document.getElementById('profile-skills').value.split(',').map(s => s.trim()).filter(Boolean);
        await updateUserOnServer();
        document.getElementById('username-display').textContent = currentUser.name;
        document.getElementById('dropdown-username').textContent = currentUser.name;
        const welcomeMsg = document.getElementById('home-welcome-message');
        if (welcomeMsg) {
             welcomeMsg.textContent = `Chào mừng trở lại, ${currentUser.name}!`;
        }
        showToast('Cập nhật thông tin thành công!', 'success');
    }
}

const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        showToast('Lỗi: Kích thước tệp không được vượt quá 2MB.', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = async function(event) {
        const base64String = event.target.result;
        currentUser.avatar = base64String;
        await updateUserOnServer();
        document.getElementById('user-avatar-nav').src = base64String;
        populateProfileForm(); 
        showToast('Đã cập nhật ảnh đại diện.', 'success');
    }
    reader.readAsDataURL(file);
};

// <<< SỬA LỖI TÌM KIẾM >>>
// Hàm này đã được chuyển sang main.js để trở thành global, không cần ở đây nữa.
// const handleSearch = (e) => { ... };

const handleChangePassword = async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;

    if (newPassword !== confirmNewPassword) {
        showToast("Mật khẩu mới không khớp.", "error");
        return;
    }
    if (!currentUser.password) {
        showToast("Không thể đổi mật khẩu cho tài khoản đăng nhập bằng Google.", "error");
        return;
    }

    try {
        const result = await fetchWithAuth('/api/user/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        showToast(result.message, 'success');
        e.target.reset();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const handleDeleteAccount = async () => {
    const confirmed = await showConfirmationModal(
        "Hành động này không thể hoàn tác! Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản của mình không?",
        "Xác nhận Xóa Tài khoản"
    );
    if (!confirmed) return;

    try {
        const result = await fetchWithAuth('/api/user/delete-account', { method: 'DELETE' });
        showToast(result.message, 'info');
        handleLogout();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

const sendFriendRequest = async (targetUserId) => {
    try {
        const result = await fetchWithAuth(`/api/friends/request/${targetUserId}`, { method: 'POST' });
        showToast(result.message, 'success');
        
        const userIndex = allUsers.findIndex(u => String(u.id) === String(targetUserId));
        if(userIndex !== -1) {
            allUsers[userIndex] = result.user;
        }
        if (typeof showPublicProfile === 'function') {
            showPublicProfile(targetUserId);
        }
    } catch (error) {
        console.error("Lỗi gửi yêu cầu kết bạn:", error);
        showToast(error.message, 'error');
    }
};

function initializeProfilePage() {
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        populateProfileForm();
        profileForm.addEventListener('submit', handleProfileFormSubmit);
    }
    
    // <<< SỬA LỖI TÌM KIẾM >>>
    // Không cần thêm listener ở đây nữa vì đã có listener global trong main.js
    // const searchBar = document.getElementById('main-search-bar');
    // if (searchBar) { ... }

    document.body.addEventListener('change', (e) => {
        if(e.target.id === 'avatar-upload-input') {
            handleAvatarChange(e);
        }
    });

    document.body.addEventListener('click', e => {
        if (e.target.closest('.profile-avatar-wrapper')) {
            document.getElementById('avatar-upload-input')?.click();
        }
    });
}

function initializeSettingsPage() {
    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) changePasswordForm.addEventListener('submit', handleChangePassword);
    
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', handleDeleteAccount);
}