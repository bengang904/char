document.addEventListener('DOMContentLoaded', () => {
    const isMobile = () => window.innerWidth <= 768;
    const topBar = document.querySelector('.topbar');
    const sidebar = document.querySelector('.sidebar-wrapper');
    const terminalWrapper = document.getElementById('terminal-wrapper');
    const terminalResizer = document.getElementById('terminal-resizer');

    if (!document.querySelector('.mobile-menu-toggle')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'mobile-menu-toggle';
        toggleBtn.setAttribute('aria-label', '切换菜单');
        toggleBtn.innerHTML = '<div class="hamburger-icon"></div>';
        topBar.prepend(toggleBtn);

        toggleBtn.addEventListener('click', (e) => {
            sidebar.classList.toggle('mobile-open');
            e.stopPropagation();
            if (typeof logTerminal === 'function' && sidebar.classList.contains('mobile-open')) {
                logTerminal("移动端侧边栏已展开");
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (isMobile() && !sidebar.contains(e.target) && !e.target.closest('.mobile-menu-toggle')) {
            sidebar.classList.remove('mobile-open');
        }
    });

    let startY = 0;
    let startH = 0;
    let isDragging = false;

    const onTouchMove = (e) => {
        if (!isDragging || !isMobile()) return;
        
        const touch = e.touches[0];
        const delta = startY - touch.clientY;
        const newHeight = startH + delta;
        
        const maxHeight = window.innerHeight * 0.8;
        const minHeight = 35;

        if (newHeight >= minHeight && newHeight <= maxHeight) {
            terminalWrapper.style.height = `${newHeight}px`;
            const editor = typeof getActiveEditor === 'function' ? getActiveEditor() : null;
            if (editor) editor.refresh();
        }
    };

    const onTouchEnd = () => {
        isDragging = false;
        document.body.style.userSelect = '';
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
    };

    terminalResizer.addEventListener('touchstart', (e) => {
        if (!isMobile()) return;
        isDragging = true;
        startY = e.touches[0].clientY;
        startH = terminalWrapper.offsetHeight;
        document.body.style.userSelect = 'none';
        
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
        
        if (e.cancelable) e.preventDefault();
    }, { passive: false });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            if (isMobile()) {
                const editor = typeof getActiveEditor === 'function' ? getActiveEditor() : null;
                if (editor) {
                    setTimeout(() => {
                        editor.refresh();
                        const activeCursor = editor.getDoc().getCursor();
                        editor.scrollIntoView(activeCursor);
                    }, 200);
                }
            }
        });
    }

    const subLinks = document.querySelectorAll('.submenu a, .menu-item li');
    subLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (isMobile()) {
                if (typeof closeMenu === 'function') closeMenu();
                sidebar.classList.remove('mobile-open');
            }
        });
    });

    terminalResizer.addEventListener('dblclick', () => {
        if (!isMobile()) return;
        const currentH = terminalWrapper.offsetHeight;
        if (currentH > 50) {
            terminalWrapper.style.height = '35px';
            if (typeof logTerminal === 'function') logTerminal("终端已收起");
        } else {
            terminalWrapper.style.height = '40vh';
            if (typeof logTerminal === 'function') logTerminal("终端已展开");
        }
        const editor = typeof getActiveEditor === 'function' ? getActiveEditor() : null;
        if (editor) setTimeout(() => editor.refresh(), 50);
    });

    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            const editor = typeof getActiveEditor === 'function' ? getActiveEditor() : null;
            if (editor) editor.refresh();
        }, 300);
    });
});