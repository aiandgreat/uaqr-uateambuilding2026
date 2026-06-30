import alertPopup from "./utils/alert.js";

// Tab Switching Logic
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
    });
});

const API_BASE_URL = 'http://localhost:4000/api';
let originalStudentId = '';

// --- Cookie Utilities ---
function setCookie(name, value, hours) {
    const date = new Date();
    date.setTime(date.getTime() + (hours * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function countRegistrationCookies() {
    const cookies = document.cookie.split(';');
    // Specific hash used for student registration tracking
    return cookies.filter(cookie => cookie.trim().startsWith('dlmLqN+l84dx3G759VPBKxBmtWShFJJLmCSffBbSQ14=')).length;
}

function showRegistrationLimitModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Registration Limit Reached</h2>
                <button class="close-modal">&times;</button>
            </div>
            <p>You have already registered for this event. Duplicate registrations are not allowed.</p>
            <div class="modal-actions">
                <button class="primary-btn close-modal">OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const closeButtons = modal.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => modal.remove());
    });
}

// --- Registration Logic ---
document.getElementById('registerBtn').addEventListener('click', () => {
    const studentId = document.getElementById('studentId').value.trim();
    const name = document.getElementById('studentName').value.trim();
    const course = document.getElementById('registerCourse').value;

    if (countRegistrationCookies() >= 1) {
        showRegistrationLimitModal();
        return;
    }

    if (studentId.length !== 10) {
        alertPopup('UA ID must be exactly 10 characters long');
        return;
    }

    if (!studentId || !name || !course) {
        alertPopup('Please fill in all fields');
        return;
    }

    originalStudentId = studentId;
    showVerificationModal();
});

const verificationModal = document.getElementById('verificationModal');
const verifyStudentIdInput = document.getElementById('verifyStudentId');
const confirmVerifyBtn = document.getElementById('confirmVerifyBtn');
const cancelVerifyBtn = document.getElementById('cancelVerifyBtn');
const closeModalBtn = document.querySelector('.close-modal');

function showVerificationModal() {
    verificationModal.style.display = 'flex';
    verifyStudentIdInput.value = '';
    verifyStudentIdInput.focus();
}

function hideVerificationModal() {
    verificationModal.style.display = 'none';
}

closeModalBtn.addEventListener('click', hideVerificationModal);
cancelVerifyBtn.addEventListener('click', hideVerificationModal);
confirmVerifyBtn.addEventListener('click', () => {
    const verifiedStudentId = verifyStudentIdInput.value.trim();
    if (verifiedStudentId !== originalStudentId) {
        alertPopup('UA ID does not match. Please try again.');
        return;
    }
    hideVerificationModal();
    proceedWithRegistration();
});

async function proceedWithRegistration() {
    const name = document.getElementById('studentName').value.trim();
    const course = document.getElementById('registerCourse').value;
    const registerBtn = document.getElementById('registerBtn');
    
    registerBtn.disabled = true;
    registerBtn.textContent = 'Registering...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: originalStudentId, name, courseName: course })
        });
        
        const data = await response.json();
        if (response.ok) {
            const cookieName = 'dlmLqN+l84dx3G759VPBKxBmtWShFJJLmCSffBbSQ14=' + Date.now();
            setCookie(cookieName, '1', 999); 
            alertPopup('Registration successful! You may now generate your pass.');
            
            // Clear inputs and switch to Generate tab
            document.getElementById('studentId').value = '';
            document.getElementById('studentName').value = '';
            document.querySelector('[data-tab="generate"]').click();
            document.getElementById('qrStudentId').value = originalStudentId;
        } else {
            alertPopup(data.error || 'Registration failed');
        }
    } catch (error) {
        alertPopup('Registration failed. Please check your connection.');
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register';
    }
}

// --- QR Pass Generation (Canvas Stylized) ---
async function generateStudentQR() {
    const studentId = document.getElementById('qrStudentId').value.trim();
    const course = document.getElementById('qrCourse').value;
    
    if (studentId.length !== 10) {
        alertPopup('UA ID must be exactly 10 characters long');
        return;
    }

    if (!studentId || !course) {
        alertPopup('Please enter UA ID and select department');
        return;
    }
    
    const generateBtn = document.getElementById('generateQrBtn');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/generate-qr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, courseName: course })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const canvas = document.getElementById('qrCodeCanvas');
            canvas.dataset.studentId = studentId;
            canvas.dataset.studentName = data.studentName || 'Faculty';
            
            const ctx = canvas.getContext('2d');
            canvas.width = 400;
            canvas.height = 600;
            
            // 1. Background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 2. Header (Blue theme matching QR)
            ctx.fillStyle = '#1A3A6E';
            ctx.fillRect(0, 0, canvas.width, 140);
            
            // 3. Header Text
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.font = 'bold 24px "Playfair Display", serif';
            ctx.fillText('UA TEAM BUILDING 2026', canvas.width/2, 70);
            ctx.fillStyle = '#EBEBEB';
            ctx.font = 'italic 12px "Open Sans", sans-serif';
            ctx.fillText('Hacienda Gracia, Lubao, Pampanga', canvas.width/2, 110);
            
            // 4. Generate QR Code
            const qrSize = 250;
            const qrX = (canvas.width - qrSize) / 2;
            const qrY = 180;
            
            const tempCanvas = document.createElement('canvas');
            await QRCode.toCanvas(tempCanvas, data.encryptedData, {
                width: qrSize,
                margin: 1,
                color: { dark: '#1A3A6E', light: '#FFFFFF' }
            });
            
            ctx.drawImage(tempCanvas, qrX, qrY);
            
            // QR Border
            ctx.strokeStyle = '#1A3A6E';
            ctx.lineWidth = 2;
            ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
            
            // 5. Footer Details
            const footerY = 480;
            ctx.fillStyle = '#1A3A6E';
            ctx.font = 'bold 18px "Open Sans", sans-serif';
            ctx.fillText((data.studentName || 'Faculty').toUpperCase(), canvas.width/2, footerY);
            ctx.font = '14px "Open Sans", sans-serif';
            ctx.fillStyle = '#555555';
            ctx.fillText(studentId, canvas.width/2, footerY + 25);
            
            // Divider
            ctx.beginPath();
            ctx.moveTo(100, footerY + 45);
            ctx.lineTo(300, footerY + 45);
            ctx.strokeStyle = '#1A3A6E';
            ctx.stroke();
            
            // Event Info
            ctx.fillStyle = '#C41E3A';
            ctx.font = 'bold 12px "Open Sans", sans-serif';
            ctx.fillText('JULY 3, 2026 | 8:00 AM - 4:00 PM', canvas.width/2, footerY + 70);
            ctx.font = '10px "Open Sans", sans-serif';

            document.getElementById('qrCodeContainer').classList.remove('hidden');
        } else {
            alertPopup(data.error || 'Failed to generate QR code');
        }
    } catch (error) {
        alertPopup('Server error while generating QR.');
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate QR Pass';
    }
}

// --- Download Utilities ---
function downloadQRCode() {
    const canvas = document.getElementById('qrCodeCanvas');
    const studentId = canvas.dataset.studentId || '';
    const name = canvas.dataset.studentName || 'Student';
    
    let filename = `Techkada_Pass_2026_${studentId}_${name.replace(/\s+/g, '_')}.png`;

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// --- Course Loading ---
async function populateCourseSelects() {
    const selects = ['registerCourse', 'qrCourse'];
    try {
        const response = await fetch(`${API_BASE_URL}/courses`);
        const data = await response.json();
        
        if (response.ok) {
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                data.courses.forEach(course => {
                    const opt = document.createElement('option');
                    opt.value = course.name;
                    opt.textContent = course.name;
                    el.appendChild(opt);
                });
            });
        }
    } catch (err) {
        console.error('Failed to load courses');
    }
}

document.addEventListener('DOMContentLoaded', populateCourseSelects);
document.getElementById('generateQrBtn').addEventListener('click', generateStudentQR);
document.getElementById('downloadBtn').addEventListener('click', downloadQRCode);