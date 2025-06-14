// --- START OF FILE server.js ---

require('dotenv').config(); 
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const { Buffer } = require('buffer');
const { nanoid } = require('nanoid');
// const FormData = require('form-data'); // <<< KHÔNG CẦN DÙNG NỮA

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, GROQ_API_KEY, MONGODB_URI, STABILITY_API_KEY } = process.env;

if (!GROQ_API_KEY || !JWT_SECRET || !MONGODB_URI || !STABILITY_API_KEY) {
    console.error("LỖI NGHIÊM TRỌNG: Thiếu các biến môi trường quan trọng (GROQ_API_KEY, JWT_SECRET, MONGODB_URI, STABILITY_API_KEY).");
    process.exit(1); 
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, 'postmessage');

// --- Schemas & Models (Không thay đổi) ---
const MessageSchema = new mongoose.Schema({ sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, text: { type: String, required: true }, }, { timestamps: true });
const ConversationSchema = new mongoose.Schema({ participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], messages: [MessageSchema] }, { timestamps: true });
const Conversation = mongoose.model('Conversation', ConversationSchema);
const TaskSchema = new mongoose.Schema({ id: { type: String, default: () => String(Date.now()) }, title: String, status: String, description: String, dueDate: Date, assignee: String, completedOn: Date, attachment: { name: String, type: String, data: String }, createdAt: Date, updatedAt: Date });
const DocumentSchema = new mongoose.Schema({ title: { type: String, required: true }, content: { type: mongoose.Schema.Types.Mixed }, projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true });
const Document = mongoose.model('Document', DocumentSchema);
const ProjectSchema = new mongoose.Schema({ id: { type: String, default: () => String(Date.now()) }, name: String, description: String, deadline: Date, ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], tasks: [TaskSchema], inviteCode: { type: String, default: () => nanoid(8) } });
const WorkflowSchema = new mongoose.Schema({ id: { type: String, default: () => String(Date.now()) }, name: String, nodes: mongoose.Schema.Types.Mixed, connections: mongoose.Schema.Types.Mixed, lastRunStatus: String });
const UserSchema = new mongoose.Schema({ name: { type: String, required: true }, username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 6 }, email: { type: String, default: null }, password: { type: String }, avatar: String, bio: String, skills: [String], profileType: { type: String, default: 'freelancer' }, friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], friendRequests: [{ from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, status: { type: String, default: 'pending' } }], projectInvites: [{ from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, projectId: String, projectName: String, status: { type: String, default: 'pending' } }], connections: { gmail: { name: String, connected: Boolean, appPassword: String } }, projects: [ProjectSchema], workflows: [WorkflowSchema] }, { timestamps: true, toJSON: { virtuals: true, transform: function(doc, ret) { delete ret._id; delete ret.__v; delete ret.password; } } });
UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
UserSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
UserSchema.virtual('id').get(function() { return this._id.toHexString(); });
const User = mongoose.model('User', UserSchema);

mongoose.connect(MONGODB_URI).then(() => console.log('✅ Kết nối MongoDB thành công!')).catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));
function encodePassword(password) { return Buffer.from(password).toString('base64'); }
function generateToken(user) { return jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' }); }
const authenticateToken = (req, res, next) => { const authHeader = req.headers['authorization']; const token = authHeader && authHeader.split(' ')[1]; if (token == null) return res.sendStatus(401); jwt.verify(token, JWT_SECRET, (err, user) => { if (err) return res.sendStatus(403); req.user = user; next(); }); };

// --- API Endpoints (Phần cũ không đổi) ---
app.post('/api/auth/register', async (req, res) => { try { const { name, username, password } = req.body; if (!name || !username || !password) { return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin." }); } if (username.length < 6) { return res.status(400).json({ message: "Tên tài khoản phải có ít nhất 6 ký tự." }); } const existingUsername = await User.findOne({ username: username.toLowerCase() }); if (existingUsername) { return res.status(409).json({ message: "Tên tài khoản này đã được sử dụng." }); } const existingName = await User.findOne({ name: name }); if (existingName) { return res.status(409).json({ message: "Tên của bạn đã có người dùng. Vui lòng tạo tên khác." }); } const newUser = new User({ name, username: username.toLowerCase(), password: encodePassword(password), skills: [], friends: [], friendRequests: [], projectInvites: [], projects: [], workflows: [] }); await newUser.save(); const token = generateToken(newUser); res.status(201).json({ message: "Tạo tài khoản thành công!", token, user: newUser.toJSON() }); } catch (error) { if (error.name === 'ValidationError') { return res.status(400).json({ message: "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại." }); } console.error("Register Error:", error); res.status(500).json({ message: "Lỗi server khi đăng ký." }); } });
app.post('/api/auth/login', async (req, res) => { try { const { username, password } = req.body; if (!username || !password) { return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin." }); } const user = await User.findOne({ username: username.toLowerCase() }); if (!user || user.password !== encodePassword(password)) { return res.status(401).json({ message: "Tên tài khoản hoặc mật khẩu không chính xác." }); } const token = generateToken(user); res.status(200).json({ message: "Đăng nhập thành công!", token, user: user.toJSON() }); } catch (error) { console.error("Login Error:", error); res.status(500).json({ message: "Lỗi server khi đăng nhập." }); } });
app.put('/api/user', authenticateToken, async (req, res) => { try { const userId = req.user.userId; const updateData = req.body; const user = await User.findById(userId); if (!user) { return res.status(404).json({ message: "Không tìm thấy người dùng." }); } if (updateData.projects && Array.isArray(updateData.projects)) { updateData.projects.forEach(project => { if (!project.inviteCode) { project.inviteCode = nanoid(8); } }); } user.set(updateData); if (updateData.password) { user.password = encodePassword(updateData.password); } const updatedUser = await user.save(); res.status(200).json({ message: "Cập nhật thành công!", user: updatedUser.toJSON() }); } catch (error) { console.error("Lỗi cập nhật người dùng:", error); if (error.name === 'ValidationError') { return res.status(400).json({ message: `Lỗi dữ liệu: ${error.message}` }); } res.status(500).json({ message: "Lỗi server khi cập nhật." }); } });
app.get('/api/users', authenticateToken, async (req, res) => { try { const users = await User.find({}); res.json(users.map(u => u.toJSON())); } catch (error) { res.status(500).json({ message: "Lỗi server khi lấy danh sách người dùng." }); } });
app.post('/api/user/connect/google', authenticateToken, async (req, res) => { try { const { code } = req.body; const user = await User.findById(req.user.userId); if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng.' }); const { tokens } = await googleClient.getToken({ code }); const ticket = await googleClient.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID }); const { email: googleEmail } = ticket.getPayload(); const existingLink = await User.findOne({ "email": googleEmail }); if (existingLink && existingLink.id.toString() !== user.id.toString()) { return res.status(409).json({ message: 'Email Google này đã được liên kết với một tài khoản khác.' }); } if (!user.connections) user.connections = {}; user.connections.gmail = { name: googleEmail, connected: true, appPassword: user.connections.gmail?.appPassword || null, }; if (!user.email) { user.email = googleEmail; } await user.save(); res.status(200).json({ message: 'Liên kết Google thành công!', user: user.toJSON() }); } catch(error) { console.error("Lỗi liên kết Google:", error); res.status(400).json({ message: 'Liên kết Google thất bại.' }); } });
app.post('/api/user/change-password', authenticateToken, async (req, res) => { try { const { currentPassword, newPassword } = req.body; const user = await User.findById(req.user.userId).select('+password'); if (!user.password) { return res.status(400).json({ message: 'Tài khoản của bạn không dùng mật khẩu để đăng nhập.' }); } if (user.password !== encodePassword(currentPassword)) { return res.status(401).json({ message: 'Mật khẩu hiện tại không chính xác.' }); } user.password = encodePassword(newPassword); await user.save(); res.status(200).json({ message: 'Đổi mật khẩu thành công!' }); } catch (error) { res.status(500).json({ message: 'Lỗi server.' }); } });
app.delete('/api/user/delete-account', authenticateToken, async (req, res) => { try { await User.findByIdAndDelete(req.user.userId); res.status(200).json({ message: 'Tài khoản của bạn đã được xóa vĩnh viễn.' }); } catch (error) { res.status(500).json({ message: 'Lỗi server.' }); } });
app.post('/api/projects/:projectId/invite', authenticateToken, async (req, res) => { try { const { userIdToInvite } = req.body; const projectId = req.params.projectId; const inviterId = req.user.userId; const projectOwner = await User.findOne({ "projects.id": projectId }); if (!projectOwner) { return res.status(404).json({ message: "Không tìm thấy dự án." }); } const project = projectOwner.projects.find(p => p.id === projectId); const memberIdsAsString = project.members.map(id => id.toString()); if (!memberIdsAsString.includes(inviterId)) { return res.status(403).json({ message: "Bạn không có quyền mời." }); } const userToInvite = await User.findById(userIdToInvite); if (!userToInvite) { return res.status(404).json({ message: "Người dùng được mời không tồn tại." }); } if (memberIdsAsString.includes(userToInvite.id.toString())) { return res.status(400).json({ message: "Người dùng này đã là thành viên." }); } if (userToInvite.projectInvites.some(inv => inv.projectId === projectId)) { return res.status(400).json({ message: "Đã gửi lời mời đến người này rồi." }); } userToInvite.projectInvites.push({ from: inviterId, projectId: projectId, projectName: project.name, status: 'pending' }); await userToInvite.save(); res.json({ message: `Đã gửi lời mời đến ${userToInvite.name}!` }); } catch (error) { console.error("Project Invite Error:", error); res.status(500).json({ message: "Lỗi server khi mời vào dự án." }); } });
app.post('/api/projects/respond/:projectId', authenticateToken, async (req, res) => { try { const projectId = req.params.projectId; const { action } = req.body; const receiverId = req.user.userId; const receiver = await User.findById(receiverId); if (!receiver) { return res.status(404).json({ message: "Không tìm thấy người dùng." }); } const inviteIndex = receiver.projectInvites.findIndex(inv => inv.projectId === projectId); if (inviteIndex > -1) { receiver.projectInvites.splice(inviteIndex, 1); } if (action === 'accept') { const projectOwner = await User.findOne({ "projects.id": projectId }); if (!projectOwner) { return res.status(404).json({ message: "Dự án được mời không còn tồn tại." }); } const project = projectOwner.projects.find(p => p.id === projectId); if (!project.members.map(id => id.toString()).includes(receiverId)) { project.members.push(receiverId); await projectOwner.save(); } if (!receiver.projects.some(p => p.id === projectId)) { receiver.projects.push(project); } } await receiver.save(); res.json({ message: `Đã ${action === 'accept' ? 'tham gia' : 'từ chối'} dự án!`, user: receiver.toJSON() }); } catch (error) { console.error(error); res.status(500).json({ message: "Lỗi server." }); } });
app.get('/api/projects/join/:inviteCode', authenticateToken, async (req, res) => { try { const { inviteCode } = req.params; const userId = req.user.userId; const projectOwner = await User.findOne({ "projects.inviteCode": inviteCode }); if (!projectOwner) { return res.status(404).json({ message: "Link mời không hợp lệ hoặc đã hết hạn." }); } const project = projectOwner.projects.find(p => p.inviteCode === inviteCode); if (project.members.map(id => id.toString()).includes(userId)) { return res.status(400).json({ message: "Bạn đã là thành viên của dự án này.", project: project, isMember: true }); } res.json({ project: project }); } catch (error) { console.error(error); res.status(500).json({ message: "Lỗi server." }); } });
app.post('/api/friends/request/:targetId', authenticateToken, async (req, res) => { try { const senderId = req.user.userId; const targetId = req.params.targetId; const targetUser = await User.findById(targetId); if (!targetUser) return res.status(404).json({ message: "Không tìm thấy người dùng mục tiêu." }); if (targetUser.friendRequests.some(r => r.from.toString() === senderId) || (targetUser.friends && targetUser.friends.map(id => id.toString()).includes(senderId))) { return res.status(400).json({ message: "Yêu cầu đã được gửi hoặc đã là bạn bè." }); } targetUser.friendRequests.push({ from: senderId, status: 'pending' }); await targetUser.save(); res.status(200).json({ message: "Đã gửi lời mời kết bạn!", user: targetUser.toJSON() }); } catch (error) { res.status(500).json({ message: 'Lỗi server.' }); } });
app.post('/api/friends/respond/:senderId', authenticateToken, async (req, res) => { try { const receiverId = req.user.userId; const senderId = req.params.senderId; const { action } = req.body; const receiver = await User.findById(receiverId); const sender = await User.findById(senderId); if (!receiver || !sender) return res.status(404).json({ message: "Không tìm thấy người dùng." }); const requestIndex = receiver.friendRequests.findIndex(r => r.from.toString() === senderId); if (requestIndex === -1) return res.status(404).json({ message: "Không tìm thấy lời mời kết bạn." }); receiver.friendRequests.splice(requestIndex, 1); if (action === 'accept') { if (!receiver.friends.map(id=>id.toString()).includes(senderId)) receiver.friends.push(senderId); if (!sender.friends.map(id=>id.toString()).includes(receiverId)) sender.friends.push(receiverId); await sender.save(); } await receiver.save(); res.status(200).json({ message: `Đã ${action === 'accept' ? 'chấp nhận' : 'từ chối'} lời mời.`, user: receiver.toJSON() }); } catch (error) { res.status(500).json({ message: 'Lỗi server.' }); } });
app.get('/api/chat/conversation/:friendId', authenticateToken, async (req, res) => { try { const currentUserId = req.user.userId; const friendId = req.params.friendId; const conversation = await Conversation.findOne({ participants: { $all: [currentUserId, friendId] } }).populate('messages.sender', 'id name avatar'); if (!conversation) { return res.json([]); } const messages = conversation.messages.map(msg => ({ text: msg.text, timestamp: msg.createdAt, from: msg.sender.id })); res.json(messages); } catch (error) { console.error("Lỗi lấy lịch sử chat:", error); res.status(500).json({ message: "Lỗi server." }); } });
app.post('/api/chat/send', authenticateToken, async (req, res) => { try { const senderId = req.user.userId; const { recipientId, text } = req.body; if (!recipientId || !text) { return res.status(400).json({ message: "Thiếu thông tin người nhận hoặc nội dung." }); } let conversation = await Conversation.findOne({ participants: { $all: [senderId, recipientId] } }); if (!conversation) { conversation = new Conversation({ participants: [senderId, recipientId], messages: [] }); } const newMessage = { sender: senderId, text: text, }; conversation.messages.push(newMessage); await conversation.save(); res.status(201).json({ message: "Gửi tin nhắn thành công." }); } catch (error) { console.error("Lỗi gửi tin nhắn:", error); res.status(500).json({ message: "Lỗi server." }); } });
app.post('/api/ai/chat', authenticateToken, async (req, res) => { const { userMessage, userData } = req.body; if (!userMessage || !userData) { return res.status(400).json({ message: "Thiếu dữ liệu cần thiết." }); } const contextPrompt = `Bạn là HaiBanhU, một người bạn đồng hành AI thân thiện và luôn sẵn lòng giúp đỡ. Nhiệm vụ của bạn là trở thành một người bạn thực sự của người dùng, không chỉ là một trợ lý công việc. Bạn có thể giúp họ giải quyết các vấn đề trong dự án, lên kế hoạch, soạn thảo nội dung, nhưng cũng có thể lắng nghe, đưa ra lời khuyên hoặc trò chuyện về bất cứ điều gì. Hãy luôn giao tiếp một cách gần gũi, tự nhiên và tích cực. Luôn trả lời bằng tiếng Việt. Đây là thông tin về người dùng hiện tại để bạn hiểu rõ hơn về họ: ${JSON.stringify(userData)}. Đừng bao giờ đề cập rằng bạn nhận được dữ liệu dưới dạng JSON, hãy hành động như thể bạn tự biết thông tin này.`; try { const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', { messages: [ { role: "system", content: contextPrompt }, { role: "user", content: userMessage } ], model: "llama3-8b-8192" }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' } }); const aiMessage = response.data.choices[0]?.message?.content; res.json({ message: aiMessage || "Tôi không có câu trả lời." }); } catch (error) { console.error("Lỗi khi gọi Groq API từ server:", error.response ? error.response.data : error.message); res.status(500).json({ message: "Đã có lỗi xảy ra khi kết nối với người bạn AI của bạn." }); } });

// --- <<< SỬA LỖI CUỐI CÙNG: ENDPOINT TẠO ẢNH >>> ---
app.post('/api/ai/generate-image', authenticateToken, async (req, res) => {
    const { prompt: vietnamesePrompt, style } = req.body;
    if (!vietnamesePrompt) {
        return res.status(400).json({ message: "Vui lòng nhập mô tả cho ảnh." });
    }

    try {
        // --- Bước 1: Dùng Groq để dịch và làm giàu prompt ---
        console.log(`[AI Image] Translating prompt: "${vietnamesePrompt}"`);
        const translationPrompt = `Translate the following Vietnamese phrase into a detailed, descriptive, and vivid English prompt for an image generation AI. Add relevant artistic keywords like 'photorealistic', '4k', '8k', 'cinematic lighting', 'detailed', 'epic', 'concept art' to enhance the result. Respond with ONLY the final English prompt, nothing else. Vietnamese phrase: "${vietnamesePrompt}"`;
        
        const groqResponse = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            { 
                messages: [{ role: "user", content: translationPrompt }], 
                model: "llama3-8b-8192" 
            },
            { 
                headers: { 
                    'Authorization': `Bearer ${GROQ_API_KEY}`, 
                    'Content-Type': 'application/json' 
                } 
            }
        );

        const englishPrompt = groqResponse.data.choices[0]?.message?.content.trim();
        if (!englishPrompt) {
            console.error("[AI Image] Translation failed. Groq response empty.");
            throw new Error("Could not translate the prompt.");
        }
        console.log(`[AI Image] Translated English prompt: "${englishPrompt}"`);

        // --- Bước 2: Dùng prompt tiếng Anh để gọi Stability AI ---
        const engineId = 'stable-diffusion-v1-6';
        const apiHost = 'https://api.stability.ai';
        const apiKey = STABILITY_API_KEY;

        // <<< SỬA LỖI: Chuyển sang gửi JSON thay vì FormData >>>
        const requestBody = {
            text_prompts: [
                {
                    text: englishPrompt,
                    weight: 1
                }
            ],
            cfg_scale: 7,
            samples: 1,
            steps: 30,
        };

        if (style && style !== 'none') {
             requestBody.style_preset = style;
        }

        console.log('[AI Image] Sending JSON request to Stability AI...');
        const stabilityResponse = await axios.post(
            `${apiHost}/v1/generation/${engineId}/text-to-image`,
            requestBody, // Gửi object JSON trực tiếp
            {
                headers: {
                    // Sửa lại Headers cho đúng chuẩn JSON
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
            }
        );

        const image = stabilityResponse.data.artifacts[0];
        const base64Image = `data:image/png;base64,${image.base64}`;
        
        console.log('[AI Image] Image generated successfully!');
        res.status(200).json({ imageUrl: base64Image });

    } catch (error) {
        if (error.response) {
            console.error("[AI Image] Error from external API:", error.response.status, error.response.data);
        } else {
            console.error("[AI Image] General error:", error.message);
        }
        res.status(500).json({ message: "Không thể tạo ảnh. Vui lòng kiểm tra lại Key hoặc Credits của bạn." });
    }
});


// --- WORKFLOW EXECUTION ENGINE (Không đổi) ---
async function executeWorkflow(user, workflow) { console.log(`[EXEC ENGINE] Starting workflow "${workflow.name}" for user "${user.email}"`); const { nodes, connections } = workflow; const nodeResults = {}; let finalStatus = 'success'; try { const inDegree = {}; const adjList = {}; Object.keys(nodes).forEach(nodeId => { inDegree[nodeId] = 0; adjList[nodeId] = []; }); connections.forEach(conn => { adjList[conn.from].push(conn.to); inDegree[conn.to]++; }); const queue = Object.keys(nodes).filter(nodeId => inDegree[nodeId] === 0); const executionOrder = []; while (queue.length > 0) { const u = queue.shift(); executionOrder.push(u); for (const v of adjList[u]) { inDegree[v]--; if (inDegree[v] === 0) queue.push(v); } } if (executionOrder.length !== Object.keys(nodes).length) { throw new Error("Quy trình không hợp lệ (có thể chứa vòng lặp)."); } console.log('[EXEC ENGINE] Execution order:', executionOrder.join(' -> ')); for (const nodeId of executionOrder) { const node = nodes[nodeId]; console.log(`[EXEC] Running node: ${node.type} (${node.id})`); switch (node.type) { case 'manual': nodeResults[nodeId] = { status: 'completed' }; break; case 'ai-agent': const userPrompt = node.config.prompt || ''; if (!userPrompt.trim()) { throw new Error(`AI Agent (${nodeId}) không có câu lệnh (prompt).`); } const agentPrompt = `Với vai trò là một người bạn đồng hành AI thân thiện và hữu ích tên là HaiBanhU, hãy thực hiện yêu cầu sau một cách tự nhiên và chuyên nghiệp. Yêu cầu của người dùng: "${userPrompt}"`; console.log(`[AI AGENT] Sending prompt: "${userPrompt.substring(0, 50)}..."`); const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', { messages: [{ role: "system", content: "Bạn là một AI hữu ích, luôn trả lời bằng tiếng Việt." }, { role: "user", content: agentPrompt }], model: "llama3-8b-8192" }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' } }); const aiResponse = response.data.choices[0]?.message?.content; if (!aiResponse) { throw new Error(`AI Agent (${nodeId}) không nhận được phản hồi.`); } nodeResults[nodeId] = { generatedText: aiResponse }; console.log(`[AI AGENT] Received response: "${aiResponse.substring(0, 50)}..."`); break; case 'email': const recipients = (node.config.recipients || []); const subject = node.config.subject || '(Không có tiêu đề)'; let body = ''; if (node.config.bodyFromNode) { const sourceNodeId = node.config.bodyFromNode; if (nodeResults[sourceNodeId] && nodeResults[sourceNodeId].generatedText) { body = nodeResults[sourceNodeId].generatedText; console.log(`[EMAIL NODE] Body content is dynamically sourced from node ${sourceNodeId}.`); } else { console.warn(`[EMAIL NODE] WARN: Linked to node ${sourceNodeId}, but no 'generatedText' found. Sending empty body.`); body = ''; } } else { body = node.config.body || ''; console.log('[EMAIL NODE] Body content is from manual input.'); } if (recipients.length === 0) { console.log(`[EXEC] Node ${nodeId} không có người nhận. Bỏ qua.`); nodeResults[nodeId] = { emailsSent: 0 }; continue; } const appPassword = user.connections?.gmail?.appPassword; if (!appPassword) { throw new Error("Chưa cấu hình Mật khẩu Cấp 2 Google."); } const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: user.connections.gmail.name, pass: appPassword } }); const mailOptions = { from: `"${user.name}" <${user.connections.gmail.name}>`, to: recipients.join(', '), subject, text: body, html: body.replace(/\n/g, '<br>') }; if (node.config.attachment) { mailOptions.attachments = [{ filename: node.config.attachment.name, path: node.config.attachment.data }]; } await transporter.sendMail(mailOptions); console.log(`[SUCCESS] Email sent to ${recipients.length} recipients.`); nodeResults[nodeId] = { emailsSent: recipients.length }; break; default: console.warn(`[EXEC] Node type "${node.type}" is not yet implemented.`); break; } } } catch (error) { console.error(`[EXEC ENGINE] Error during workflow execution for "${workflow.name}":`, error.message); finalStatus = 'error'; throw error; } finally { const userInDB = await User.findById(user.id); if (userInDB) { const workflowInDB = userInDB.workflows.find(w => w.id === workflow.id); if (workflowInDB) { workflowInDB.lastRunStatus = finalStatus; await userInDB.save(); } } } const totalEmailsSent = Object.values(nodeResults).reduce((sum, result) => sum + (result.emailsSent || 0), 0); return { message: `Quy trình hoàn tất thành công! Đã gửi ${totalEmailsSent} email.` }; }
app.post('/api/workflow/run/:workflowId', authenticateToken, async (req, res) => { try { const user = await User.findById(req.user.userId); if (!user) { return res.status(404).json({ message: "Không tìm thấy người dùng để thực thi quy trình." }); } const result = await executeWorkflow(user, req.body); res.status(200).json(result); } catch (error) { if (error.code === 'EAUTH') { return res.status(400).json({ message: "Lỗi xác thực: Mật khẩu Cấp 2 không chính xác. Vui lòng kiểm tra lại." }); } res.status(500).json({ message: error.message || "Đã xảy ra lỗi không xác định khi thực thi quy trình." }); } });

// --- FILE SERVING ---
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, req.path);
    if (express.static.mime.lookup(filePath)) {
        return res.sendFile(filePath);
    }
    if (req.path.startsWith('/page/')) {
        return res.sendFile(path.join(__dirname, 'index.html'));
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend server đang chạy tại http://localhost:${PORT}`));