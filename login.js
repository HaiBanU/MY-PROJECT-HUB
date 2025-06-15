// --- START OF FILE login.js (MODIFIED FOR RENDER) ---
document.addEventListener('DOMContentLoaded', () => {
    // << THAY ĐỔI Ở ĐÂY >>: Thêm logic xác định API_BASE_URL
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : window.location.origin;

    function showToast(message, type = 'info', duration = 4000) { const container = document.getElementById('toast-container'); if (!container) return; const toast = document.createElement('div'); toast.className = `toast ${type}`; const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' }; toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${message}</span>`; container.appendChild(toast); setTimeout(() => { toast.classList.add('exiting'); toast.addEventListener('animationend', () => toast.remove()); }, duration); }
    function saveSession(data) { localStorage.setItem('haiBanhU_Token', data.token); sessionStorage.setItem('haiBanhU_CurrentUser', JSON.stringify(data.user)); }
    
    function redirectToAppPage() {
        window.location.replace('/page/home.html');
    }

    const authContainer = document.getElementById('auth-container'); 
    const loginFormEl = document.getElementById('login-form'); 
    const registerFormEl = document.getElementById('register-form'); 
    
    const openAuthView = (initialView = 'login') => { 
        authContainer.classList.remove('hidden'); 
        document.body.classList.add('auth-open'); 
        const urlParams = new URLSearchParams(window.location.search); 
        urlParams.delete('modal'); 
        const newSearch = urlParams.toString(); 
        const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : ''); 
        if (window.history.replaceState) { window.history.replaceState({path: newUrl}, '', newUrl); } 
        loginFormEl.classList.remove('active'); registerFormEl.classList.remove('active'); 
        if (initialView === 'login') { loginFormEl.classList.add('active'); } 
        else { registerFormEl.classList.add('active'); } 
    };

    const closeAuthView = () => { 
        authContainer.classList.add('hidden'); 
        document.body.classList.remove('auth-open'); 
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('modal')) {
            urlParams.delete('modal');
            const newSearch = urlParams.toString();
            const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '');
            if (window.history.replaceState) {
                window.history.replaceState({path: newUrl}, '', newUrl);
            }
        }
    };
    
    const switchAuthForm = (targetForm) => { 
        loginFormEl.classList.remove('active'); 
        registerFormEl.classList.remove('active'); 
        if (targetForm === 'register') { 
            registerFormEl.classList.add('active'); 
        } else { 
            loginFormEl.classList.add('active'); 
        } 
    };
    
    // << THAY ĐỔI Ở ĐÂY >>: Sử dụng API_BASE_URL
    async function postData(url = '', data = {}) { 
        const response = await fetch(`${API_BASE_URL}${url}`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(data) 
        }); 
        const result = await response.json(); 
        if (!response.ok) { throw new Error(result.message || 'Đã có lỗi xảy ra.'); } 
        return result; 
    }
    
    const handleLogin = async (e) => { e.preventDefault(); const username = document.getElementById('login-username').value; const password = document.getElementById('login-password').value; showToast('Đang đăng nhập...', 'info'); try { const data = await postData('/api/auth/login', { username, password }); saveSession(data); showToast(data.message, 'success'); redirectToAppPage(); } catch (error) { showToast(error.message, 'error'); } };
    const handleRegister = async (e) => { e.preventDefault(); const name = document.getElementById('register-name').value; const username = document.getElementById('register-username').value; const password = document.getElementById('register-password').value; const confirmPassword = document.getElementById('register-confirm-password').value; if (username.length < 6) { showToast('Tên tài khoản phải có ít nhất 6 ký tự.', 'error'); return; } if (password !== confirmPassword) { showToast('Mật khẩu xác nhận không khớp.', 'error'); return; } showToast('Đang tạo tài khoản...', 'info'); try { const data = await postData('/api/auth/register', { name, username, password }); saveSession(data); showToast(data.message, 'success'); redirectToAppPage(); } catch (error) { showToast(error.message, 'error'); } };
    
    function main() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('logout')) {
            showToast('Bạn đã đăng xuất.', 'info');
            const newUrl = window.location.pathname;
             if (window.history.replaceState) {
                window.history.replaceState({path: newUrl}, '', newUrl);
            }
        }
        if (urlParams.has('modal')) { openAuthView(urlParams.get('modal')); }
        loginFormEl.addEventListener('submit', handleLogin);
        registerFormEl.addEventListener('submit', handleRegister);
        document.addEventListener('click', (e) => {
            const modalLink = e.target.closest('[data-modal]');
            if (modalLink) { e.preventDefault(); const urlParams = new URLSearchParams(window.location.search); const modalType = modalLink.dataset.modal; urlParams.set('modal', modalType); const newUrl = `${window.location.pathname}?${urlParams.toString()}`; if (window.history.pushState) { window.history.pushState({path: newUrl}, '', newUrl); } openAuthView(modalType); return; }
            const authActionLink = e.target.closest('[data-auth-action]');
            if (authActionLink) { e.preventDefault(); const action = authActionLink.dataset.authAction; switchAuthForm(action.replace('show-', '')); return; }
            if (e.target.closest('.close-modal-btn') || e.target.id === 'close-auth-btn') { closeAuthView(); return; }
        });
        window.addEventListener('popstate', (event) => {
            const urlParams = new URLSearchParams(window.location.search);
            if (!urlParams.has('modal')) { closeAuthView(); }
        });
    }
    main();
});