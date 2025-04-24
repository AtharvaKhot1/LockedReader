document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const pdfInput = document.getElementById('pdfInput');
    const pdfViewer = document.getElementById('pdfViewer');
    const pdfPages = document.getElementById('pdfPages');
    const focusTimeBtn = document.getElementById('focusTimeBtn');
    const startSessionBtn = document.getElementById('startSessionBtn');
    const timerModal = document.getElementById('timerModal');
    const confirmTimeBtn = document.getElementById('confirmTime');
    const focusMinutes = document.getElementById('focusMinutes');
    const timerMinutes = document.getElementById('timerMinutes');
    const timerSeconds = document.getElementById('timerSeconds');
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    const appContainer = document.querySelector('.app-container');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const currentPageSpan = document.getElementById('currentPage');
    const totalPagesSpan = document.getElementById('totalPages');

    // PDF variables
    let currentPdf = null;
    let currentPage = 1;
    let totalPages = 0;
    let isTimeSet = false;
    let currentScale = 1;

    // Timer variables
    let timerInterval;
    let minutes = 25;
    let seconds = 0;
    let isTimerRunning = false;
    let isFocusMode = false;

    // Add new variables for focus tracking
    let isSessionActive = false;
    let focusWarningTimeout;

    // PDF.js worker
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // Time Selection Handler
    focusMinutes.addEventListener('change', (e) => {
        const value = parseInt(e.target.value);
        if (value < 1) e.target.value = 1;
        if (value > 120) e.target.value = 120;
        minutes = parseInt(e.target.value);
        updateTimerDisplay();
    });

    focusTimeBtn.addEventListener('click', () => {
        timerModal.style.display = 'block';
    });

    confirmTimeBtn.addEventListener('click', () => {
        minutes = parseInt(focusMinutes.value);
        updateTimerDisplay();
        timerModal.style.display = 'none';
        isTimeSet = true;
        updateStartSessionButton();
        showNotification(`Timer set for ${minutes} minutes`);
    });

    // PDF File Input Handler
    pdfInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                currentPdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                totalPages = currentPdf.numPages;
                totalPagesSpan.textContent = totalPages;
                currentPage = 1;
                currentPageSpan.textContent = currentPage;
                
                showNotification('PDF loaded successfully');
                updateStartSessionButton();
            } catch (error) {
                showNotification('Error loading PDF', true);
                console.error('PDF loading error:', error);
            }
        }
    });

    function updateStartSessionButton() {
        startSessionBtn.disabled = !(isTimeSet && currentPdf);
    }

    startSessionBtn.addEventListener('click', async () => {
        if (isTimeSet && currentPdf) {
            if (!document.fullscreenElement) {
                try {
                    await document.documentElement.requestFullscreen();
                    // Add fullscreen change listener
                    document.addEventListener('fullscreenchange', handleFullscreenChange);
                } catch (err) {
                    showNotification('Fullscreen is required for focus mode', true);
                    return;
                }
            }
            
            const page = await currentPdf.getPage(currentPage);
            const viewport = page.getViewport({ scale: 1 });
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            currentScale = Math.min(windowWidth / viewport.width, windowHeight / viewport.height) * 0.98;
            
            await renderPage(currentPage);
            enterFocusMode();
        }
    });

    // Page Navigation Functions
    async function renderPage(pageNumber) {
        if (!currentPdf || pageNumber < 1 || pageNumber > totalPages) return;
        
        try {
            const page = await currentPdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: currentScale });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            pdfPages.innerHTML = '';
            await page.render(renderContext).promise;
            
            canvas.style.display = 'block';
            canvas.style.margin = 'auto';
            
            pdfPages.appendChild(canvas);
            currentPage = pageNumber;
            currentPageSpan.textContent = currentPage;
            
            // Update button states
            prevPageBtn.disabled = currentPage === 1;
            nextPageBtn.disabled = currentPage === totalPages;
        } catch (error) {
            console.error('Error rendering page:', error);
        }
    }

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            renderPage(currentPage - 1);
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            renderPage(currentPage + 1);
        }
    });

    // Timer Functions
    function updateTimerDisplay() {
        timerMinutes.textContent = minutes.toString().padStart(2, '0');
        timerSeconds.textContent = seconds.toString().padStart(2, '0');
    }

    function startTimerFunction() {
        if (!isTimerRunning) {
            isTimerRunning = true;
            timerInterval = setInterval(() => {
                if (seconds === 0) {
                    if (minutes === 0) {
                        clearInterval(timerInterval);
                        showNotification('Focus session completed!');
                        isTimerRunning = false;
                        exitFocusMode();
                        return;
                    }
                    minutes--;
                    seconds = 59;
                } else {
                    seconds--;
                }
                updateTimerDisplay();
            }, 1000);
        }
    }

    // Handle fullscreen changes
    function handleFullscreenChange() {
        if (isSessionActive && !document.fullscreenElement) {
            showNotification('Fullscreen is required for focus mode', true);
            // Try to re-enter fullscreen
            document.documentElement.requestFullscreen().catch(() => {
                // If we can't re-enter fullscreen, show a warning
                showNotification('Please maintain fullscreen for focus mode', true);
            });
        }
    }

    function enterFocusMode() {
        isFocusMode = true;
        isSessionActive = true;
        appContainer.classList.add('focus-mode');
        pdfViewer.style.display = 'block';
        startTimerFunction();
        showNotification('Focus session started - Stay in this tab');
    }

    function exitFocusMode() {
        isFocusMode = false;
        isSessionActive = false;
        appContainer.classList.remove('focus-mode');
        pdfViewer.style.display = 'none';
        clearInterval(timerInterval);
        isTimerRunning = false;
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === timerModal) {
            timerModal.style.display = 'none';
        }
    });

    // Handle escape key to exit focus mode
    document.addEventListener('keydown', (e) => {
        if (isSessionActive && e.key === 'Escape') {
            e.preventDefault();
            showExitConfirmation();
        }
    });

    // Notification Function
    function showNotification(message, isError = false) {
        notificationText.textContent = message;
        notification.style.display = 'block';
        notification.style.backgroundColor = isError ? 'rgba(255, 59, 48, 0.7)' : 'var(--glass-bg)';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    // Service Worker Registration for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful');
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }

    // Prevent closing/reloading during session
    window.addEventListener('beforeunload', (e) => {
        if (isSessionActive) {
            e.preventDefault();
            e.returnValue = 'Your focus session is still active. Are you sure you want to leave?';
            return e.returnValue;
        }
    });

    // Handle visibility change (tab switching)
    document.addEventListener('visibilitychange', () => {
        if (isSessionActive && document.hidden) {
            showNotification('Focus lost! Return to the tab to continue your session.', true);
            // Clear any existing timeout
            if (focusWarningTimeout) clearTimeout(focusWarningTimeout);
            
            // Set a new timeout to check if user hasn't returned
            focusWarningTimeout = setTimeout(() => {
                if (document.hidden) {
                    showNotification('Session paused due to inactivity', true);
                    pauseTimer();
                }
            }, 5000); // Wait 5 seconds before pausing
        } else if (isSessionActive && !document.hidden) {
            // User returned to the tab
            if (focusWarningTimeout) {
                clearTimeout(focusWarningTimeout);
                focusWarningTimeout = null;
            }
            showNotification('Focus resumed!');
            resumeTimer();
        }
    });

    // Timer control functions
    function pauseTimer() {
        if (isTimerRunning) {
            clearInterval(timerInterval);
            isTimerRunning = false;
        }
    }

    function resumeTimer() {
        if (!isTimerRunning && isSessionActive) {
            startTimerFunction();
        }
    }

    // Add new modal for exit confirmation
    const exitConfirmationHTML = `
        <div id="exitConfirmModal" class="modal">
            <div class="modal-content glass-panel">
                <h2>Exit Focus Mode?</h2>
                <p>Are you sure you want to exit focus mode? Your session will end.</p>
                <div class="modal-controls">
                    <button id="confirmExit" class="glass-button">Yes, Exit</button>
                    <button id="cancelExit" class="glass-button">Continue Session</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', exitConfirmationHTML);

    const exitConfirmModal = document.getElementById('exitConfirmModal');
    const confirmExitBtn = document.getElementById('confirmExit');
    const cancelExitBtn = document.getElementById('cancelExit');

    // Show exit confirmation
    function showExitConfirmation() {
        exitConfirmModal.style.display = 'block';
        // Pause timer while showing confirmation
        pauseTimer();
    }

    // Handle exit confirmation buttons
    confirmExitBtn.addEventListener('click', () => {
        exitConfirmModal.style.display = 'none';
        exitFocusMode();
    });

    cancelExitBtn.addEventListener('click', () => {
        exitConfirmModal.style.display = 'none';
        resumeTimer();
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === exitConfirmModal) {
            exitConfirmModal.style.display = 'none';
            resumeTimer();
        }
    });
}); 