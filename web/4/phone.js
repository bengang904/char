document.addEventListener('DOMContentLoaded', () => {
    const isMobile = () => window.innerWidth <= 768;
    const topBar = document.querySelector('.topbar');
    const sidebar = document.querySelector('.sidebar-wrapper');
    const terminalWrapper = document.getElementById('terminal-wrapper');
    const terminalResizer = document.getElementById('terminal-resizer');

    if (!document.querySelector('.mobile-menu-toggle')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'mobile-menu-toggle';
        toggleBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>';
        topBar.prepend(toggleBtn);
        toggleBtn.addEventListener('click', (e) => {
            sidebar.classList.add('mobile-open');
            e.stopPropagation();
        });
    }

    if (!document.querySelector('.sidebar-close-btn')) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'sidebar-close-btn';
        closeBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
        sidebar.appendChild(closeBtn);
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
        });
    }

    document.addEventListener('mousedown', (e) => {
        if (!isMobile()) return;
        const isUI = e.target.closest('.topbar') || 
                     e.target.closest('.sidebar-wrapper') || 
                     e.target.closest('.terminal-resizer') ||
                     e.target.closest('.CodeMirror-dialog');
        if (isUI) e.preventDefault();
        if (sidebar.classList.contains('mobile-open') && !sidebar.contains(e.target) && !e.target.closest('.mobile-menu-toggle')) {
            sidebar.classList.remove('mobile-open');
        }
    });

    let startY = 0, startH = 0, isDragging = false;
    const onTouchMove = (e) => {
        if (!isDragging || !isMobile()) return;
        const delta = startY - e.touches[0].clientY;
        const newHeight = startH + delta;
        const vh = window.innerHeight;
        if (newHeight >= 35 && newHeight <= vh * 0.7) {
            terminalWrapper.style.height = `${newHeight}px`;
            const editor = typeof getActiveEditor === 'function' ? getActiveEditor() : null;
            if (editor) editor.refresh();
        }
    };

    const onTouchEnd = () => {
        isDragging = false;
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
    };

    terminalResizer.addEventListener('touchstart', (e) => {
        if (!isMobile()) return;
        isDragging = true;
        startY = e.touches[0].clientY;
        startH = terminalWrapper.offsetHeight;
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
        if (e.cancelable) e.preventDefault();
    }, { passive: false });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            if (!isMobile()) return;
            const editor = typeof getActiveEditor === 'function' ? getActiveEditor() : null;
            if (editor) {
                editor.refresh();
                if (document.activeElement.closest('.CodeMirror')) {
                    editor.scrollIntoView(editor.getDoc().getCursor());
                }
            }
        });
    }

    const subLinks = document.querySelectorAll('.submenu a, .project-structure li');
    subLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (isMobile() && !e.target.closest('.folder-toggle')) {
                sidebar.classList.remove('mobile-open');
            }
        });
    });

    terminalResizer.addEventListener('dblclick', () => {
        if (!isMobile()) return;
        terminalWrapper.style.height = terminalWrapper.offsetHeight > 50 ? '35px' : '40vh';
        const editor = typeof getActiveEditor === 'function' ? getActiveEditor() : null;
        if (editor) editor.refresh();
    });
});
