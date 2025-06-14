// --- START OF FILE js/image-studio.js ---

const handleImageGeneration = async (e) => {
    e.preventDefault();

    const form = document.getElementById('image-generation-form');
    const promptInput = document.getElementById('image-prompt');
    const styleSelect = document.getElementById('image-style');
    const resultContainer = document.getElementById('image-result-container');
    const submitButton = form.querySelector('button[type="submit"]');

    const prompt = promptInput.value.trim();
    if (!prompt) {
        showToast("Vui lòng nhập mô tả cho ảnh.", "error");
        return;
    }

    // Hiển thị trạng thái đang tải
    submitButton.disabled = true;
    submitButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Đang vẽ...`;
    
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="loader"></div><p>AI đang sáng tạo, vui lòng chờ trong giây lát...</p>';
    resultContainer.innerHTML = ''; // Xóa placeholder hoặc ảnh cũ
    resultContainer.appendChild(loadingOverlay);

    try {
        const response = await fetchWithAuth('/api/ai/generate-image', {
            method: 'POST',
            body: JSON.stringify({
                prompt: prompt,
                style: styleSelect.value
            })
        });

        // Xóa overlay và hiển thị ảnh
        loadingOverlay.remove();
        
        const img = document.createElement('img');
        img.id = 'generated-image';
        img.src = response.imageUrl;
        img.alt = prompt;

        const downloadBtn = document.createElement('a');
        downloadBtn.href = response.imageUrl;
        downloadBtn.download = `haibanhu-art-${Date.now()}.png`;
        downloadBtn.className = 'btn btn-primary';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Tải xuống';

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'image-result-actions';
        actionsDiv.appendChild(downloadBtn);

        resultContainer.appendChild(img);
        resultContainer.appendChild(actionsDiv);

    } catch (error) {
        showToast(error.message, 'error');
        // Khôi phục placeholder nếu có lỗi
        resultContainer.innerHTML = `<div class="image-placeholder"><i class="fa-solid fa-image-slash"></i><p>Tạo ảnh thất bại. Vui lòng thử lại.</p></div>`;
    } finally {
        // Khôi phục lại nút
        submitButton.disabled = false;
        submitButton.innerHTML = `<i class="fas fa-wand-magic-sparkles"></i> Tạo ảnh`;
    }
};

function initializeImageStudioPage() {
    const form = document.getElementById('image-generation-form');
    if (form) {
        form.addEventListener('submit', handleImageGeneration);
    }
}