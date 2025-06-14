// --- START OF FILE js/projects.js --- (PHIÊN BẢN CÓ GIAO DIỆN CHỌN THÀNH VIÊN)

function switchProjectTab(tabName) {
    document.querySelectorAll('.project-nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.project-tab-content').forEach(content => content.classList.remove('active'));
    
    const activeBtn = document.querySelector(`.project-nav-btn[data-project-tab="${tabName}"]`);
    const activeContent = document.getElementById(`project-tab-${tabName}`);
    
    if (activeBtn) activeBtn.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
    
    if (currentProjectId) {
        localStorage.setItem(`projectTab_${currentProjectId}`, tabName);
    }
}

function showDashboardView() {
    const dashboardView = document.getElementById('dashboard');
    const projectDetailView = document.getElementById('project-detail');
    if (dashboardView) dashboardView.classList.remove('hidden');
    if (projectDetailView) projectDetailView.classList.add('hidden');
    history.pushState(null, '', '/page/projects.html');
}

function showProjectDetail(id) { 
    const dashboardView = document.getElementById('dashboard');
    const projectDetailView = document.getElementById('project-detail');
    if (dashboardView) dashboardView.classList.add('hidden');
    if (projectDetailView) projectDetailView.classList.remove('hidden');
    
    currentProjectId = String(id); 
    const project = currentUser.projects.find(proj => proj.id === currentProjectId); 
    if (!project) { 
        showToast("Không tìm thấy dự án.", "error"); 
        showDashboardView(); 
        return; 
    } 

    const urlParams = new URLSearchParams(window.location.search);
    const newUrl = `/page/projects.html?viewProject=${id}`;

    if (window.location.search !== `?viewProject=${id}`) {
        history.pushState({ projectId: id }, `Dự án: ${project.name}`, newUrl);
    }

    const isMember = project.members.map(String).includes(String(currentUser.id));
    document.getElementById('project-title').textContent = project.name; 
    renderMemberAvatars(project.members); 
    renderTaskBoard(project, isMember);
    renderDocumentList(project, isMember);
    renderProjectMembers(project);
    
    const currentTab = localStorage.getItem(`projectTab_${id}`) || 'tasks';
    switchProjectTab(currentTab);

    const taskIdToOpen = urlParams.get('openTask');
    if (taskIdToOpen) {
        openTaskDetailModal(taskIdToOpen);
        urlParams.delete('openTask');
        const cleanUrl = window.location.pathname + '?' + urlParams.toString();
        history.replaceState(null, '', cleanUrl);
    }
};

function renderProjects() { 
    const list = document.getElementById('project-list'); 
    if (!list) return; 
    list.innerHTML = ''; 
    if (!currentUser || !currentUser.projects || currentUser.projects.length === 0) { 
        list.innerHTML = `<p>Chưa có dự án nào. Hãy tạo một dự án mới để bắt đầu!</p>`; 
        return; 
    } 
    currentUser.projects.forEach((p, index) => { 
        const total = (p.tasks && p.tasks.filter(t => t.status !== 'DOCS').length) || 0; 
        const done = (p.tasks && p.tasks.filter(t => t.status === 'Đã Hoàn Thành').length) || 0; 
        const progress = total > 0 ? Math.round((done / total) * 100) : 0; 
        let deadlineHTML = ''; 
        if (p.deadline) { 
            const due = new Date(p.deadline); 
            const today = new Date(); 
            today.setHours(0, 0, 0, 0); 
            const diff = Math.ceil((due - today) / 864e5); 
            let cls = ''; 
            let text = `Hạn: ${due.toLocaleDateString('vi-VN')}`; 
            if (diff < 0) { cls = 'overdue'; text = `Quá hạn ${Math.abs(diff)} ngày`; } 
            else if (diff >= 0 && diff <= 7) { cls = 'due-soon'; text = `Còn ${diff} ngày`; } 
            deadlineHTML = `<div class="project-deadline ${cls}"><i class="fa-regular fa-calendar-times"></i> ${text}</div>`; 
        } 
        const card = document.createElement('div'); 
        card.className = 'project-card'; 
        card.style.animationDelay = `${index * 50}ms`; 
        card.dataset.projectId = p.id; 
        card.innerHTML = ` <div class="card-body" data-action="view-project" data-project-id="${p.id}"> <h3>${p.name}</h3> <p>${p.description || 'Không có mô tả.'}</p> <div class="progress-container"> <div class="progress-text">${done}/${total} công việc</div> <div class="progress-bar"><div class="progress" style="width: ${progress}%;"></div></div> </div> </div> <div class="card-actions"> ${deadlineHTML || '<div></div>'} <button class="btn btn-secondary btn-sm" data-action="delete-project-card" data-project-id="${p.id}"><i class="fas fa-trash-can"></i></button> </div>`; 
        list.appendChild(card); 
    }); 
}

function renderMemberAvatars(memberIds) { 
    const container = document.getElementById('project-member-avatars'); 
    if (!container) return; 
    container.innerHTML = ''; 
    if (!memberIds) return; 
    memberIds.forEach(id => { 
        const member = findUserById(id); 
        if (member) { 
            const avatarEl = document.createElement('div'); 
            avatarEl.className = 'member-avatar'; 
            avatarEl.title = member.name; 
            const avatarHTML = member.avatar ? `<img src="${member.avatar}" alt="${member.name}" onerror="this.onerror=null; this.src='../images/default-avatar.png';">` : member.name.charAt(0).toUpperCase(); 
            avatarEl.innerHTML = avatarHTML; 
            container.appendChild(avatarEl); 
        } 
    }); 
}

function renderTaskBoard(project, isMember) {
    const board = document.getElementById('task-columns');
    if(!board) return;
    board.innerHTML = '';
    const statuses = ['Việc Cần Làm', 'Đang Làm', 'Đã Hoàn Thành']; 
    
    statuses.forEach(status => { 
        const col = document.createElement('div'); 
        col.className = 'task-column'; 
        col.dataset.status = status; 
        const addButtonHTML = (isMember) ? `<button class="add-task-btn" data-status="${status}">+</button>` : ''; 
        col.innerHTML = `<div class="task-column-header"><h3>${status}</h3>${addButtonHTML}</div><div class="task-list"></div>`; 
        board.appendChild(col); 
    }); 
    
    const tasks = (project.tasks || []).filter(t => t.status !== 'DOCS');
    tasks.forEach(t => { 
        const card = document.createElement('div'); 
        card.className = 'task-card'; 
        card.dataset.taskId = t.id; 
        let actionButtonsHTML = ''; 
        if (isMember) {
            if (t.status === 'Việc Cần Làm') { 
                actionButtonsHTML = `<button class="task-action-btn" data-task-id="${t.id}" data-action="next" title="Bắt đầu"><i class="fas fa-play"></i></button>`; 
            } else if (t.status === 'Đang Làm') { 
                actionButtonsHTML = `<button class="task-action-btn" data-task-id="${t.id}" data-action="prev" title="Quay lại"><i class="fas fa-arrow-left"></i></button><button class="task-action-btn" data-task-id="${t.id}" data-action="complete" title="Hoàn thành"><i class="fas fa-check"></i></button>`; 
            }
        }
        const today = new Date(); 
        let isOverdue = false; 
        let footerInfoHTML = ''; 
        if (t.dueDate) { const dueDate = new Date(t.dueDate); if (today.setHours(0,0,0,0) > dueDate.setHours(0,0,0,0) && t.status !== 'Đã Hoàn Thành') { isOverdue = true; } } 
        if (t.status === 'Đã Hoàn Thành') { card.classList.add('is-completed'); const completedDate = new Date(t.completedOn); let onTimeStatus = ''; if (t.dueDate) { const dueDate = new Date(t.dueDate); if (completedDate.setHours(0,0,0,0) <= dueDate.setHours(0,0,0,0)) { onTimeStatus = `<span class="due-date" style="color: var(--success-color);"><i class="fas fa-check-circle"></i> Đúng hạn</span>`; } else { onTimeStatus = `<span class="due-date overdue"><i class="fas fa-times-circle"></i> Trễ hạn</span>`; } } footerInfoHTML = `<span class="due-date"><i class="fa-regular fa-calendar-check"></i> HT: ${completedDate.toLocaleDateString('vi-VN')}</span> ${onTimeStatus}`; } else { if (t.dueDate) { const due = new Date(t.dueDate); const diff = Math.ceil((due - today) / 864e5); let cls = isOverdue ? 'overdue' : (diff <= 7 ? 'due-soon' : ''); footerInfoHTML = `<span class="due-date ${cls}"><i class="fa-regular fa-calendar"></i> ${due.toLocaleDateString('vi-VN')}</span>`; } } if (isOverdue) { card.classList.add('is-overdue'); } 
        let attachmentHTML = ''; 
        if (t.attachment && t.attachment.name) { attachmentHTML = `<div class="task-attachment"><a href="#" class="download-attachment-link" data-task-id="${t.id}"><i class="fas fa-paperclip"></i> ${t.attachment.name}</a></div>`; }
        let tagsHTML = '';
        if (t.assignee) { tagsHTML = `<div class="tags-container">${t.assignee.split(',').map(tag => `<span class="skill-tag">${tag.trim()}</span>`).join('')}</div>`; }
        card.innerHTML = `<p data-task-id="${t.id}" class="task-title-clickable">${t.title}</p><div class="task-card-footer"><div class="task-card-info">${footerInfoHTML}</div>${tagsHTML}${attachmentHTML}</div><div class="task-card-actions">${actionButtonsHTML}</div>`;
        const list = board.querySelector(`.task-column[data-status="${t.status}"] .task-list`); 
        if (list) list.appendChild(card); 
    }); 
}

function renderDocumentList(project, isMember) {
    const docListContainer = document.getElementById('document-list');
    if(!docListContainer) return;
    docListContainer.innerHTML = '';
    const docs = (project.tasks || []).filter(t => t.status === 'DOCS');
    if (docs.length === 0) {
        docListContainer.innerHTML = '<p>Chưa có tài liệu nào trong dự án này.</p>';
        return;
    }
    docs.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'doc-list-card';
        card.dataset.docId = doc.id;
        const deleteBtn = isMember ? `<button class="btn btn-secondary btn-sm" data-action="delete-document-card" data-doc-id="${doc.id}"><i class="fas fa-trash-can"></i></button>` : '';
        card.innerHTML = `
            <div class="card-body" data-action="download-document" data-doc-id="${doc.id}">
                <i class="fa-solid fa-file-arrow-down"></i>
                <h3>${doc.title}</h3>
                <p>${doc.attachment?.name || 'Không có tệp gốc'}</p>
            </div>
            <div class="card-actions">
                <div class="doc-card-meta">
                    <span>Tải lên lúc: ${new Date(doc.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
                ${deleteBtn}
            </div>
        `;
        docListContainer.appendChild(card);
    });
}

function renderProjectMembers(project) {
    const container = document.getElementById('member-list-container');
    if (!container) return;
    container.innerHTML = '';
    (project.members || []).forEach(memberId => {
        const member = findUserById(memberId);
        if(member) {
            const item = document.createElement('div');
            item.className = 'member-list-item';
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'member-list-avatar';
            avatarDiv.innerHTML = `<img src="${member.avatar || '../images/default-avatar.png'}" alt="${member.name}" onerror="this.onerror=null; this.src='../images/default-avatar.png';">`;
            if (String(member.id) === String(project.ownerId)) {
                avatarDiv.innerHTML += `<i class="fas fa-crown owner-crown"></i>`;
            }
            item.appendChild(avatarDiv);
            const nameSpan = document.createElement('span');
            nameSpan.className = 'member-list-name';
            nameSpan.textContent = member.name;
            item.appendChild(nameSpan);
            container.appendChild(item);
        }
    });
}

async function handleUploadFileFormSubmit(e) { e.preventDefault(); const title = document.getElementById('file-upload-title').value.trim(); const fileInput = document.getElementById('file-upload-input'); if (!title || fileInput.files.length === 0) { showToast('Vui lòng nhập tên và chọn tệp.', 'error'); return; } const file = fileInput.files[0]; showToast('Đang tải tệp lên...', 'info'); try { const fileData = await fileToBase64(file); const project = currentUser.projects.find(p => p.id === currentProjectId); if (project) { if (!project.tasks) project.tasks = []; project.tasks.push({ id: String(Date.now()), title: title, status: 'DOCS', attachment: { name: file.name, type: file.type, data: fileData }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); await updateUserOnServer(); closeModal(); showProjectDetail(currentProjectId); showToast('Tải tệp lên thành công!', 'success'); } } catch (error) { console.error('File upload error:', error); showToast('Tải tệp lên thất bại.', 'error'); } e.target.reset(); document.getElementById('file-upload-name').textContent = 'Chưa chọn tệp nào'; };
async function handleAddProject(e) { e.preventDefault(); const name = document.getElementById('project-name').value; const description = document.getElementById('project-description').value; const deadline = document.getElementById('project-deadline').value; if (!name) { showToast('Vui lòng nhập tên dự án.', 'error'); return; } if (!currentUser.projects) currentUser.projects = []; const newProjectId = String(Date.now()); const newProject = { id: newProjectId, name, description, deadline: deadline || null, tasks: [], ownerId: currentUser.id, members: [currentUser.id], inviteCode: null }; currentUser.projects.push(newProject); try { await updateUserOnServer(); closeModal(); renderProjects(); showToast('Tạo dự án mới thành công!', 'success'); e.target.reset(); } catch (error) { showToast('Tạo dự án thất bại.', 'error'); currentUser.projects = currentUser.projects.filter(p => p.id !== newProjectId); } };
async function handleDeleteProject(projectId) { const project = currentUser.projects.find(p => p.id === String(projectId)); if (!project) return; if (String(project.ownerId) !== String(currentUser.id)) { showToast("Chỉ chủ dự án mới có thể xóa dự án.", "error"); return; } const confirmed = await showConfirmationModal('Bạn có chắc chắn muốn xóa dự án này?'); if (!confirmed) return; currentUser.projects = currentUser.projects.filter(p => p.id !== String(projectId)); await updateUserOnServer(); const projectDetailView = document.getElementById('project-detail'); if (projectDetailView && !projectDetailView.classList.contains('hidden') && currentProjectId === String(projectId)) { showDashboardView(); } else { renderProjects(); } closeModal(); showToast('Đã xóa dự án thành công.', 'info'); };
function openEditProjectModal(projectId) { const project = currentUser.projects.find(p => p.id === String(projectId)); if (!project) return; if (String(project.ownerId) !== String(currentUser.id)) { showToast("Chỉ chủ dự án mới có thể sửa cài đặt.", "error"); return; } document.getElementById('edit-project-id-input').value = project.id; document.getElementById('edit-project-name').value = project.name; document.getElementById('edit-project-description').value = project.description || ''; document.getElementById('edit-project-deadline').value = project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : ''; openModal('editProject'); };
async function handleEditProjectFormSubmit(e) { e.preventDefault(); const projectId = document.getElementById('edit-project-id-input').value; const project = currentUser.projects.find(p => p.id === projectId); if (project) { project.name = document.getElementById('edit-project-name').value; project.description = document.getElementById('edit-project-description').value; project.deadline = document.getElementById('edit-project-deadline').value || null; await updateUserOnServer(); closeModal(); showProjectDetail(projectId); renderProjects(); showToast('Cập nhật dự án thành công!', 'success'); } };

// --- <<< CÁC HÀM ĐƯỢC CẬP NHẬT CHO TÍNH NĂNG GÁN THÀNH VIÊN >>> ---

// Hàm chung để render popover chọn thành viên
function renderAssigneePopover(popoverListEl, selectedAssignees = []) {
    const project = currentUser.projects.find(p => p.id === currentProjectId);
    if (!project || !popoverListEl) return;

    popoverListEl.innerHTML = '';
    project.members.forEach(memberId => {
        const member = findUserById(memberId);
        if (member) {
            const isChecked = selectedAssignees.includes(member.name);
            const item = document.createElement('div');
            item.className = 'member-item';
            item.dataset.memberName = member.name;

            item.innerHTML = `
                <input type="checkbox" ${isChecked ? 'checked' : ''}>
                <div class="member-avatar">
                    <img src="${member.avatar || '../images/default-avatar.png'}" alt="${member.name}" onerror="this.onerror=null; this.src='../images/default-avatar.png';">
                </div>
                <span class="member-name">${member.name}</span>
            `;
            popoverListEl.appendChild(item);
        }
    });
}

// Hàm chung để cập nhật hiển thị các avatar đã được chọn
function updateSelectedAssigneesUI(containerEl, selectedNames) {
    containerEl.innerHTML = '';
    if (selectedNames.length === 0) {
        containerEl.innerHTML = '<span class="assignee-placeholder">Chọn thành viên...</span>';
    } else {
        selectedNames.forEach(name => {
            const member = allUsers.find(u => u.name === name);
            if(member) {
                const avatarEl = document.createElement('div');
                avatarEl.className = 'selected-assignee-avatar';
                avatarEl.title = name;
                avatarEl.innerHTML = `<img src="${member.avatar || '../images/default-avatar.png'}" alt="${name}">`;
                containerEl.appendChild(avatarEl);
            }
        });
    }
}

function handleAddTask(buttonElement) {
    currentColumnStatus = buttonElement.dataset.status;
    document.getElementById('add-task-modal-title').textContent = `Thêm CV vào cột "${currentColumnStatus}"`;
    document.getElementById('add-task-form').reset();
    
    const popoverList = document.querySelector('#add-task-assignee-popover .assignee-popover-list');
    const selectedContainer = document.getElementById('add-task-selected-assignees');
    
    // Khởi tạo trạng thái rỗng
    updateSelectedAssigneesUI(selectedContainer, []);
    renderAssigneePopover(popoverList, []);
    
    openModal('addTask');
};

async function handleAddTaskFormSubmit(e) {
    e.preventDefault();
    if (!currentProjectId || !currentColumnStatus) return;

    const title = document.getElementById('add-task-title-input').value;
    const description = document.getElementById('add-task-description-input').value;
    const dueDate = document.getElementById('add-task-duedate-input').value;

    if (!title) {
        showToast('Tiêu đề không được để trống.', 'error');
        return;
    }

    // Lấy danh sách thành viên được chọn từ popover
    const selectedAssignees = [];
    document.querySelectorAll('#add-task-assignee-popover .member-item input:checked').forEach(checkbox => {
        selectedAssignees.push(checkbox.closest('.member-item').dataset.memberName);
    });
    const assignee = selectedAssignees.join(', ');

    const project = currentUser.projects.find(p => p.id === currentProjectId);
    if (!project.tasks) project.tasks = [];
    project.tasks.push({ id: String(Date.now()), title, status: currentColumnStatus, description, dueDate: dueDate || null, assignee, completedOn: null, attachment: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    
    await updateUserOnServer();
    closeModal();
    showProjectDetail(currentProjectId);
    showToast('Đã thêm công việc mới.', 'success');
};

function openTaskDetailModal(id) {
    const project = currentUser.projects.find(proj => proj.id === currentProjectId);
    if (!project) return;
    const task = project.tasks.find(t => t.id === String(id));
    if (!task) return;

    document.getElementById('task-id-input').value = task.id;
    document.getElementById('task-title-input').value = task.title;
    document.getElementById('task-description-input').value = task.description || '';
    document.getElementById('task-duedate-input').value = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
    
    // Cập nhật giao diện chọn thành viên cho modal chi tiết
    const popoverList = document.querySelector('#task-detail-assignee-popover .assignee-popover-list');
    const selectedContainer = document.getElementById('task-detail-selected-assignees');
    const currentAssignees = task.assignee ? task.assignee.split(',').map(s => s.trim()) : [];
    
    updateSelectedAssigneesUI(selectedContainer, currentAssignees);
    renderAssigneePopover(popoverList, currentAssignees);

    document.getElementById('complete-task-btn').classList.toggle('hidden', task.status !== 'Đang Làm');
    openModal('taskDetail');
};

async function handleSaveTaskDetails(e) {
    e.preventDefault();
    const id = document.getElementById('task-id-input').value;
    const project = currentUser.projects.find(proj => proj.id === currentProjectId);
    const task = project.tasks.find(t => t.id === id);

    if (task) {
        task.title = document.getElementById('task-title-input').value;
        task.description = document.getElementById('task-description-input').value;
        task.dueDate = document.getElementById('task-duedate-input').value || null;

        const selectedAssignees = [];
        document.querySelectorAll('#task-detail-assignee-popover .member-item input:checked').forEach(checkbox => {
            selectedAssignees.push(checkbox.closest('.member-item').dataset.memberName);
        });
        task.assignee = selectedAssignees.join(', ');

        await updateUserOnServer();
    }
    closeModal();
    showProjectDetail(currentProjectId);
};

// --- Các hàm cũ không đổi ---
async function handleChangeTaskStatus(taskId, action) { const project = currentUser.projects.find(p => p.id === currentProjectId); if (!project) return; const task = project.tasks.find(t => t.id === String(taskId)); if (!task) return; if (action === 'complete') { openCompleteTaskModal(taskId); return; } const statuses = ['Việc Cần Làm', 'Đang Làm', 'Đã Hoàn Thành']; const currentIndex = statuses.indexOf(task.status); if (action === 'next' && currentIndex < statuses.length - 1) { task.status = statuses[currentIndex + 1]; } else if (action === 'prev' && currentIndex > 0) { task.status = statuses[currentIndex - 1]; } await updateUserOnServer(); showProjectDetail(currentProjectId); renderProjects(); };
async function handleDeleteTask() { const confirmed = await showConfirmationModal("Bạn có chắc chắn muốn xóa công việc này không?"); if (!confirmed) return; const id = document.getElementById('task-id-input').value; const project = currentUser.projects.find(proj => proj.id === currentProjectId); if (project) { project.tasks = project.tasks.filter(t => t.id !== id); await updateUserOnServer(); } closeModal(); showProjectDetail(currentProjectId); renderProjects(); showToast('Đã xóa công việc.', 'info'); };
function openCompleteTaskModal(taskId) { document.getElementById('complete-task-id-input').value = taskId; document.getElementById('complete-task-file-name').textContent = 'Chưa chọn tệp nào'; document.getElementById('complete-task-form').reset(); closeModal(); openModal('completeTask'); };
function handleCompleteTaskFileChange(e) { const fileName = e.target.files[0]?.name || 'Chưa chọn tệp nào'; document.getElementById('complete-task-file-name').textContent = fileName; };
async function handleCompleteTaskFormSubmit(e) { e.preventDefault(); const taskId = document.getElementById('complete-task-id-input').value; const project = currentUser.projects.find(p => p.id === currentProjectId); const task = project.tasks.find(t => t.id === taskId); if (task) { task.status = 'Đã Hoàn Thành'; task.completedOn = new Date().toISOString(); const fileInput = document.getElementById('complete-task-file-input'); if(fileInput.files.length > 0) { const file = fileInput.files[0]; const fileData = await fileToBase64(file); task.attachment = { name: file.name, type: file.type, data: fileData }; } await updateUserOnServer(); closeModal(); showProjectDetail(currentProjectId); renderProjects(); showToast(`Công việc "${task.title}" đã hoàn thành!`, 'success'); } };
function handleDownloadAttachment(taskId) { const project = currentUser.projects.find(p => p.id === currentProjectId); const task = project.tasks.find(t => t.id === String(taskId)); if (task && task.attachment && task.attachment.data) { const link = document.createElement('a'); link.href = task.attachment.data; link.download = task.attachment.name; document.body.appendChild(link); link.click(); document.body.removeChild(link); } };
function renderInvitableUsers(usersToRender, containerEl, project) { containerEl.innerHTML = ''; if (usersToRender.length === 0) { containerEl.innerHTML = '<p style="text-align: center; color: var(--text-light-color); padding: 20px 0;">Không có bạn bè nào để mời.</p>'; return; } usersToRender.forEach(user => { const isMember = project.members.map(String).includes(String(user.id)); const hasPendingInvite = (user.projectInvites || []).some(inv => inv.projectId === project.id); const item = document.createElement('div'); item.className = 'invite-user-item'; let buttonHTML; if (isMember) { buttonHTML = `<button class="btn btn-secondary" disabled>Thành viên</button>`; } else if (hasPendingInvite) { buttonHTML = `<button class="btn btn-secondary" disabled>Đã mời</button>`; } else { buttonHTML = `<button class="btn btn-primary btn-sm" data-action="send-project-invite" data-user-id="${user.id}">Mời</button>`; } item.innerHTML = ` <div class="invite-user-info"> <div class="invite-user-avatar"> <img src="${user.avatar || '../images/default-avatar.png'}" alt="${user.name}" onerror="this.onerror=null; this.src='../images/default-avatar.png';"> </div> <span class="invite-user-name">${user.name}</span> </div> ${buttonHTML} `; containerEl.appendChild(item); }); }
async function openInviteModal() { if (!currentProjectId) return; try { const updatedUsers = await fetchWithAuth('/api/users'); allUsers = updatedUsers; currentUser = allUsers.find(u => u.id === currentUser.id); saveCurrentUserToSession(currentUser); } catch (error) { showToast("Không thể làm mới dữ liệu. Vui lòng thử lại.", "error"); return; } const project = currentUser.projects.find(p => p.id === currentProjectId); if (!project) { showToast("Không tìm thấy dự án này.", "error"); return; } if (!project.members.map(String).includes(String(currentUser.id))) { showToast("Bạn không có quyền mời.", "error"); return; } const userListEl = document.getElementById('invite-user-list'); const searchInput = document.getElementById('invite-search-input'); searchInput.value = ''; const friendIds = currentUser.friends || []; const friendsToInvite = allUsers.filter(user => friendIds.map(String).includes(String(user.id))); renderInvitableUsers(friendsToInvite, userListEl, project); const inviteLinkInput = document.getElementById('project-invite-link-input'); if (project.inviteCode) { const joinURL = `${window.location.origin}/index.html?joinProject=${project.inviteCode}`; inviteLinkInput.value = joinURL; } else { inviteLinkInput.value = "Lỗi khi tạo link mời."; } openModal('inviteToProject'); }
async function handleProjectInvite(userIdToInvite) { const btn = document.querySelector(`.invite-user-item button[data-user-id="${userIdToInvite}"]`); if (!btn) return; btn.disabled = true; btn.innerHTML = 'Đang mời...'; try { const result = await fetchWithAuth(`/api/projects/${currentProjectId}/invite`, { method: 'POST', body: JSON.stringify({ userIdToInvite: userIdToInvite }) }); showToast(result.message, 'success'); btn.innerHTML = 'Đã mời'; const invitedUser = allUsers.find(u => u.id === userIdToInvite); if (invitedUser) { if (!invitedUser.projectInvites) invitedUser.projectInvites = []; invitedUser.projectInvites.push({ projectId: currentProjectId, from: currentUser.id }); } } catch (error) { showToast(error.message, 'error'); btn.disabled = false; btn.innerHTML = 'Mời'; } }
async function handleDeleteDocument(docId) { const confirmed = await showConfirmationModal('Bạn có chắc muốn xóa tài liệu này?', 'Xóa Tài liệu'); if (!confirmed) return; const project = currentUser.projects.find(p => p.id === currentProjectId); if(project) { project.tasks = project.tasks.filter(t => t.id !== String(docId)); await updateUserOnServer(); const isMember = project.members.map(String).includes(String(currentUser.id)); renderDocumentList(project, isMember); showToast('Đã xóa tài liệu.', 'info'); } }

function initializeProjectsPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectIdToView = urlParams.get('viewProject');
    if (projectIdToView) {
        showProjectDetail(projectIdToView);
    } else {
        renderProjects();
    }
    
    const forms = { 'add-project-form': handleAddProject, 'edit-project-form': handleEditProjectFormSubmit, 'add-task-form': handleAddTaskFormSubmit, 'task-detail-form': handleSaveTaskDetails, 'complete-task-form': handleCompleteTaskFormSubmit, 'upload-file-form': handleUploadFileFormSubmit }; 
    for (const [id, handler] of Object.entries(forms)) { const form = document.getElementById(id); if (form) form.addEventListener('submit', handler); } 
    
    document.getElementById('file-upload-input')?.addEventListener('change', (e) => {
        const fileName = e.target.files[0]?.name || 'Chưa chọn tệp nào';
        document.getElementById('file-upload-name').textContent = fileName;
    });

    document.body.addEventListener('click', (e) => { 
        const tClosest = (selector) => e.target.closest(selector);

        // Logic để ẩn/hiện popover
        const assigneeContainer = tClosest('.assignee-container');
        if (assigneeContainer) {
            const popover = assigneeContainer.querySelector('.assignee-popover');
            if (popover) popover.classList.toggle('active');
        } else {
            // Nếu click ra ngoài, đóng tất cả popover
            document.querySelectorAll('.assignee-popover').forEach(p => p.classList.remove('active'));
        }

        // Logic xử lý khi chọn một thành viên trong popover
        const memberItem = tClosest('.assignee-popover .member-item');
        if (memberItem) {
            e.stopPropagation(); // Ngăn popover đóng lại ngay
            const checkbox = memberItem.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
            
            const popover = memberItem.closest('.assignee-popover');
            const selectedContainer = popover.parentElement.querySelector('.selected-assignees');
            
            const selectedNames = [];
            popover.querySelectorAll('input:checked').forEach(cb => {
                selectedNames.push(cb.closest('.member-item').dataset.memberName);
            });
            updateSelectedAssigneesUI(selectedContainer, selectedNames);
            return;
        }

        const actionTarget = tClosest('[data-action]'); 
        if (actionTarget) { 
            const action = actionTarget.dataset.action; 
            const projectId = actionTarget.dataset.projectId;
            const docId = actionTarget.dataset.docId;
            const taskId = actionTarget.dataset.taskId;
            const userId = actionTarget.dataset.userId;

            if (action === 'view-project') { e.preventDefault(); showProjectDetail(projectId); return; }
            if (action === 'delete-project-card') { handleDeleteProject(projectId); return; }
            if (action === 'download-document') { handleDownloadAttachment(docId); return; }
            if (action === 'delete-document-card') { handleDeleteDocument(docId); return; }
            if (['next', 'prev', 'complete'].includes(action)) { handleChangeTaskStatus(taskId, action); return; }
            if (action === 'send-project-invite') { handleProjectInvite(userId); return; }
        } 
        const handlers = { '#add-project-btn': () => openModal('addProject'), '#project-settings-btn': () => openEditProjectModal(currentProjectId), '#invite-to-project-btn': openInviteModal, '#upload-file-btn': () => openModal('uploadFile'), '#delete-project-btn': () => { const projectId = document.getElementById('edit-project-id-input').value; handleDeleteProject(projectId); }, '#delete-task-btn': handleDeleteTask, '#complete-task-btn': () => { const taskId = document.getElementById('task-id-input').value; openCompleteTaskModal(taskId); }, '#copy-invite-link-btn': () => { const linkInput = document.getElementById('project-invite-link-input'); navigator.clipboard.writeText(linkInput.value).then(() => { showToast('Đã sao chép link mời!', 'success'); }).catch(err => { showToast('Không thể sao chép link.', 'error'); }); } }; 
        for (const [selector, handler] of Object.entries(handlers)) { if (tClosest(selector)) { handler(); return; } } 
        
        const navBtn = tClosest('.project-nav-btn');
        if (navBtn) { switchProjectTab(navBtn.dataset.projectTab); return; }

        if (tClosest('.add-task-btn')) { handleAddTask(tClosest('.add-task-btn')); return; } 
        const taskTitle = tClosest('.task-title-clickable');
        if (taskTitle) { openTaskDetailModal(taskTitle.dataset.taskId); return; }
        if (tClosest('.download-attachment-link')) { e.preventDefault(); handleDownloadAttachment(tClosest('.download-attachment-link').dataset.taskId); return; } 
    }); 
    const completeTaskFileInput = document.getElementById('complete-task-file-input'); if(completeTaskFileInput) completeTaskFileInput.addEventListener('change', handleCompleteTaskFileChange); 
    const inviteSearchInput = document.getElementById('invite-search-input'); if (inviteSearchInput) { inviteSearchInput.addEventListener('input', (e) => { const searchTerm = e.target.value.toLowerCase(); const project = currentUser.projects.find(p => p.id === currentProjectId); if (!project) return; const friendIds = currentUser.friends || []; const allFriends = allUsers.filter(u => friendIds.map(String).includes(String(u.id))); const filteredFriends = allFriends.filter(u => u.name.toLowerCase().includes(searchTerm)); renderInvitableUsers(filteredFriends, document.getElementById('invite-user-list'), project); }); } 
}