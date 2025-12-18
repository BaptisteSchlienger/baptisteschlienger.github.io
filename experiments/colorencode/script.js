document.addEventListener('DOMContentLoaded', () => {
    // Tabs logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-section`).classList.add('active');
        });
    });

    // Encoding Elements
    const textInput = document.getElementById('text-input');
    const hexDisplay = document.getElementById('hex-display');
    const chunksDisplay = document.getElementById('chunks-display');
    const encodeCanvas = document.getElementById('encode-canvas');
    const downloadBtn = document.getElementById('download-btn');

    const charLimitDisplay = document.getElementById('char-limit');

    const imageUpload = document.getElementById('image-upload');
    const dropZone = document.getElementById('drop-zone');
    const decodeError = document.getElementById('decode-error');
    const extractedHex = document.getElementById('extracted-hex');
    const viewAllBtn = document.getElementById('view-all-btn');
    const decodedText = document.getElementById('decoded-text');
    const copyBtn = document.getElementById('copy-btn');

    let fullHex = "";

    // --- ENCODING LOGIC ---

    textInput.addEventListener('input', () => {
        const text = textInput.value;
        charLimitDisplay.innerText = `${text.length} / 5000`;

        if (!text) {
            hexDisplay.innerText = "Waiting for input...";
            chunksDisplay.innerText = "Waiting for input...";
            downloadBtn.disabled = true;
            return;
        }

        // 1. Text to Hex
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);
        let hex = '';
        bytes.forEach(b => {
            hex += b.toString(16).padStart(2, '0');
        });
        hexDisplay.innerText = hex.toUpperCase();

        // 2. Hex to 6-char chunks (colors)
        const chunks = [];
        for (let i = 0; i < hex.length; i += 6) {
            let chunk = hex.substring(i, i + 6);
            // Pad last chunk with 0 if needed
            while (chunk.length < 6) chunk += '0';
            chunks.push(chunk);
        }
        chunksDisplay.innerText = chunks.map(c => `#${c.toUpperCase()}`).join(', ');

        // 3. Render to Canvas
        renderPixels(chunks);
        downloadBtn.disabled = false;
    });

    function renderPixels(chunks) {
        const size = Math.ceil(Math.sqrt(chunks.length));
        encodeCanvas.width = size;
        encodeCanvas.height = size;
        const ctx = encodeCanvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);

        chunks.forEach((chunk, index) => {
            const r = parseInt(chunk.substring(0, 2), 16);
            const g = parseInt(chunk.substring(2, 4), 16);
            const b = parseInt(chunk.substring(4, 6), 16);

            const x = index % size;
            const y = Math.floor(index / size);

            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        });

        // Set display size for UX
        encodeCanvas.style.width = '200px';
        encodeCanvas.style.height = '200px';
    }

    downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'color-encoded.png';
        link.href = encodeCanvas.toDataURL('image/png');
        link.click();
    });

    // --- DECODING LOGIC ---

    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleImageFile(file);
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleImageFile(file);
    });

    function handleImageFile(file) {
        decodeError.innerText = "";

        // 1. Check file size (limit: 1MB)
        if (file.size > 1024 * 1024) {
            decodeError.innerText = "File too large. Please use a PNG under 1MB.";
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // 2. Check dimensions (limit: 1000x1000px)
                if (img.width > 1000 || img.height > 1000) {
                    decodeError.innerText = "Dimensions too large. Limit is 1000x1000px.";
                    return;
                }
                decodeImage(img);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function decodeImage(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, img.width, img.height).data;
        let hex = '';

        for (let i = 0; i < imgData.length; i += 4) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const a = imgData[i + 3];

            // If alpha is 0, we might have hit end of data or empty pixels
            if (a === 0) continue;

            hex += r.toString(16).padStart(2, '0');
            hex += g.toString(16).padStart(2, '0');
            hex += b.toString(16).padStart(2, '0');
        }

        fullHex = hex.toUpperCase();
        updateHexDisplay();

        // Convert Hex to Bytes
        try {
            const bytes = [];
            for (let i = 0; i < hex.length; i += 2) {
                const byte = parseInt(hex.substring(i, i + 2), 16);
                if (byte === 0) break; // Null terminator
                bytes.push(byte);
            }

            const decoder = new TextDecoder();
            const result = decoder.decode(new Uint8Array(bytes));

            // Basic sanitization: remove trailing nulls or garbage if any
            decodedText.innerText = result.replace(/\0/g, '');
            copyBtn.disabled = false;
        } catch (e) {
            decodedText.innerText = "Error decoding: Unexpected data format.";
            copyBtn.disabled = true;
        }
    }

    function updateHexDisplay() {
        if (fullHex.length > 100) {
            extractedHex.innerText = fullHex.substring(0, 100) + "...";
            viewAllBtn.style.display = "block";
            viewAllBtn.innerText = "View All";
        } else {
            extractedHex.innerText = fullHex;
            viewAllBtn.style.display = "none";
        }
    }

    viewAllBtn.addEventListener('click', () => {
        if (extractedHex.innerText.endsWith("...")) {
            extractedHex.innerText = fullHex;
            viewAllBtn.innerText = "Show Less";
        } else {
            updateHexDisplay();
        }
    });

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(decodedText.innerText).then(() => {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);
        });
    });
});
