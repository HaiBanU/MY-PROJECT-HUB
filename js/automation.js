// --- START OF FILE js/automation.js ---

let activeWorkflow = { nodes: {}, connections: [] };
let isDrawingLine = false;
let startNodeForLine = null;
let activeDraggableInstance = null;
let offsetX = 0, offsetY = 0;
let googleLinkClient;

function initializeGoogleLink() { 
    if (typeof google === 'undefined') { 
        showToast("Thư viện Google chưa sẵn sàng, vui lòng thử lại.", "error"); 
        return; 
    } 
    if (googleLinkClient) return; 
    try { 
        // =================================================================
        // SỬA LỖI Ở ĐÂY:
        // Client ID cũ ('71088181818-v5q7jald2jfg33ook691gttv5r4hivot.apps.googleusercontent.com') không hợp lệ.
        // Bạn PHẢI thay thế chuỗi placeholder bên dưới bằng Google OAuth Client ID của chính bạn.
        // Client ID này phải khớp với biến GOOGLE_CLIENT_ID trong file .env của backend.
        // Bạn có thể lấy nó từ: https://console.cloud.google.com/apis/credentials
        // =================================================================
        const GOOGLE_CLIENT_ID = '71088181818-dcci3a70i15s2v405mhmfnbc4euub70n.apps.googleusercontent.com'; // <<< THAY THẾ GIÁ TRỊ NÀY

        if (GOOGLE_CLIENT_ID.startsWith('YOUR_GOOGLE_CLIENT_ID')) {
            showToast("Lỗi cấu hình: Vui lòng cập nhật Google Client ID trong file automation.js", "error");
            console.error("Lỗi cấu hình: Vui lòng cập nhật Google Client ID trong file automation.js");
            return;
        }

        googleLinkClient = google.accounts.oauth2.initCodeClient({ 
            client_id: GOOGLE_CLIENT_ID, 
            scope: 'email profile openid', 
            ux_mode: 'popup',
            callback: handleGoogleAuthResponse,
        }); 
    } catch (error) { 
        console.error("Lỗi khởi tạo Google Link:", error); 
    } 
}

async function handleGoogleAuthResponse(response) {
    const code = response.code;
    if (code) {
        showToast('Đang liên kết với Google...', 'info');
        try {
            const result = await fetchWithAuth('/api/user/connect/google', { 
                method: 'POST', 
                body: JSON.stringify({ code: code }), 
            }); 
            currentUser = result.user; 
            saveCurrentUserToSession(currentUser); 
            renderAutomationConfig(); 
            showToast(result.message, 'success'); 
        } catch (error) { 
            showToast(error.message, 'error'); 
        }
    } else {
        showToast('Xác thực Google đã bị hủy.', 'error');
    }
}


function renderAutomationConfig() { const gmailConn = currentUser.connections?.gmail; const isConnected = gmailConn?.connected; const hasPassword = !!gmailConn?.appPassword; const req1Icon = document.getElementById('automation-gmail-req-1-icon'); const req1Btn = document.getElementById('automation-gmail-req-1-btn'); const req2Icon = document.getElementById('automation-gmail-req-2-icon'); const req2Btn = document.getElementById('automation-gmail-req-2-btn'); if(!req1Icon || !req1Btn || !req2Icon || !req2Btn) return; if (isConnected) { req1Icon.className = 'fa-solid fa-circle-check'; req1Btn.disabled = true; req1Btn.textContent = 'Đã liên kết'; req1Btn.classList.remove('btn-primary'); req1Btn.classList.add('btn-success'); } else { req1Icon.className = 'fa-regular fa-circle'; req1Btn.disabled = false; req1Btn.textContent = 'Liên kết'; req1Btn.classList.remove('btn-success'); req1Btn.classList.add('btn-primary'); } req2Btn.disabled = !isConnected; if (hasPassword) { req2Icon.className = 'fa-solid fa-circle-check'; req2Btn.textContent = 'Đã cung cấp'; } else { req2Icon.className = 'fa-regular fa-circle'; req2Btn.textContent = 'Cung cấp'; } }
function showWorkflowList() { const workflowListView = document.getElementById('workflow-list-view'); const automationBuilderView = document.getElementById('automation-builder-view'); if(workflowListView) workflowListView.classList.remove('hidden'); if(automationBuilderView) automationBuilderView.classList.add('hidden'); removeAllLines(); renderWorkflows(); renderAutomationConfig(); }
function openWorkflowBuilder(workflowId) { const workflowListView = document.getElementById('workflow-list-view'); const automationBuilderView = document.getElementById('automation-builder-view'); const automationCanvas = document.getElementById('automation-canvas'); currentWorkflowId = workflowId; const workflow = currentUser.workflows.find(w => String(w.id) === String(workflowId)); if (!workflow) return; activeWorkflow = JSON.parse(JSON.stringify(workflow)); if (!activeWorkflow.nodes) activeWorkflow.nodes = {}; if (!activeWorkflow.connections) activeWorkflow.connections = []; if(workflowListView) workflowListView.classList.add('hidden'); if(automationBuilderView) automationBuilderView.classList.remove('hidden'); document.getElementById('workflow-title-display').textContent = workflow.name; automationCanvas.innerHTML = ''; if (activeWorkflow.nodes) { Object.values(activeWorkflow.nodes).forEach(nodeData => { const nodeTemplate = document.querySelector(`.automation-nodes .node[data-type="${nodeData.type}"]`); if (nodeTemplate) { const addedNode = addNodeToCanvas(nodeData, nodeTemplate.innerHTML, nodeData.position); activeWorkflow.nodes[nodeData.id].element = addedNode; } }); } if (activeWorkflow.connections) { const tempConnections = [...activeWorkflow.connections]; activeWorkflow.connections = []; tempConnections.forEach(conn => { const startNode = document.getElementById(conn.from); const endNode = document.getElementById(conn.to); if(startNode && endNode) { connectNodes(startNode, endNode); } }); } updateRunButtonVisibility(); }
function renderWorkflows() { const list = document.getElementById('workflow-list'); if (!list) return; list.innerHTML = ''; if (!currentUser.workflows || currentUser.workflows.length === 0) { list.innerHTML = `<p>Chưa có quy trình nào.</p>`; return; } currentUser.workflows.forEach((w, index) => { const card = document.createElement('div'); card.className = 'workflow-card'; if (w.lastRunStatus) { card.classList.add(`status-${w.lastRunStatus}`); } card.style.animationDelay = `${index * 50}ms`; card.dataset.workflowId = w.id; const triggerNode = Object.values(w.nodes || {}).find(n => n.isTrigger); let triggerInfo = 'Chưa có trigger'; let triggerIcon = 'fa-question-circle'; if (triggerNode) { if (triggerNode.type === 'manual') { triggerInfo = 'Kích hoạt thủ công'; triggerIcon = 'fa-hand-pointer'; }} card.innerHTML = `<div class="card-body" data-action="view-workflow" data-workflow-id="${w.id}"><h3>${w.name}</h3><p>Quy trình tự động hóa.</p></div><div class="card-actions"><div class="workflow-card-footer"><i class="fas ${triggerIcon}"></i><span>${triggerInfo}</span></div><button class="btn btn-secondary btn-sm" data-action="delete-workflow-card" data-workflow-id="${w.id}"><i class="fas fa-trash-can"></i></button></div>`; list.appendChild(card); }); }
function updateRunButtonVisibility() { const runBtn = document.getElementById('run-automation-btn'); const triggerNode = Object.values(activeWorkflow.nodes).find(n => n.isTrigger); if(runBtn) runBtn.classList.toggle('hidden', !triggerNode || triggerNode.type !== 'manual'); }
function addNodeToCanvas(nodeData, html, position = null) { const automationCanvas = document.getElementById('automation-canvas'); const { id, type, isTrigger, config } = nodeData; const newNode = document.createElement('div'); newNode.id = id; newNode.className = 'node-instance'; newNode.dataset.type = type; if (isTrigger) { newNode.classList.add('trigger'); } else { newNode.classList.add('action-node'); } newNode.innerHTML = `<div class="node-main-content">${html}</div><div class="node-info"></div><div class="handle handle-in"></div><div class="handle handle-out"></div><button class="delete-node-btn"><i class="fa-solid fa-trash-can"></i></button>`; newNode.style.position = 'absolute'; if (position && position.x && position.y) { newNode.style.left = position.x; newNode.style.top = position.y; } else { const rect = automationCanvas.getBoundingClientRect(); newNode.style.left = `${(automationCanvas.scrollLeft + rect.width / 2) - 110}px`; newNode.style.top = `${(automationCanvas.scrollTop + rect.height / 2) - 30}px`; } if (type === 'ai-agent') { newNode.classList.add('node-instance-ai-agent'); } automationCanvas.appendChild(newNode); activeWorkflow.nodes[id] = { ...nodeData, element: newNode, position: { x: newNode.style.left, y: newNode.style.top } }; updateNodeInfo(id); return newNode; }
function updateNodeInfo(nodeId) { const nodeState = activeWorkflow.nodes[nodeId]; if (!nodeState || !nodeState.element) return; const infoDiv = nodeState.element.querySelector('.node-info'); if (!infoDiv) return; let infoText = ''; switch(nodeState.type) { case 'email': if (nodeState.config?.subject) { infoText = `Tiêu đề: ${nodeState.config.subject}`; } else { infoText = 'Chưa cấu hình'; } break; case 'ai-agent': if (nodeState.config?.prompt) { infoText = 'Đã cấu hình câu lệnh.'; } else { infoText = 'Chưa có câu lệnh.'; } break; default: infoText = ''; } infoDiv.textContent = infoText; }
function deleteNode(nodeElement) { const nodeId = nodeElement.id; const connectionsToRemove = activeWorkflow.connections.filter(conn => conn.from === nodeId || conn.to === nodeId); connectionsToRemove.forEach(conn => { if (conn.line) conn.line.remove(); }); activeWorkflow.connections = activeWorkflow.connections.filter(conn => !connectionsToRemove.includes(conn)); delete activeWorkflow.nodes[nodeId]; nodeElement.remove(); updateRunButtonVisibility(); }
function connectNodes(startNode, endNode) { if (startNode.id === endNode.id || activeWorkflow.connections.some(c => c.from === startNode.id && c.to === endNode.id)) { return; } const startHandle = startNode.querySelector('.handle-out'); const endHandle = endNode.querySelector('.handle-in'); const line = new LeaderLine(startHandle, endHandle, { color: 'var(--primary-color)', size: 3, endPlug: 'arrow1' }); activeWorkflow.connections.push({ from: startNode.id, to: endNode.id, line: line }); }
function repositionAllLines() { if(activeWorkflow && activeWorkflow.connections) activeWorkflow.connections.forEach(conn => conn.line?.position()); }
function removeAllLines() { if(activeWorkflow && activeWorkflow.connections) { activeWorkflow.connections.forEach(conn => conn.line?.remove()); activeWorkflow.connections = []; } }
const handleAddWorkflow = async (e) => { e.preventDefault(); const nameInput = document.getElementById('workflow-name'); if (!nameInput) return; const name = nameInput.value; if (!name) { showToast('Vui lòng nhập tên quy trình.', 'error'); return; } if (!currentUser.workflows) currentUser.workflows = []; currentUser.workflows.push({ id: String(Date.now()), name, nodes: {}, connections: [], lastRunStatus: null }); await updateUserOnServer(); closeModal(); renderWorkflows(); showToast('Tạo quy trình mới thành công!', 'success'); e.target.reset(); };
const handleDeleteWorkflow = async (workflowId) => { const confirmed = await showConfirmationModal('Bạn có chắc chắn muốn xóa quy trình này?'); if (!confirmed) return; const idToDelete = String(workflowId); currentUser.workflows = currentUser.workflows.filter(w => String(w.id) !== idToDelete); await updateUserOnServer(); renderWorkflows(); showToast('Đã xóa quy trình thành công.', 'info'); };
async function saveCurrentWorkflow(showAlert = true) { if(!currentWorkflowId) return; const workflowIndex = currentUser.workflows.findIndex(w => String(w.id) === String(currentWorkflowId)); if(workflowIndex !== -1) { const sanitizedWorkflow = { ...currentUser.workflows[workflowIndex], id: currentWorkflowId, name: document.getElementById('workflow-title-display').textContent, nodes: {}, connections: [] }; Object.keys(activeWorkflow.nodes).forEach(nodeId => { const { element, line, ...nodeData } = activeWorkflow.nodes[nodeId]; sanitizedWorkflow.nodes[nodeId] = nodeData; }); sanitizedWorkflow.connections = activeWorkflow.connections.map(c => ({ from: c.from, to: c.to })); currentUser.workflows[workflowIndex] = sanitizedWorkflow; await updateUserOnServer(); if(showAlert) showToast('Đã lưu quy trình!', 'success'); } }
async function runAutomation() { if (!currentWorkflowId) return; const workflow = currentUser.workflows.find(w => String(w.id) === String(currentWorkflowId)); if (!workflow) return; showToast('Đang gửi yêu cầu thực thi đến máy chủ...', 'info'); const allNodeElements = document.querySelectorAll('.node-instance'); allNodeElements.forEach(el => { el.classList.remove('success', 'error'); el.classList.add('running'); }); try { await saveCurrentWorkflow(false); const result = await fetchWithAuth(`/api/workflow/run/${currentWorkflowId}`, { method: 'POST', body: JSON.stringify(activeWorkflow) }); await animateWorkflowExecution(); showToast(result.message, 'success'); } catch (error) { showToast(error.message, 'error'); allNodeElements.forEach(el => { el.classList.remove('running'); el.classList.add('error'); }); } finally { try { allUsers = await fetchWithAuth('/api/users'); currentUser = allUsers.find(u => u.id === currentUser.id); saveCurrentUserToSession(currentUser); renderWorkflows(); } catch (fetchError) { console.error("Lỗi khi lấy lại dữ liệu người dùng:", fetchError); } } }
async function animateWorkflowExecution() { const executionPath = []; const triggerNode = Object.values(activeWorkflow.nodes).find(n => n.isTrigger); if (!triggerNode) return; let currentNodeId = triggerNode.id; while(currentNodeId) { const nodeElement = document.getElementById(currentNodeId); if (nodeElement) { executionPath.push(nodeElement); } const nextConnection = activeWorkflow.connections.find(c => c.from === currentNodeId); currentNodeId = nextConnection ? nextConnection.to : null; } for (const nodeElement of executionPath) { await new Promise(resolve => setTimeout(resolve, 500)); nodeElement.classList.remove('running'); nodeElement.classList.add('success'); } }
function isValidEmail(email) { if (typeof email !== 'string') return false; const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/; return re.test(String(email).toLowerCase()); }
function handleGmailExcelUpload(e) { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (event) => { try { const data = new Uint8Array(event.target.result); const workbook = XLSX.read(data, { type: 'array' }); const sheetName = workbook.SheetNames[0]; const worksheet = workbook.Sheets[sheetName]; const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); const emailsFound = new Set(); jsonData.forEach(row => { row.forEach(cell => { if (isValidEmail(cell)) { emailsFound.add(cell); } }); }); const emailArray = Array.from(emailsFound); const recipientsTextarea = document.getElementById('config-input-recipients'); if (recipientsTextarea) { recipientsTextarea.value = emailArray.join('; '); showToast(`Đã tìm thấy và thêm ${emailArray.length} email từ tệp.`, 'success'); } } catch (readError) { showToast("Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.", "error"); } }; reader.readAsArrayBuffer(file); e.target.value = '';}
const handleAutomationAppPasswordFormSubmit = async (e) => { e.preventDefault(); const appPassword = document.getElementById('automation-app-password').value.trim(); if (appPassword.length === 0) { showToast("Vui lòng nhập Mật khẩu Cấp 2.", "error"); return; } const sanitizedPassword = appPassword.replace(/\s/g, ''); if (sanitizedPassword.length !== 16) { showToast("Mật khẩu Cấp 2 phải có đúng 16 ký tự.", "error"); return; } if (!currentUser.connections?.gmail?.connected) { showToast("Vui lòng liên kết tài khoản Google trước.", "error"); return; } if(!currentUser.connections) currentUser.connections = {}; if(!currentUser.connections.gmail) currentUser.connections.gmail = {}; currentUser.connections.gmail.appPassword = sanitizedPassword; await updateUserOnServer(); showToast("Đã lưu Mật khẩu Cấp 2 thành công!", "success"); renderAutomationConfig(); closeModal(); }
async function handleActionFormSubmit(e) { e.preventDefault(); const nodeId = document.getElementById('action-node-id').value; const nodeState = activeWorkflow.nodes[nodeId]; if (!nodeState) return; if (!nodeState.config) { nodeState.config = {}; } if (nodeState.type === 'email') { nodeState.config.subject = document.getElementById('config-input-subject').value; const bodyTextarea = document.getElementById('config-input-body'); if (!bodyTextarea.disabled) { nodeState.config.body = bodyTextarea.value; } const recipientsValue = document.getElementById('config-input-recipients').value; nodeState.config.recipients = recipientsValue.split(';').map(email => email.trim()).filter(isValidEmail); const attachmentInput = document.getElementById('email-attachment-input'); if (attachmentInput && attachmentInput.files.length > 0) { const file = attachmentInput.files[0]; const fileData = await fileToBase64(file); nodeState.config.attachment = { name: file.name, type: file.type, data: fileData }; } else { delete nodeState.config.attachment; } const incomingConnection = activeWorkflow.connections.find(c => c.to === nodeId); if (incomingConnection) { const fromNode = activeWorkflow.nodes[incomingConnection.from]; if (fromNode && fromNode.type === 'ai-agent') { nodeState.config.bodyFromNode = fromNode.id; } else { delete nodeState.config.bodyFromNode; } } else { delete nodeState.config.bodyFromNode; } } else if (nodeState.type === 'ai-agent') { nodeState.config.prompt = document.getElementById('config-input-prompt').value; } updateNodeInfo(nodeId); closeModal(); }
function openActionConfigModal(node) {
    const nodeId = node.id;
    const type = node.dataset.type;
    const nodeState = activeWorkflow.nodes[nodeId];
    document.getElementById('action-node-id').value = nodeId;
    document.getElementById('action-modal-title').textContent = `Cấu hình: ${node.querySelector('.node-main-content').textContent.trim()}`;
    const contentContainer = document.getElementById('action-config-content');
    contentContainer.innerHTML = '';
    const form = document.createElement('form');
    form.id = 'action-form';
    form.addEventListener('submit', handleActionFormSubmit);
    
    switch(type) {
        case 'email':
            const gmailConn = currentUser.connections?.gmail;
            if (gmailConn?.connected && gmailConn?.appPassword) {
                const recipientsGroup = document.createElement('div');
                recipientsGroup.className = 'form-group recipients-group';
                recipientsGroup.innerHTML = `<label for="config-input-recipients">Email người nhận (cách nhau bởi dấu chấm phẩy ;)</label>`;
                const recipientsWrapper = document.createElement('div');
                recipientsWrapper.className = 'recipients-input-wrapper';
                const recipientsTextarea = document.createElement('textarea');
                recipientsTextarea.id = 'config-input-recipients';
                recipientsTextarea.name = 'recipients';
                recipientsTextarea.rows = 4;
                const recipientsVal = nodeState.config?.recipients;
                recipientsTextarea.value = Array.isArray(recipientsVal) ? recipientsVal.join('; ') : '';
                const excelInput = document.createElement('input');
                excelInput.type = 'file';
                excelInput.id = 'gmail-excel-upload';
                excelInput.className = 'file-input';
                excelInput.accept = ".xlsx, .xls";
                excelInput.addEventListener('change', handleGmailExcelUpload);
                const excelLabel = document.createElement('label');
                excelLabel.htmlFor = 'gmail-excel-upload';
                excelLabel.className = 'btn btn-secondary';
                excelLabel.innerHTML = '<i class="fas fa-file-excel"></i> Tải từ Excel';
                excelLabel.title = "Tải lên tệp Excel để lấy danh sách email";
                recipientsWrapper.appendChild(recipientsTextarea);
                recipientsWrapper.appendChild(excelLabel);
                recipientsGroup.appendChild(recipientsWrapper);
                form.appendChild(recipientsGroup);
                form.appendChild(excelInput);
                const subjectGroup = document.createElement('div');
                subjectGroup.className = 'form-group';
                subjectGroup.innerHTML = `<label for="config-input-subject">Tiêu đề</label><input type="text" id="config-input-subject" name="subject" placeholder="Tiêu đề email của bạn" value="${nodeState.config?.subject || ''}">`;
                form.appendChild(subjectGroup);

                const bodyGroup = document.createElement('div');
                bodyGroup.className = 'form-group';
                const bodyLabel = document.createElement('label');
                bodyLabel.htmlFor = 'config-input-body';
                bodyLabel.textContent = 'Nội dung Email';
                const bodyTextarea = document.createElement('textarea');
                bodyTextarea.id = 'config-input-body';
                bodyTextarea.name = 'body';
                bodyTextarea.rows = 10;
                bodyTextarea.value = nodeState.config?.body || '';
                bodyGroup.appendChild(bodyLabel);
                bodyGroup.appendChild(bodyTextarea);
                
                const incomingConnection = activeWorkflow.connections.find(c => c.to === nodeId);
                if (incomingConnection) {
                    const fromNode = activeWorkflow.nodes[incomingConnection.from];
                    if (fromNode && fromNode.type === 'ai-agent') {
                        bodyTextarea.disabled = true;
                        bodyTextarea.value = '';
                        bodyTextarea.placeholder = 'Nội dung sẽ được lấy tự động từ khối AI Agent.';
                        const helpText = document.createElement('p');
                        helpText.className = 'form-help-text';
                        helpText.style.marginTop = '5px';
                        helpText.innerHTML = `<i class="fa-solid fa-circle-info"></i> Nội dung email này được liên kết với khối AI Agent. Để chỉnh sửa, hãy thay đổi câu lệnh trong khối AI đó.`;
                        bodyGroup.appendChild(helpText);
                    }
                }
                form.appendChild(bodyGroup);

                const attachmentGroup = document.createElement('div');
                attachmentGroup.className = 'form-group attachment-group';
                attachmentGroup.innerHTML = `<label>Đính kèm tệp (Tùy chọn)</label><div><input type="file" id="email-attachment-input" class="file-input"><label for="email-attachment-input" class="btn btn-secondary"><i class="fa-solid fa-upload"></i> Chọn Tệp</label><span id="email-attachment-name">${nodeState.config?.attachment?.name || 'Chưa chọn tệp nào'}</span></div>`;
                form.appendChild(attachmentGroup);
                attachmentGroup.querySelector('#email-attachment-input').addEventListener('change', (e) => { document.getElementById('email-attachment-name').textContent = e.target.files[0]?.name || 'Chưa chọn tệp nào'; });
            } else { contentContainer.innerHTML = `<p class="form-help-text">Bạn cần hoàn tất <strong>Cấu hình Liên kết</strong> trước khi sử dụng hành động này.</p>`; openModal('actionConfig'); return; }
            break;
        case 'ai-agent':
            const promptGroup = document.createElement('div');
            promptGroup.className = 'form-group';
            promptGroup.innerHTML = `<label for="config-input-prompt">Yêu cầu cho AI</label><p class="form-help-text">Nhập yêu cầu của bạn cho người bạn AI, HaiBanhU. Nội dung được tạo ra có thể dùng cho các khối tiếp theo, ví dụ như nội dung của email.</p><textarea id="config-input-prompt" name="prompt" rows="10" placeholder="Ví dụ: Giúp tôi viết một email thân thiện thông báo về việc cập nhật hệ thống...">${nodeState.config?.prompt || ''}</textarea>`;
            form.appendChild(promptGroup);
            break;
        default: contentContainer.innerHTML = `<p class="form-help-text">Hành động này không cần cấu hình.</p>`; openModal('actionConfig'); return;
    }
    const actions = document.createElement('div');
    actions.className = 'form-actions';
    actions.innerHTML = `<button type="submit" class="btn btn-primary full-width">Lưu Cấu hình</button>`;
    form.appendChild(actions);
    contentContainer.appendChild(form);
    openModal('actionConfig');
}
function handleAutomationNodeClick(e) { const node = e.target.closest('.automation-nodes .node'); if (!node) return; const isTrigger = node.classList.contains('trigger'); const existingTrigger = Object.values(activeWorkflow.nodes).find(n => n.isTrigger); if(isTrigger && existingTrigger) { showToast('Mỗi quy trình chỉ có thể có một Điểm Bắt Đầu (Trigger).', 'error'); return; } const newNodeId = `node-${Date.now()}`; const newNodeData = { id: newNodeId, type: node.dataset.type, isTrigger, config: {}, output: null, position: null }; const addedElement = addNodeToCanvas(newNodeData, node.innerHTML); if (addedElement) { activeWorkflow.nodes[newNodeId] = { ...newNodeData, element: addedElement, position: { x: addedElement.style.left, y: addedElement.style.top } }; updateRunButtonVisibility(); } }
function handleAutomationDoubleClick(e) { const node = e.target.closest('.node-instance'); if (!node) return; if (node.classList.contains('action-node')) { openActionConfigModal(node); } }
function handleAutomationMouseDown(e) { const target = e.target; const automationCanvas = document.getElementById('automation-canvas'); if (target.closest('.delete-node-btn')) return; const node = target.closest('.node-instance'); if (!node) return; if (target.classList.contains('handle-out')) { e.stopPropagation(); isDrawingLine = true; startNodeForLine = node; const tempEnd = document.createElement('div'); tempEnd.style.position = 'fixed'; tempEnd.style.width = '1px'; tempEnd.style.height = '1px'; document.body.appendChild(tempEnd); let tempLine = new LeaderLine( target, LeaderLine.pointAnchor(tempEnd, { x: 0, y: 0 }), { color: 'var(--primary-color)', size: 3, endPlug: 'arrow1', dash: { animation: true } }); const onMouseMove = (moveEvent) => { tempEnd.style.left = `${moveEvent.clientX}px`; tempEnd.style.top = `${moveEvent.clientY}px`; tempLine.position(); }; const onMouseUp = (upEvent) => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); document.body.removeChild(tempEnd); tempLine.remove(); const endNodeHandle = upEvent.target.closest('.handle-in'); if (endNodeHandle) { const endNode = endNodeHandle.closest('.node-instance'); if (endNode && endNode !== startNodeForLine) { connectNodes(startNodeForLine, endNode); } } isDrawingLine = false; startNodeForLine = null; tempLine = null; }; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); } else { activeDraggableInstance = node; activeDraggableInstance.classList.add('dragging'); offsetX = e.clientX - activeDraggableInstance.getBoundingClientRect().left; offsetY = e.clientY - activeDraggableInstance.getBoundingClientRect().top; document.addEventListener('mousemove', handleInstanceMouseMove); document.addEventListener('mouseup', handleInstanceMouseUp); } }
function handleInstanceMouseMove(e) { if (activeDraggableInstance) { const automationCanvas = document.getElementById('automation-canvas'); const rect = automationCanvas.getBoundingClientRect(); let x = e.clientX - rect.left - offsetX + automationCanvas.scrollLeft; let y = e.clientY - rect.top - offsetY + automationCanvas.scrollTop; x = Math.max(0, x); y = Math.max(0, y); activeDraggableInstance.style.left = `${x}px`; activeDraggableInstance.style.top = `${y}px`; repositionAllLines(); } }
function handleInstanceMouseUp() { if (activeDraggableInstance) { activeWorkflow.nodes[activeDraggableInstance.id].position = { x: activeDraggableInstance.style.left, y: activeDraggableInstance.style.top }; activeDraggableInstance.classList.remove('dragging'); activeDraggableInstance = null; document.removeEventListener('mousemove', handleInstanceMouseMove); document.removeEventListener('mouseup', handleInstanceMouseUp); } }

function initializeAutomationPage() {
    const automationCanvas = document.getElementById('automation-canvas');
    showWorkflowList(); 
    
    const addWorkflowForm = document.getElementById('add-workflow-form'); 
    if (addWorkflowForm) addWorkflowForm.addEventListener('submit', handleAddWorkflow); 
    
    const automationAppPasswordForm = document.getElementById('automation-app-password-form'); 
    if (automationAppPasswordForm) automationAppPasswordForm.addEventListener('submit', handleAutomationAppPasswordFormSubmit); 
    
    const configSummary = document.querySelector('.automation-config-summary'); 
    if(configSummary) { configSummary.addEventListener('click', (e) => { e.preventDefault(); const details = e.target.closest('.automation-config-details'); if(details) { details.open = !details.open; } }); } 
    
    document.body.addEventListener('click', (e) => { 
        const tClosest = (selector) => e.target.closest(selector); 
        const actionTarget = tClosest('[data-action]'); 
        if (actionTarget) { 
            const action = actionTarget.dataset.action; 
            const workflowId = actionTarget.dataset.workflowId; 
            if (action === 'view-workflow') openWorkflowBuilder(workflowId); 
            if (action === 'delete-workflow-card') handleDeleteWorkflow(workflowId); 
            if (action === 'link-google-automation') { 
                initializeGoogleLink(); 
                if (googleLinkClient) {
                    googleLinkClient.requestCode(); 
                }
            } 
            if (action === 'open-automation-app-password-modal') { openModal('appPassword'); } 
        } 
        const handlers = { '#add-workflow-btn': () => openModal('addWorkflow'), '#back-to-workflows-btn': () => { saveCurrentWorkflow(false); showWorkflowList(); }, '#save-workflow-btn': () => saveCurrentWorkflow(true), '#run-automation-btn': () => runAutomation(), }; 
        for (const [selector, handler] of Object.entries(handlers)) { if (tClosest(selector)) { handler(); return; } } 
        if (tClosest('.delete-node-btn')) { const nodeElement = tClosest('.node-instance'); if (nodeElement) { deleteNode(nodeElement); } return; } 
    }); 
    
    if (automationCanvas) { 
        document.querySelector('.automation-nodes').addEventListener('click', handleAutomationNodeClick); 
        automationCanvas.addEventListener('mousedown', handleAutomationMouseDown); 
        automationCanvas.addEventListener('dblclick', handleAutomationDoubleClick); 
    }
}