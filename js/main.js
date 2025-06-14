// --- START OF FILE js/main.js --- (PHIÊN BẢN SỬA LỖI TÌM KIẾM VÀ HIỂN THỊ BẠN BÈ/THÔNG BÁO)

// --- GLOBAL STATE & CONFIG ---
let currentUser = null; 
let allUsers = []; 
let currentProjectId = null;
let currentWorkflowId = null; 
let currentColumnStatus = null; 
let lastFocusedInput = null;

// --- ELEMENT SELECTORS (SHARED) ---
const body = document.body;
const header = document.querySelector('header');
const userMenu = document.getElementById('user-menu');

const modals = { 
    backdrop: document.getElementById('modal-backdrop'), 
    addProject: document.getElementById('add-project-modal'), 
    editProject: document.getElementById('edit-project-modal'), 
    addTask: document.getElementById('add-task-modal'), 
    taskDetail: document.getElementById('task-detail-modal'), 
    completeTask: document.getElementById('complete-task-modal'), 
    confirmation: document.getElementById('confirmation-modal'), 
    actionConfig: document.getElementById('action-config-modal'), 
    addWorkflow: document.getElementById('add-workflow-modal'),
    appPassword: document.getElementById('app-password-modal'),
    uploadFile: document.getElementById('upload-file-modal'),
    inviteToProject: document.getElementById('invite-to-project-modal')
};

const userMenuDropdown = document.getElementById('user-menu-dropdown');
const featuresMenuDropdown = document.getElementById('features-menu-dropdown');
const notificationBtn = document.getElementById('notification-btn');
const notificationDropdown = document.getElementById('notification-dropdown');

// --- CORE UTILITIES & HELPERS ---
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('haiBanhU_Token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) { headers['Authorization'] = `Bearer ${token}`; }

    // =========================================================================
    // SỬA LỖI Ở ĐÂY:
    // Xóa địa chỉ server cứng "https://my-project-hub.onrender.com"
    // Khi để trống, trình duyệt sẽ tự động gửi request đến domain hiện tại.
    // Nếu đang chạy ở http://localhost:3000, request sẽ đi đến http://localhost:3000/api/...
    // Nếu đang chạy ở https://my-project-hub.onrender.com, request sẽ đi đến https://my-project-hub.onrender.com/api/...
    // Điều này giúp code chạy đúng ở cả môi trường local và production.
    // =========================================================================
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 || response.status === 403) { handleLogout(); throw new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn."); }
    if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || `Lỗi HTTP: ${response.status}`); }
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) { return response.json(); } 
    return null;
}

function showToast(message, type = 'info', duration = 4000) { const container = document.getElementById('toast-container'); if (!container) return; const toast = document.createElement('div'); toast.className = `toast ${type}`; const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' }; toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${message}</span>`; container.appendChild(toast); setTimeout(() => { toast.classList.add('exiting'); toast.addEventListener('animationend', () => toast.remove()); }, duration); }
function showConfirmationModal(message, title = "Xác nhận hành động") { return new Promise((resolve) => { const confirmModal = modals.confirmation; if (!confirmModal) return resolve(false); confirmModal.querySelector('#confirmation-title').textContent = title; confirmModal.querySelector('#confirmation-message').textContent = message; const confirmBtn = confirmModal.querySelector('#confirm-btn'); const cancelBtn = confirmModal.querySelector('#cancel-btn'); const onConfirm = () => { closeModal(); cleanup(); resolve(true); }; const onCancel = () => { closeModal(); cleanup(); resolve(false); }; const cleanup = () => { confirmBtn.removeEventListener('click', onConfirm); cancelBtn.removeEventListener('click', onCancel); }; confirmBtn.addEventListener('click', onConfirm, { once: true }); cancelBtn.addEventListener('click', onCancel, { once: true }); openModal('confirmation'); }); }
const openModal = (modalName) => { const modalElement = modals[modalName]; if (modalElement) { modals.backdrop.classList.remove('hidden'); modalElement.classList.remove('hidden'); } else { console.error(`Lỗi: Không tìm thấy modal với tên "${modalName}".`); } };
const closeModal = () => { if(modals.backdrop) modals.backdrop.classList.add('hidden'); Object.values(modals).forEach(m => { if(m && m.id !== 'modal-backdrop') { m.classList.add('hidden'); } }); };
const fileToBase64 = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => resolve(reader.result); reader.onerror = error => reject(error); });

function updateActiveNav() {
    const currentPagePath = window.location.pathname;
    document.querySelectorAll('a.nav-link, .nav-item').forEach(link => {
        const linkHref = link.getAttribute('href');
        if (!linkHref || linkHref === '#') return;
        const linkPath = new URL(linkHref, window.location.origin).pathname;
        
        link.classList.remove('active');

        if (linkPath === currentPagePath) {
            link.classList.add('active');
            const dropdownMenu = link.closest('.dropdown-menu');
            if (dropdownMenu) {
                dropdownMenu.closest('.dropdown')?.querySelector('.nav-menu-toggle')?.classList.add('active');
            }
        }
    });
    
    const styleId = 'active-nav-style';
    let style = document.getElementById(styleId);
    if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
    }
    style.innerHTML = `
        .nav-item.active, .nav-menu-toggle.active { 
            color: var(--primary-color) !important; 
            background-color: var(--background-color); 
        }
        .dropdown-menu a.active { 
            background-color: var(--background-color); 
            color: var(--primary-color);
        }
        body.dark-mode .nav-item.active, body.dark-mode .nav-menu-toggle.active {
             background-color: var(--card-background-color);
        }
         body.dark-mode .dropdown-menu a.active { 
            background-color: var(--background-color);
        }
    `;
}

// --- USER & SESSION MANAGEMENT ---
function getCurrentUserFromSession() { const user = sessionStorage.getItem('haiBanhU_CurrentUser'); return user ? JSON.parse(user) : null; }
function saveCurrentUserToSession(user) { sessionStorage.setItem('haiBanhU_CurrentUser', JSON.stringify(user)); }
async function updateUserOnServer() { if (!currentUser) return; try { const dataToUpdate = { name: currentUser.name, bio: currentUser.bio, skills: currentUser.skills, projects: currentUser.projects, workflows: currentUser.workflows, friends: currentUser.friends, friendRequests: currentUser.friendRequests, connections: currentUser.connections, avatar: currentUser.avatar, projectInvites: currentUser.projectInvites }; const result = await fetchWithAuth('/api/user', { method: 'PUT', body: JSON.stringify(dataToUpdate) }); currentUser = result.user; saveCurrentUserToSession(currentUser); const userIndex = allUsers.findIndex(u => u.id === currentUser.id); if (userIndex !== -1) { allUsers[userIndex] = currentUser; } } catch (error) { console.error("Lỗi cập nhật người dùng:", error); showToast("Không thể lưu thay đổi.", "error"); } }
function findUserById(userId) { if (!userId || !allUsers) return null; return allUsers.find(u => String(u.id) === String(userId)); }
const handleLogout = () => { localStorage.removeItem('haiBanhU_Token'); sessionStorage.clear(); window.location.replace('/login.html?logout=true'); };

// --- LOGIC XỬ LÝ LỜI MỜI (QUAN TRỌNG: Đã cập nhật để render lại UI) ---
async function handleFriendRequestAction(senderId, action) { 
    try { 
        const result = await fetchWithAuth(`/api/friends/respond/${senderId}`, { method: 'POST', body: JSON.stringify({ action }) }); 
        showToast(result.message, 'success'); 
        currentUser = result.user; 
        saveCurrentUserToSession(currentUser); 
        
        let currentUserIndex = allUsers.findIndex(u => u.id === currentUser.id); 
        if (currentUserIndex > -1) allUsers[currentUserIndex] = currentUser; 
        
        if (action === 'accept') { 
            const senderIndex = allUsers.findIndex(u => String(u.id) === String(senderId)); 
            if (senderIndex > -1) { 
                if (!allUsers[senderIndex].friends) allUsers[senderIndex].friends = []; 
                if (!allUsers[senderIndex].friends.map(String).includes(String(currentUser.id))) { 
                    allUsers[senderIndex].friends.push(currentUser.id); 
                } 
            } 
        } 
        
        // Render lại các thành phần UI bị ảnh hưởng
        if(typeof renderNotifications === 'function') renderNotifications(); 
        if(typeof renderFriendList === 'function') renderFriendList(); 
        
        const publicProfileView = document.getElementById('public-profile-view'); 
        if (publicProfileView && !publicProfileView.classList.contains('hidden')) { 
            if (typeof showPublicProfile === 'function') showPublicProfile(senderId); 
        } 
    } catch (error) { 
        console.error("Lỗi phản hồi yêu cầu kết bạn:", error); 
        showToast(error.message, 'error'); 
    } 
}

async function handleProjectInviteAction(projectId, action) { 
    try { 
        const result = await fetchWithAuth(`/api/projects/respond/${projectId}`, { method: 'POST', body: JSON.stringify({ action }) }); 
        showToast(result.message, 'success'); 
        currentUser = result.user; 
        saveCurrentUserToSession(currentUser); 
        
        // Render lại các thành phần UI bị ảnh hưởng
        if(typeof renderNotifications === 'function') renderNotifications(); 
        if (window.location.pathname.includes('projects.html') && typeof renderProjects === 'function') { 
            renderProjects(); 
        } 
    } catch (error) { 
        console.error("Lỗi phản hồi lời mời dự án:", error); 
        showToast(error.message, 'error'); 
    } 
}

async function handlePendingProjectInvite() { let inviteCode = sessionStorage.getItem('pendingProjectInvite'); if (!inviteCode) return; sessionStorage.removeItem('pendingProjectInvite'); showToast('Đang kiểm tra lời mời tham gia dự án...', 'info'); try { const result = await fetchWithAuth(`/api/projects/join/${inviteCode}`, { method: 'GET' }); if (result.isMember) { showToast(`Bạn đã là thành viên của dự án "${result.project.name}"!`, 'info'); window.location.href = `/page/projects.html?viewProject=${result.project.id}`; return; } const confirmed = await showConfirmationModal(`Bạn có muốn tham gia dự án "${result.project.name}" không?`, 'Xác nhận tham gia'); if (confirmed) { await handleProjectInviteAction(result.project.id, 'accept'); window.location.href = `/page/projects.html?viewProject=${result.project.id}`; } } catch (error) { showToast(error.message, 'error'); } }

// --- Hàm xử lý tìm kiếm toàn cục ---
const handleGlobalSearch = (e) => {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (!query) return;
        // Chuyển hướng đến trang tìm kiếm với query
        window.location.href = `/page/search.html?q=${encodeURIComponent(query)}`;
    }
};

// --- INITIALIZATION & MAIN EVENT HANDLING ---
document.addEventListener('DOMContentLoaded', () => {
    const initializeApp = async () => {
        const token = localStorage.getItem('haiBanhU_Token');
        currentUser = getCurrentUserFromSession();
        if (!token || !currentUser) { window.location.replace('/login.html'); return; }
        try {
            allUsers = await fetchWithAuth('/api/users');
            updateInitialUI();
            await handlePendingProjectInvite();
            updateActiveNav();
            initializePageSpecificScripts();
        } catch(error) { console.error("Lỗi khởi tạo ứng dụng:", error.message); showToast("Lỗi kết nối đến server.", "error"); }
    };

    function updateInitialUI() {
        if (!currentUser) return;
        const rightSidebar = document.getElementById('right-sidebar');
        const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
        if (header) header.style.display = '';
        if(userMenu) userMenu.classList.remove('hidden');
        document.getElementById('username-display').textContent = currentUser.name;
        document.getElementById('user-avatar-nav').src = currentUser.avatar || '../images/default-avatar.png';
        document.getElementById('dropdown-username').textContent = currentUser.name;
        document.getElementById('dropdown-email').textContent = currentUser.email || 'Chưa có email';
        const welcomeMsg = document.getElementById('home-welcome-message');
        if(welcomeMsg) { welcomeMsg.textContent = `Chào mừng trở lại, ${currentUser.name}!`; }
        if(rightSidebar) rightSidebar.classList.remove('hidden'); 
        if(toggleSidebarBtn) toggleSidebarBtn.classList.remove('hidden');
        const sidebarState = localStorage.getItem('sidebarState');
        if (sidebarState === 'collapsed') { body.classList.add('sidebar-collapsed'); if(toggleSidebarBtn) toggleSidebarBtn.querySelector('i').classList.replace('fa-chevron-left', 'fa-chevron-right'); }
        
        const statProjects = document.getElementById('stat-projects');
        const statTasks = document.getElementById('stat-tasks');
        const statFriends = document.getElementById('stat-friends');

        if (statProjects && statTasks && statFriends) {
            const runningProjects = currentUser.projects?.length || 0;
            const todoTasks = currentUser.projects?.reduce((acc, p) => {
                return acc + (p.tasks?.filter(t => t.status === 'Việc Cần Làm').length || 0);
            }, 0) || 0;
            const friendsCount = currentUser.friends?.length || 0;

            statProjects.textContent = runningProjects;
            statTasks.textContent = todoTasks;
            statFriends.textContent = friendsCount;
        }
    }

    function initializePageSpecificScripts() {
        const path = window.location.pathname;
        if (typeof initializeSidebar === 'function') initializeSidebar();
        
        if (path.includes('home.html') && typeof initializeHomePage === 'function') {
            initializeHomePage();
        } else if (path.includes('projects.html') && typeof initializeProjectsPage === 'function') {
            initializeProjectsPage();
        } else if (path.includes('automation.html') && typeof initializeAutomationPage === 'function') {
            initializeAutomationPage();
        } else if (path.includes('profile.html') && typeof initializeProfilePage === 'function') {
            initializeProfilePage();
        } else if (path.includes('settings.html') && typeof initializeSettingsPage === 'function') {
            initializeSettingsPage();
        } else if (path.includes('search.html') && typeof initializeSearchPage === 'function') {
            initializeSearchPage();
        } else if (path.includes('image-studio.html') && typeof initializeImageStudioPage === 'function') {
            initializeImageStudioPage();
        }
    }

    function setupGlobalListeners() {
        // Thêm trình lắng nghe sự kiện cho thanh tìm kiếm ở đây
        const searchBar = document.getElementById('main-search-bar');
        if (searchBar) {
            searchBar.addEventListener('keypress', handleGlobalSearch);
        }

        document.body.addEventListener('click', (e) => {
            const t = e.target;
            const tClosest = (selector) => t.closest(selector);
            const userMenuToggle = tClosest('#user-menu-btn');
            const featuresMenuToggle = tClosest('#features-menu-btn');
            if (userMenuToggle) { userMenuDropdown.classList.toggle('hidden'); userMenu.classList.toggle('open'); if(featuresMenuDropdown) featuresMenuDropdown.classList.add('hidden'); document.getElementById('features-menu')?.classList.remove('open'); return; }
            if(featuresMenuToggle) { featuresMenuDropdown.classList.toggle('hidden'); document.getElementById('features-menu').classList.toggle('open'); if(userMenuDropdown) userMenuDropdown.classList.add('hidden'); if(userMenu) userMenu.classList.remove('open'); }
            if (!tClosest('.dropdown')) { document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden')); document.querySelectorAll('.dropdown').forEach(dd => dd.classList.remove('open')); }
            const notifBtn = tClosest('#notification-btn');
            if (notifBtn) { if(notificationDropdown) notificationDropdown.classList.toggle('hidden'); return; }
            if (notificationDropdown && !notificationDropdown.contains(t) && !notifBtn) { notificationDropdown.classList.add('hidden'); }
            if (tClosest('.close-modal-btn') || t.id === 'modal-backdrop' || tClosest('#cancel-btn')) { closeModal(); return; }
            const handlersById = {
                '#logout-btn': handleLogout,
                '#dark-mode-toggle': () => { body.classList.toggle('light-mode'); body.classList.toggle('dark-mode'); localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light'); },
                '#toggle-sidebar-btn': () => { body.classList.toggle('sidebar-collapsed'); const icon = tClosest('#toggle-sidebar-btn').querySelector('i'); icon.classList.toggle('fa-chevron-right'); icon.classList.toggle('fa-chevron-left'); localStorage.setItem('sidebarState', body.classList.contains('sidebar-collapsed') ? 'collapsed' : 'open'); },
                '#back-to-dashboard-btn': () => window.location.href = '/page/projects.html',
            };
            for (const [selector, handler] of Object.entries(handlersById)) { if (tClosest(selector)) { handler(); return; } }
            const actionTarget = tClosest('[data-action]');
            if (actionTarget) {
                const action = actionTarget.dataset.action;
                const friendId = actionTarget.dataset.friendId, senderId = actionTarget.dataset.senderId, targetId = actionTarget.dataset.targetId, projectId = actionTarget.dataset.projectId;
                switch (action) {
                    case 'open-chat': if (typeof openChatBox === 'function') openChatBox(friendId); break;
                    case 'accept-friend': case 'decline-friend': handleFriendRequestAction(senderId, action.split('-')[0]); break;
                    case 'accept-project': case 'decline-project': handleProjectInviteAction(projectId, action.split('-')[0]); break;
                    case 'add-friend': if (typeof sendFriendRequest === 'function') sendFriendRequest(targetId); break;
                    case 'view-own-profile': window.location.href = `/page/profile.html`; break;
                }
                return;
            }
            if (tClosest('.chat-close-btn')) { tClosest('.chat-box').remove(); return; }

            const chatActionBtn = tClosest('[data-chat-action]');
            if (chatActionBtn && !chatActionBtn.classList.contains('send-btn')) {
                e.preventDefault();
                const action = chatActionBtn.dataset.chatAction;
                const chatBox = chatActionBtn.closest('.chat-box');
                
                switch(action) {
                    case 'attach-file': {
                        const fileInput = chatBox.querySelector('[data-chat-action-input="file"]');
                        fileInput.onchange = (event) => {
                            const file = event.target.files[0];
                            if (file) { showToast(`Đã chọn tệp: ${file.name}. Chức năng gửi đang được phát triển.`, 'info'); }
                            event.target.value = null;
                        };
                        fileInput.click();
                        break;
                    }
                    case 'send-image': {
                        const imageInput = chatBox.querySelector('[data-chat-action-input="image"]');
                        imageInput.onchange = (event) => {
                             const file = event.target.files[0];
                            if (file) { showToast(`Đã chọn ảnh: ${file.name}. Chức năng gửi đang được phát triển.`, 'info'); }
                            event.target.value = null;
                        };
                        imageInput.click();
                        break;
                    }
                }
                return;
            }
        });
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') { body.classList.replace('light-mode', 'dark-mode'); } 
        else { body.classList.replace('dark-mode', 'light-mode'); }
    }

    initializeApp();
    setupGlobalListeners();
});