import alertPopup from "./utils/alert.js";

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:4000/api'
  : 'https://uaqr-uateambuilding2026.vercel.app/api'; // Change '/api' to your production backend URL if deploying frontend and backend separately


let adminToken = null;
let currentEditingCourseId = null;
let currentDeletingCourseId = null;
let currentDeletingCourseName = null;

const ITEMS_PER_PAGE = 10;
let currentCoursePage = 1;
let currentAttendancePage = 1;
let totalCoursePages = 1;
let totalAttendancePages = 1;

document.addEventListener('DOMContentLoaded', () => {
    const token = sessionStorage.getItem('adminToken');
    if (token) {
        adminToken = token;
        showDashboard();
        loadAdminCourses();
        loadCoursesForFilter();
        fetchAttendances();
        initializeTableDrag();
    }
});

document.getElementById('adminLoginBtn').addEventListener('click', adminLogin);

async function adminLogin() {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    const loginStatus = document.getElementById('adminLoginStatus');
    
    if (!username || !password) {
        loginStatus.textContent = 'Please enter both username and password';
        loginStatus.classList.remove('hidden');
        return;
    }
    
    const loginBtn = document.getElementById('adminLoginBtn');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    loginStatus.classList.add('hidden');
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            adminToken = data.token;
            sessionStorage.setItem('adminToken', adminToken);
            showDashboard();
            await loadAdminCourses();
            await loadCoursesForFilter();
            await fetchAttendances();
        } else {
            loginStatus.textContent = data.error || 'Login failed';
            loginStatus.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Admin login error:', error);
        loginStatus.textContent = 'Login failed. Please try again.';
        loginStatus.classList.remove('hidden');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
}

function showDashboard() {
    document.getElementById('adminLogin').classList.add('hidden');
    document.getElementById('adminDashboard').classList.remove('hidden');
}

document.getElementById('logoutBtn').addEventListener('click', () => {
    adminToken = null;
    sessionStorage.removeItem('adminToken');
    document.getElementById('adminDashboard').classList.add('hidden');
    document.getElementById('adminLogin').classList.remove('hidden');
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminPassword').value = '';
});

async function loadAdminCourses() {
    try {
        const response = await fetch(`${API_BASE_URL}/courses/full`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const tbody = document.getElementById('coursesTableBody');
            tbody.innerHTML = '';
            
            if (data.courses.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="3" class="no-records">No departments found</td>';
                tbody.appendChild(row);
                return;
            }


            totalCoursePages = Math.ceil(data.courses.length / ITEMS_PER_PAGE);
            updateCoursePagination();

            const startIndex = (currentCoursePage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const currentPageItems = data.courses.slice(startIndex, endIndex);
            
            currentPageItems.forEach(course => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${course.name}</td>
                    <td>${new Date(course.createdAt).toLocaleDateString()}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="icon-btn edit-btn" data-id="${course.id}" data-name="${course.name}" data-key="${course.encryptionKey}" title="Edit Department">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="icon-btn delete-btn" data-id="${course.id}" data-name="${course.name}" title="Delete Department">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', showEditCourseModal);
            });
            
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', confirmDeleteCourse);
            });
        } else {
            throw new Error(data.error || 'Failed to load departments');
        }
    } catch (error) {
        console.error('Load departments error:', error);
        showStatusMessage('courseStatus', 'Failed to load departments', false);
    }
}

document.getElementById('generateKeyBtn').addEventListener('click', generateRandomKey);

function generateRandomKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let key = '';
    
    for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    document.getElementById('courseKey').value = key;
    
    const keyInputContainer = document.querySelector('.key-input-container');
    const successMsg = document.createElement('div');
    successMsg.className = 'key-success-message';
    successMsg.innerHTML = '<i class="fa-solid fa-check"></i> Key generated';
    keyInputContainer.appendChild(successMsg);
    
    setTimeout(() => {
        successMsg.remove();
    }, 2000);
}

function updateCoursePagination() {
    const prevBtn = document.getElementById('prevCoursePage');
    const nextBtn = document.getElementById('nextCoursePage');
    const pageInfo = document.getElementById('coursePageInfo');

    prevBtn.disabled = currentCoursePage === 1;
    nextBtn.disabled = currentCoursePage === totalCoursePages;
    pageInfo.textContent = `Page ${currentCoursePage} of ${totalCoursePages}`;
}

document.getElementById('prevCoursePage').addEventListener('click', () => {
    if (currentCoursePage > 1) {
        currentCoursePage--;
        loadAdminCourses();
    }
});

document.getElementById('nextCoursePage').addEventListener('click', () => {
    if (currentCoursePage < totalCoursePages) {
        currentCoursePage++;
        loadAdminCourses();
    }
});

async function loadCoursesForFilter() {
    try {
        const response = await fetch(`${API_BASE_URL}/courses/full`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const courseSelect = document.getElementById('filterCourse');
            const verifyCourseSelect = document.getElementById('verifyCourse');
            
            while (courseSelect.options.length > 1) {
                courseSelect.remove(1);
            }
            while (verifyCourseSelect.options.length > 1) {
                verifyCourseSelect.remove(1);
            }
            
            data.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course.name;
                option.textContent = course.name;
                courseSelect.appendChild(option);
                
                const verifyOption = document.createElement('option');
                verifyOption.value = course.name;
                verifyOption.textContent = course.name;
                verifyCourseSelect.appendChild(verifyOption);
            });
        } else {
            throw new Error(data.error || 'Failed to load courses');
        }
    } catch (error) {
        console.error('Load courses error:', error);
        showStatusMessage('courseStatus', 'Failed to load courses', false);
    }
}

document.getElementById('addCourseBtn').addEventListener('click', async () => {
    const name = document.getElementById('courseName').value.trim();
    const key = document.getElementById('courseKey').value.trim();
    
    if (!name || !key) {
        showStatusMessage('courseStatus', 'Both department and encryption key are required', false);
        return;
    }
    
    if (key.length < 16) {
        showStatusMessage('courseStatus', 'Encryption key must be at least 16 characters', false);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/courses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ name, encryptionKey: key })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatusMessage('courseStatus', 'Course added successfully', true);
            document.getElementById('courseName').value = '';
            document.getElementById('courseKey').value = '';
            await loadAdminCourses();
            await loadCoursesForFilter();
        } else {
            throw new Error(data.error || 'Failed to add course');
        }
    } catch (error) {
        console.error('Add course error:', error);
        showStatusMessage('courseStatus', error.message || 'Failed to add course', false);
    }
});

function showEditCourseModal(e) {
    const btn = e.target.closest('.edit-btn');
    if (!btn) return;
    
    const courseId = btn.dataset.id;
    const courseName = btn.dataset.name;
    const courseKey = btn.dataset.key;
    
    if (!courseId || !courseName || !courseKey) {
        console.error('Missing course data:', { courseId, courseName, courseKey });
        return;
    }
    
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(loadingOverlay);
    
    setTimeout(() => {
        try {
            currentEditingCourseId = courseId;
            document.getElementById('editCourseName').value = courseName;
            document.getElementById('editCourseKey').value = courseKey;
            document.getElementById('editCourseStatus').classList.add('hidden');
            
            const modal = document.getElementById('editCourseModal');
            document.body.classList.add("modal-open");
            modal.style.display = "flex";
            modal.classList.remove('hidden');
        } catch (error) {
            console.error('Error showing edit modal:', error);
            showStatusMessage('courseStatus', 'Error loading course data', false);
        } finally {
            loadingOverlay.remove();
        }
    }, 300);
}

function closeEditModal() {
    const modal = document.getElementById('editCourseModal');
    document.body.classList.remove("modal-open");
    modal.style.display = "none";
    modal.classList.add('hidden');
    document.removeEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        closeEditModal();
    }
}

document.getElementById('editCourseModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('editCourseModal')) {
        document.getElementById('editCourseModal').classList.add('hidden');
    }
});

document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
document.querySelector('.close-modal').addEventListener('click', closeEditModal);

document.getElementById('cancelEditBtn').addEventListener('click', () => {
    document.getElementById('editCourseModal').classList.add('hidden');
});

document.getElementById('saveCourseBtn').addEventListener('click', async () => {
    const name = document.getElementById('editCourseName').value.trim();
    const key = document.getElementById('editCourseKey').value.trim();
    
    if (!name || !key) {
        showStatusMessage('courseStatus', 'Both department name and encryption key are required', false);
        return;
    }
    
    if (key.length < 16) {
        showStatusMessage('courseStatus', 'Encryption key must be at least 16 characters', false);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/courses/${currentEditingCourseId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ name, encryptionKey: key })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatusMessage('courseStatus', 'Course updated successfully', true);
            closeEditModal();
            await loadAdminCourses();
            await loadCoursesForFilter();
        } else {
            throw new Error(data.error || 'Failed to update course');
        }
    } catch (error) {
        console.error('Update course error:', error);
        showStatusMessage('courseStatus', error.message || 'Failed to update course', false);
    }
});

function showDeleteCourseModal(e) {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;
    
    const courseId = btn.dataset.id;
    const courseName = btn.dataset.name;
    
    if (!courseId || !courseName) {
        console.error('Missing course data:', { courseId, courseName });
        return;
    }
    
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(loadingOverlay);
    
    setTimeout(() => {
        try {
            currentDeletingCourseId = courseId;
            currentDeletingCourseName = courseName;
            const message = document.getElementById('deleteCourseMessage');
            message.textContent = `Are you sure you want to delete the department "${courseName}"?`;
            document.getElementById('deleteCourseStatus').classList.add('hidden');
            
            const modal = document.getElementById('deleteCourseModal');
            document.body.classList.add("modal-open");
            modal.style.display = "flex";
            modal.classList.remove('hidden');
        } catch (error) {
            console.error('Error showing delete modal:', error);
            showStatusMessage('courseStatus', 'Error loading course data', false);
        } finally {
            loadingOverlay.remove();
        }
    }, 300);
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteCourseModal');
    document.body.classList.remove("modal-open");
    modal.style.display = "none";
    modal.classList.add('hidden');
    document.removeEventListener('keydown', handleDeleteEscapeKey);
}

function handleDeleteEscapeKey(e) {
    if (e.key === 'Escape') {
        closeDeleteModal();
    }
}

document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        if (document.getElementById('deleteCourseModal').classList.contains('hidden')) {
            closeEditModal();
        } else {
            closeDeleteModal();
        }
    });
});

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!currentDeletingCourseId) return;
    
    closeDeleteModal();
    
    try {
        const response = await fetch(`${API_BASE_URL}/courses/${currentDeletingCourseId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatusMessage('courseStatus', 'Course deleted successfully', true);
            await loadAdminCourses();
            await loadCoursesForFilter();
        } else {
            throw new Error(data.error || 'Failed to delete course');
        }
    } catch (error) {
        console.error('Delete course error:', error);
        showStatusMessage('courseStatus', error.message || 'Failed to delete course', false);
    }
});

function confirmDeleteCourse(e) {
    showDeleteCourseModal(e);
}

document.getElementById('filterBtn').addEventListener('click', () => {
    currentAttendancePage = 1; 
    fetchAttendances();
});

async function fetchAttendances() {
    const date = document.getElementById('filterDate').value;
    const course = document.getElementById('filterCourse').value;
    
    try {
        let url = `${API_BASE_URL}/attendance/`;
        const params = new URLSearchParams();
        
        if (date) params.append('date', date);
        if (course) params.append('course', course);
        
        const queryString = params.toString();
        if (queryString) {
            url += `?${queryString}`;
        }
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const tbody = document.querySelector('#attendanceTable tbody');
            tbody.innerHTML = '';
            
            if (data.attendances.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="6" class="no-records">No attendance records found</td>';
                tbody.appendChild(row);
                updateAttendancePagination();
                return;
            }

            totalAttendancePages = Math.ceil(data.attendances.length / ITEMS_PER_PAGE);
            updateAttendancePagination();

            const startIndex = (currentAttendancePage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const currentPageItems = data.attendances.slice(startIndex, endIndex);
            
            currentPageItems.forEach(att => {
                const row = document.createElement('tr');
                const timeOut = att.timeOut ? new Date(att.timeOut).toLocaleTimeString() : 'N/A';
                
                if (timeOut === 'N/A') {
                    row.classList.add('present');
                } else {
                    row.classList.add('absent');
                }
                
                row.innerHTML = `
                    <td>${att.studentId}</td>
                    <td>${att.studentName}</td>
                    <td>${att.course}</td>
                    <td>${new Date(att.timeIn).toLocaleTimeString()}</td>
                    <td>${timeOut}</td>
                    <td>${new Date(att.date).toLocaleDateString()}</td>
                `;
                tbody.appendChild(row);
            });
        } else {
            throw new Error(data.error || 'Failed to fetch attendances');
        }
    } catch (error) {
        console.error('Fetch attendances error:', error);
        alertPopup('Failed to fetch attendance records');
    }
}

function updateAttendancePagination() {
    const prevBtn = document.getElementById('prevAttendancePage');
    const nextBtn = document.getElementById('nextAttendancePage');
    const pageInfo = document.getElementById('attendancePageInfo');

    prevBtn.disabled = currentAttendancePage === 1;
    nextBtn.disabled = currentAttendancePage === totalAttendancePages || totalAttendancePages === 0;
    pageInfo.textContent = totalAttendancePages > 0 ? `Page ${currentAttendancePage} of ${totalAttendancePages}` : 'No records';
}

document.getElementById('prevAttendancePage').addEventListener('click', () => {
    if (currentAttendancePage > 1) {
        currentAttendancePage--;
        fetchAttendances();
    }
});

document.getElementById('nextAttendancePage').addEventListener('click', () => {
    if (currentAttendancePage < totalAttendancePages) {
        currentAttendancePage++;
        fetchAttendances();
    }
});

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        if (tab.dataset.tab === 'course-management') {
            currentCoursePage = 1;
            loadAdminCourses();
        } else if (tab.dataset.tab === 'attendance-records') {
            currentAttendancePage = 1;
            fetchAttendances();
        }
    });
});

function showStatusMessage(elementId, message, isSuccess) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Status message element not found: ${elementId}`);
        return;
    }
    
    const displayMessage = typeof message === 'string' ? message : 'An error occurred';
    
    element.textContent = displayMessage;
    element.classList.remove('hidden', 'success-message', 'error-message');
    element.classList.add(isSuccess ? 'success-message' : 'error-message');
    
    setTimeout(() => {
        element.classList.add('hidden');
    }, 5000);
}

const togglePassword = document.querySelector('.toggle-password');
const passwordInput = document.getElementById('adminPassword');

togglePassword.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    const icon = this.querySelector('i');
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
});

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
        
        if (tab.dataset.tab !== 'verify' && window.scannerStream) {
            stopScanner();
        }
    });
});

function initializeTableDrag() {
    const tableContainer = document.querySelector('.table-container');
    let isDown = false;
    let startX;
    let scrollLeft;

    tableContainer.addEventListener('mousedown', (e) => {
        isDown = true;
        tableContainer.classList.add('grabbing');
        startX = e.pageX - tableContainer.offsetLeft;
        scrollLeft = tableContainer.scrollLeft;
    });

    tableContainer.addEventListener('mouseleave', () => {
        isDown = false;
        tableContainer.classList.remove('grabbing');
    });

    tableContainer.addEventListener('mouseup', () => {
        isDown = false;
        tableContainer.classList.remove('grabbing');
    });

    tableContainer.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - tableContainer.offsetLeft;
        const walk = (x - startX) * 2;
        tableContainer.scrollLeft = scrollLeft - walk;
    });

    tableContainer.addEventListener('touchstart', (e) => {
        isDown = true;
        tableContainer.classList.add('grabbing');
        startX = e.touches[0].pageX - tableContainer.offsetLeft;
        scrollLeft = tableContainer.scrollLeft;
    });

    tableContainer.addEventListener('touchend', () => {
        isDown = false;
        tableContainer.classList.remove('grabbing');
    });

    tableContainer.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.touches[0].pageX - tableContainer.offsetLeft;
        const walk = (x - startX) * 2;
        tableContainer.scrollLeft = scrollLeft - walk;
    });
}

let scannerActive = false;
document.getElementById('scanBtn').addEventListener('click', startScanner);
document.getElementById('stopScanBtn').addEventListener('click', stopScanner);
document.getElementById('newVerifyBtn').addEventListener('click', resetVerification);

async function verifyQRCode(encryptedData) {
    const course = document.getElementById('verifyCourse').value;
    
    if (!course) {
        alertPopup('Please select a department');
        return;
    }
    
    const verifyBtn = document.querySelector('.scan-btn');
    const originalBtnText = verifyBtn?.textContent;
    
    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/attendance/verify-qr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                encryptedData,
                courseName: course,
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.log(data);
            throw new Error(data.error || 'Verification failed');
        }

        const resultDiv = document.getElementById('verificationMessage');
        resultDiv.innerHTML = '';
        
        if (data.success) {
            const studentInfo = document.createElement('div');
            studentInfo.className = 'student-info';
            studentInfo.innerHTML = `
                <p><strong>UA ID:</strong> ${data.student.studentId}</p>
                <p><strong>Name:</strong> ${data.student.name}</p>
                <p><strong>Department:</strong> ${data.student.course}</p>
            `;
            resultDiv.appendChild(studentInfo);
            
            const timeInAndOutMessage = document.createElement('h3');
            timeInAndOutMessage.innerHTML = `${data.message}`;
            timeInAndOutMessage.className = data.action === 'time_in' ? 'success-message' : 'info-message';
            resultDiv.appendChild(timeInAndOutMessage);
            
            const timeIn = document.createElement('p');
            timeIn.innerHTML = `<strong>Time In:</strong> ${new Date(data.time_in).toLocaleString()}`;
            resultDiv.appendChild(timeIn);
            
            if (data.time_out) {
                const timeOut = document.createElement('p');
                timeOut.innerHTML = `<strong>Time Out:</strong> ${new Date(data.time_out).toLocaleString()}`;
                resultDiv.appendChild(timeOut);
            }
            
            const verifyTime = document.createElement('p');
            verifyTime.className = 'verify-time';
            verifyTime.innerHTML = `<em>Verified at: ${new Date().toLocaleString()}</em>`;
            resultDiv.appendChild(verifyTime);
        }
        
        document.getElementById('verificationResult').classList.remove('hidden');
        
    } catch (error) {
        console.error('Verification error:', error);
        const resultDiv = document.getElementById('verificationMessage');
        resultDiv.innerHTML = `
            <p class="error-message">${error.message}</p>
            <div class="verification-help">
                <p><strong>Possible solutions:</strong></p>
                <ul>
                    <li>Ensure you selected the correct department</li>
                    <li>Check that the encryption key is correct</li>
                    <li>Make sure the QR code hasn't been tampered with</li>
                    <li>Try scanning again in better lighting conditions</li>
                </ul>
            </div>
        `;
        document.getElementById('verificationResult').classList.remove('hidden');
    } finally {
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.textContent = originalBtnText;
        }
    }
}

// changed ------------------------------------------------------------------

function startScanner() {
    const course = document.getElementById('verifyCourse').value;
    if (!course) {
        alertPopup('Please select the department first');
        return;
    }
    
    document.getElementById('scanBtn').classList.add('hidden');
    document.getElementById('stopScanBtn').classList.remove('hidden');
    document.getElementById('scannerContainer').classList.remove('hidden');
    document.getElementById('verificationResult').classList.add('hidden');
    
    const video = document.getElementById('scanner');
    const cameraStatus = document.getElementById('cameraStatus');
    cameraStatus.textContent = 'Initializing camera...';
    cameraStatus.className = '';
    
    if (window.scannerStream) {
        window.scannerStream.getTracks().forEach(track => track.stop());
    }
    
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        } 
    })
    .then(stream => {
        window.scannerStream = stream;
        video.srcObject = stream;
        video.play();
        scannerActive = true;
        
        video.onplaying = () => {
            cameraStatus.textContent = 'Scanning for QR codes...';
            cameraStatus.className = 'scanning-status';
        };
        
        const canvasElement = document.createElement('canvas');
        const canvas = canvasElement.getContext('2d', { willReadFrequently: true });
        let lastScanTime = 0;
        
        function scanFrame() {
            if (!scannerActive) return;
            
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                const now = Date.now();
                if (now - lastScanTime < 300) {
                    requestAnimationFrame(scanFrame);
                    return;
                }
                lastScanTime = now;
                
                canvasElement.height = video.videoHeight;
                canvasElement.width = video.videoWidth;
                
                canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
                
                const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                    canOverwriteImage: false
                });
                
                if (code) {
                    cameraStatus.textContent = 'QR code detected!';
                    cameraStatus.className = 'success-message';
                    
                    setTimeout(() => {
                        verifyQRCode(code.data);
                        stopScanner();
                    }, 500);
                    return;
                }
            }
            requestAnimationFrame(scanFrame);
        }
        
        scanFrame();
    })
    .catch(err => {
        console.error('Camera error:', err);
        cameraStatus.textContent = 'Camera access denied or not available';
        cameraStatus.className = 'error-message';
        
        const helpText = document.createElement('p');
        helpText.className = 'camera-help';
        helpText.textContent = 'Please ensure camera permissions are granted and try again.';
        cameraStatus.appendChild(helpText);
        
        stopScanner();
    });
}

function stopScanner() {
    scannerActive = false;
    document.getElementById('scanBtn').classList.remove('hidden');
    document.getElementById('stopScanBtn').classList.add('hidden');
    document.getElementById('scannerContainer').classList.add('hidden');
    document.getElementById('cameraStatus').textContent = '';
    
    if (window.scannerStream) {
        window.scannerStream.getTracks().forEach(track => track.stop());
        window.scannerStream = null;
    }
}

// Clear attendance records
document.getElementById('clearAttendanceBtn').addEventListener('click', () => {
    const date = document.getElementById('filterDate').value;
    const course = document.getElementById('filterCourse').value;
    
    // Create confirmation message based on filters
    let message = 'Are you sure you want to clear ALL attendance records?';
    
    if (date || course) {
        message = 'Are you sure you want to clear attendance records for ';
        if (date) message += `date: ${date}`;
        if (date && course) message += ' and ';
        if (course) message += `department: ${course}`;
        message += '?';
    }
    
    // Create confirmation modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Confirm Clear Attendance</h2>
                <button class="close-modal">&times;</button>
            </div>
            <p>${message}</p>
            <p class="warning-text"><i class="fa-solid fa-triangle-exclamation"></i> This action cannot be undone!</p>
            <div class="modal-actions">
                <button id="confirmClearBtn" class="danger-btn">Clear Records</button>
                <button id="cancelClearBtn" class="primary-btn">Cancel</button>
            </div>
            <div id="clearStatus" class="status-message hidden"></div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.classList.add("modal-open");
    modal.style.display = "flex";
    
    // Close modal handlers
    const closeModal = () => {
        document.body.classList.remove("modal-open");
        modal.remove();
    };
    
    modal.querySelector('.close-modal').addEventListener('click', closeModal);
    modal.querySelector('#cancelClearBtn').addEventListener('click', closeModal);
    
    // Handle outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Handle clear confirmation
    modal.querySelector('#confirmClearBtn').addEventListener('click', async () => {
        const clearBtn = modal.querySelector('#confirmClearBtn');
        const originalText = clearBtn.innerHTML;
        clearBtn.disabled = true;
        clearBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Clearing...';
        
        const statusDiv = modal.querySelector('#clearStatus');
        
        try {
            const response = await fetch(`${API_BASE_URL}/attendance`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({
                    date: document.getElementById('filterDate').value,
                    course: document.getElementById('filterCourse').value
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                statusDiv.textContent = data.message || 'Attendance records cleared successfully';
                statusDiv.className = 'status-message success-message';
                
                // Refresh attendance records after a short delay
                setTimeout(() => {
                    fetchAttendances();
                    closeModal();
                }, 1500);
            } else {
                throw new Error(data.error || 'Failed to clear attendance records');
            }
        } catch (error) {
            console.error('Clear attendance error:', error);
            statusDiv.textContent = error.message;
            statusDiv.className = 'status-message error-message';
        } finally {
            clearBtn.disabled = false;
            clearBtn.innerHTML = originalText;
        }
    });
});

function resetVerification() {
    document.getElementById('verificationResult').classList.add('hidden');
    document.getElementById('verificationMessage').innerHTML = '';
    document.getElementById('verifyCourse').value = '';
}

document.getElementById('clearAttendanceBtn').addEventListener('click', () => {
    const date = document.getElementById('filterDate').value;
    const course = document.getElementById('filterCourse').value;
    
    let message = 'Are you sure you want to clear ALL attendance records?';
    
    if (date || course) {
        message = 'Are you sure you want to clear attendance records for ';
        if (date) message += `date: ${date}`;
        if (date && course) message += ' and ';
        if (course) message += `department: ${course}`;
        message += '?';
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Confirm Clear Attendance</h2>
                <button class="close-modal">&times;</button>
            </div>
            <p>${message}</p>
            <p class="warning-text"><i class="fa-solid fa-triangle-exclamation"></i> This action cannot be undone!</p>
            <div class="modal-actions">
                <button id="confirmClearBtn" class="danger-btn">Clear Records</button>
                <button id="cancelClearBtn" class="primary-btn">Cancel</button>
            </div>
            <div id="clearStatus" class="status-message hidden"></div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.classList.add("modal-open");
    modal.style.display = "flex";
    
    const closeModal = () => {
        document.body.classList.remove("modal-open");
        modal.remove();
    };
    
    modal.querySelector('.close-modal').addEventListener('click', closeModal);
    modal.querySelector('#cancelClearBtn').addEventListener('click', closeModal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    modal.querySelector('#confirmClearBtn').addEventListener('click', async () => {
        const clearBtn = modal.querySelector('#confirmClearBtn');
        const originalText = clearBtn.innerHTML;
        clearBtn.disabled = true;
        clearBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Clearing...';
        
        const statusDiv = modal.querySelector('#clearStatus');
        
        try {
            const response = await fetch(`${API_BASE_URL}/attendance`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({
                    date: document.getElementById('filterDate').value,
                    course: document.getElementById('filterCourse').value
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                statusDiv.textContent = data.message || 'Attendance records cleared successfully';
                statusDiv.className = 'status-message success-message';
                
                setTimeout(() => {
                    fetchAttendances();
                    closeModal();
                }, 1500);
            } else {
                throw new Error(data.error || 'Failed to clear attendance records');
            }
        } catch (error) {
            console.error('Clear attendance error:', error);
            statusDiv.textContent = error.message;
            statusDiv.className = 'status-message error-message';
        } finally {
            clearBtn.disabled = false;
            clearBtn.innerHTML = originalText;
        }
    });
});

document.getElementById('downloadPdfBtn').addEventListener('click', downloadAttendancePDF);

async function downloadAttendancePDF() {
    const date = document.getElementById('filterDate').value;
    const course = document.getElementById('filterCourse').value;
    
    try {
        const downloadBtn = document.getElementById('downloadPdfBtn');
        const originalText = downloadBtn.innerHTML;
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating PDF...';
        
        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (course) params.append('course', course);
        
        const response = await fetch(`${API_BASE_URL}/attendance/pdf?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate PDF');
        }
        
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        let filename = 'Attendance_Records.pdf';
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch) filename = filenameMatch[1];
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(url);
        a.remove();
        
    } catch (error) {
        console.error('PDF download error:', error);
        
        if (error.message.includes('No attendance records')) {
            const modal = document.getElementById('emptyRecordModal');
            modal.style.display = 'flex';
            document.body.classList.add("modal-open");
            
            document.getElementById('closeEmptyModalBtn').addEventListener('click', () => {
                modal.style.display = 'none';
                document.body.classList.remove("modal-open");
            }, { once: true });
        } else {
            alertPopup(error.message || 'Failed to download PDF');
        }
    } finally {
        const downloadBtn = document.getElementById('downloadPdfBtn');
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Download PDF';
        }
    }
}

const style = document.createElement('style');
style.textContent = `
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }
    
    .loading-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid #ffffff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
