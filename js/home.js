// --- START OF FILE js/home.js (CẬP NHẬT) ---

function renderMyTasks() {
    const container = document.getElementById('my-tasks-list');
    if (!container) return;

    if (!currentUser || !currentUser.projects || currentUser.projects.length === 0) {
        container.innerHTML = '<p class="no-tasks-message">Bạn chưa có công việc nào được giao.</p>';
        return;
    }

    const myTasks = [];
    // <<< SỬA LỖI: Chuẩn hóa tên người dùng về chữ thường một lần duy nhất >>>
    const myName = currentUser.name.toLowerCase();

    // Lặp qua tất cả các dự án để tìm công việc được gán
    currentUser.projects.forEach(project => {
        if (project.tasks && project.tasks.length > 0) {
            project.tasks.forEach(task => {
                // <<< SỬA LỖI: So sánh assignee không phân biệt chữ hoa/thường >>>
                const assignees = (task.assignee || '').split(',').map(name => name.trim().toLowerCase());
                if (assignees.includes(myName) && task.status !== 'Đã Hoàn Thành' && task.status !== 'DOCS') {
                    myTasks.push({
                        ...task,
                        projectName: project.name, // Thêm tên dự án vào công việc
                        projectId: project.id
                    });
                }
            });
        }
    });

    if (myTasks.length === 0) {
        container.innerHTML = '<p class="no-tasks-message">Tuyệt vời! Bạn không có công việc nào cần làm.</p>';
        return;
    }
    
    // Sắp xếp công việc: quá hạn > sắp đến hạn > còn lại
    myTasks.sort((a, b) => {
        const today = new Date().setHours(0, 0, 0, 0);
        const aDueDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDueDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        
        const aIsOverdue = aDueDate < today;
        const bIsOverdue = bDueDate < today;

        if (aIsOverdue && !bIsOverdue) return -1;
        if (!aIsOverdue && bIsOverdue) return 1;

        // Nếu cả hai đều quá hạn hoặc không, ưu tiên cái nào đến hạn trước
        return aDueDate - bDueDate;
    });

    // Render danh sách công việc
    container.innerHTML = '';
    myTasks.forEach(task => {
        const card = document.createElement('a');
        card.className = 'my-task-card';
        // Link đến dự án và thêm tham số để mở modal chi tiết công việc
        card.href = `/page/projects.html?viewProject=${task.projectId}&openTask=${task.id}`; 
        
        let deadlineHTML = '';
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            
            let cls = '';
            let text = '';

            if (diffDays < 0) {
                cls = 'overdue';
                text = `Quá hạn ${Math.abs(diffDays)} ngày`;
            } else if (diffDays === 0) {
                cls = 'due-soon';
                text = 'Hạn hôm nay';
            } else if (diffDays <= 7) {
                cls = 'due-soon';
                text = `Còn ${diffDays} ngày`;
            } else {
                text = `Hạn: ${dueDate.toLocaleDateString('vi-VN')}`;
            }
            deadlineHTML = `<span class="task-deadline ${cls}">${text}</span>`;
        }

        card.innerHTML = `
            <div class="task-info">
                <span class="task-title">${task.title}</span>
                <span class="project-name-badge">${task.projectName}</span>
            </div>
            <div class="task-meta">
                ${deadlineHTML}
            </div>
        `;
        container.appendChild(card);
    });
}


function initializeHomePage() {
    renderMyTasks();
}