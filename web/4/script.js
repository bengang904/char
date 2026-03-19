let pyodideWorker;
let pyodideReady = false;
const terminal = document.getElementById("terminal");
const runBtn = document.getElementById("run-btn");
const fileMenuItem = document.getElementById('file-menu-item');
const editMenuItem = document.getElementById('edit-menu-item');
const sidebarWrapper = document.querySelector('.sidebar-wrapper');
const editorContainer = document.querySelector('.editor-container');
const tabsBar = document.getElementById('tabs-bar');
const editorWrapper = document.getElementById('editor-wrapper');
const terminalWrapper = document.getElementById('terminal-wrapper');
const bodyElement = document.body;
const projectTree = document.getElementById('project-tree');

let currentDirectoryHandle = null;
let openedFiles = {};
let fileHandlesCache = {};
let activeFileId = null;
let fileCounter = 1;
let appClipboard = "";
const PACKAGES_TO_LOAD = ['numpy', 'scipy', 'pandas', 'matplotlib'];

const PYTHON_TEMPLATE = 'import numpy as np\nimport pandas as pd\n\ndef main():\n    print("你好，Pyodide!")\n    数据 = np.array([1, 2, 3, 4, 5])\n    print(f"数组内容: {数据}")\n    print(f"平均值: {np.mean(数据)}")\n\nif __name__ == "__main__":\n    main()';
const DEFAULT_TEMPLATE = '/* 新建文件 */\n\nconsole.log("你好，世界");';
const WELCOME_FILE_NAME = '使用说明.txt';
const WELCOME_CONTENT = `在线代码编辑器 v1.0\n\n1. Python 环境在后台 Worker 中加载。\n2. 手机端支持通过“打开文件”导入本地代码。\n3. iPhone 用户点击“导入文件夹”可进行多文件批量导入。\n4. 支持快捷键 Ctrl/Cmd + S 保存。`;
const WELCOME_FILE_ID = 'welcome_readme_doc';

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.style.display = 'none';
const folderInput = document.createElement('input');
folderInput.type = 'file';
folderInput.webkitdirectory = true;
folderInput.multiple = true;
folderInput.style.display = 'none';
document.body.appendChild(fileInput);
document.body.appendChild(folderInput);

const workerCode = `
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js");
    let pyodide;
    async function init() {
        try {
            self.postMessage({ type: 'log', data: "正在后台初始化 Python 环境..." });
            pyodide = await loadPyodide({
                stdout: (msg) => self.postMessage({ type: 'log', data: msg }),
                stderr: (msg) => self.postMessage({ type: 'log', data: msg })
            });
            self.postMessage({ type: 'log', data: "正在预加载科学计算库..." });
            await pyodide.loadPackage(${JSON.stringify(PACKAGES_TO_LOAD)});
            self.postMessage({ type: 'ready' });
        } catch (err) {
            self.postMessage({ type: 'error', data: err.message });
        }
    }
    self.onmessage = async (e) => {
        if (e.data.type === 'run') {
            try {
                await pyodide.runPythonAsync(e.data.code);
                self.postMessage({ type: 'done' });
            } catch (err) {
                self.postMessage({ type: 'error', data: err.message });
            }
        }
    };
    init();
`;

function logTerminal(message) {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0') + ":" + now.getSeconds().toString().padStart(2, '0');
    terminal.textContent += `[${timeStr}] ${message}\n`;
    terminal.scrollTop = terminal.scrollHeight;
}

function initWorker() {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    pyodideWorker = new Worker(URL.createObjectURL(blob));
    runBtn.disabled = true;
    pyodideWorker.onmessage = (e) => {
        const { type, data } = e.data;
        if (type === 'log') logTerminal(data);
        else if (type === 'ready') {
            pyodideReady = true;
            runBtn.disabled = false;
            logTerminal("系统状态: 已就绪");
        } else if (type === 'error') logTerminal("运行时错误: " + data);
        else if (type === 'done') logTerminal(">>> 执行完毕");
    };
}

function closeMenu() {
    fileMenuItem.classList.remove('menu-open');
    editMenuItem.classList.remove('menu-open');
}

function closeMenuAndExecute(callback) {
    closeMenu();
    if (typeof callback === 'function') callback();
}

function getActiveEditor() {
    return activeFileId ? openedFiles[activeFileId].editor : null;
}

function openWelcomeFile() {
    if (openedFiles[WELCOME_FILE_ID]) {
        switchTab(WELCOME_FILE_ID);
    } else {
        openFileInTab(WELCOME_FILE_NAME, WELCOME_CONTENT, null, WELCOME_FILE_ID);
    }
}

function openFileInTab(name, content, fileHandle = null, providedFileId = null) {
    const fileId = providedFileId || `file-${fileCounter++}`;
    if (openedFiles[fileId]) {
        switchTab(fileId);
        return;
    }

    const isPython = name.toLowerCase().endsWith('.py');
    const editorDiv = document.createElement('div');
    editorDiv.className = 'editor';
    editorDiv.id = `editor-${fileId}`;
    editorWrapper.appendChild(editorDiv);

    const editor = CodeMirror(editorDiv, {
        value: content,
        mode: isPython ? "python" : "text/plain",
        theme: "dracula",
        lineNumbers: true,
        dragDrop: false, 
        indentUnit: 4,
        tabSize: 4,
        matchBrackets: true,
        autoCloseBrackets: true,
        styleActiveLine: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        extraKeys: {
            "Ctrl-S": () => { saveActiveFile(); },
            "Cmd-S": () => { saveActiveFile(); },
            "Ctrl-/": "toggleComment",
            "Cmd-/": "toggleComment"
        }
    });

    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.id = `tab-${fileId}`;
    tab.innerHTML = `<span>${name}</span><span class="close-btn" data-file-id="${fileId}">&times;</span>`;
    tabsBar.appendChild(tab);

    openedFiles[fileId] = {
        name: name,
        editor: editor,
        fileHandle: fileHandle,
        tab: tab,
        isSaved: true
    };

    editor.on("change", () => {
        if (openedFiles[fileId].isSaved) {
            openedFiles[fileId].isSaved = false;
            tab.classList.add("unsaved");
        }
    });

    tab.onclick = (e) => {
        if (e.target.classList.contains('close-btn')) {
            closeTab(fileId);
        } else {
            switchTab(fileId);
        }
    };

    switchTab(fileId);
    return fileId;
}

function switchTab(fileId) {
    if (!openedFiles[fileId] || activeFileId === fileId) return;
    if (activeFileId && openedFiles[activeFileId]) {
        openedFiles[activeFileId].tab.classList.remove('active');
        const oldEditorDiv = document.getElementById(`editor-${activeFileId}`);
        if (oldEditorDiv) oldEditorDiv.classList.remove('active');
    }
    activeFileId = fileId;
    openedFiles[activeFileId].tab.classList.add('active');
    const newEditorDiv = document.getElementById(`editor-${activeFileId}`);
    if (newEditorDiv) {
        newEditorDiv.classList.add('active');
        openedFiles[activeFileId].editor.refresh();
        openedFiles[activeFileId].editor.focus();
    }
}

function closeTab(fileId) {
    if (!openedFiles[fileId]) return;
    if (!openedFiles[fileId].isSaved) {
        if (!confirm(`文件 ${openedFiles[fileId].name} 尚未保存，确定要关闭吗？`)) return;
    }
    openedFiles[fileId].tab.remove();
    const div = document.getElementById(`editor-${fileId}`);
    if (div) div.remove();
    delete openedFiles[fileId];
    if (activeFileId === fileId) {
        activeFileId = null;
        const keys = Object.keys(openedFiles);
        if (keys.length > 0) switchTab(keys[keys.length - 1]);
    }
}

async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
    }
}

document.getElementById('undo-btn').onclick = (e) => { e.stopPropagation(); closeMenuAndExecute(() => getActiveEditor()?.undo()); };
document.getElementById('redo-btn').onclick = (e) => { e.stopPropagation(); closeMenuAndExecute(() => getActiveEditor()?.redo()); };
document.getElementById('select-all-btn').onclick = (e) => { 
    e.stopPropagation(); 
    closeMenuAndExecute(() => {
        const ed = getActiveEditor();
        if (ed) {
            ed.execCommand("selectAll");
            ed.focus(); 
        }
    }); 
};
document.getElementById('copy-btn').onclick = (e) => { e.stopPropagation(); closeMenuAndExecute(() => {
    const selected = getActiveEditor()?.getSelection();
    if (selected) {
        appClipboard = selected;
        copyToClipboard(selected);
    }
})};
document.getElementById('cut-btn').onclick = (e) => { e.stopPropagation(); closeMenuAndExecute(() => {
    const ed = getActiveEditor();
    if (ed) {
        appClipboard = ed.getSelection();
        if (appClipboard) {
            copyToClipboard(appClipboard);
            ed.replaceSelection("");
            ed.focus();
        }
    }
})};
document.getElementById('paste-btn').onclick = (e) => { e.stopPropagation(); closeMenuAndExecute(async () => {
    const ed = getActiveEditor();
    if (ed) {
        try {
            const text = await navigator.clipboard.readText();
            ed.replaceSelection(text || appClipboard);
        } catch (err) {
            ed.replaceSelection(appClipboard);
        }
        ed.focus();
    }
})};

document.getElementById('new-file-btn').onclick = (e) => { e.stopPropagation(); closeMenuAndExecute(() => {
    let name = prompt("请输入文件名:", "新建脚本.py");
    if (name && name.trim() !== "") {
        const template = name.endsWith('.py') ? PYTHON_TEMPLATE : DEFAULT_TEMPLATE;
        openFileInTab(name.trim(), template);
    }
})};

document.getElementById('open-file-btn').onclick = (e) => { e.stopPropagation(); closeMenuAndExecute(async () => {
    if (window.showOpenFilePicker) {
        try {
            const [handle] = await window.showOpenFilePicker();
            const file = await handle.getFile();
            const content = await file.text();
            openFileInTab(file.name, content, handle);
        } catch (err) {}
    } else {
        fileInput.onchange = async (ev) => {
            const file = ev.target.files[0];
            if (file) {
                const content = await file.text();
                openFileInTab(file.name, content);
            }
        };
        fileInput.click();
    }
})};

async function saveActiveFile() {
    const f = openedFiles[activeFileId];
    if (!f) return;
    try {
        if (f.fileHandle && f.fileHandle.createWritable) {
            const writable = await f.fileHandle.createWritable();
            await writable.write(f.editor.getValue());
            await writable.close();
            f.isSaved = true;
            f.tab.classList.remove("unsaved");
            logTerminal(`已保存: ${f.name}`);
        } else {
            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({ suggestedName: f.name });
                const writable = await handle.createWritable();
                await writable.write(f.editor.getValue());
                await writable.close();
                f.fileHandle = handle;
                f.name = handle.name;
                f.tab.querySelector('span').textContent = handle.name;
                f.isSaved = true;
                f.tab.classList.remove("unsaved");
            } else {
                const blob = new Blob([f.editor.getValue()], {type: "text/plain"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = f.name;
                a.click();
                URL.revokeObjectURL(url);
                f.isSaved = true;
                f.tab.classList.remove("unsaved");
                logTerminal(`已导出文件: ${f.name}`);
            }
        }
    } catch (e) {
        logTerminal("保存失败: " + e.message);
    }
}

document.getElementById('save-file-btn').onclick = (e) => { e.stopPropagation(); closeMenuAndExecute(saveActiveFile); };
document.getElementById('save-as-btn').onclick = (e) => { e.stopPropagation(); closeMenuAndExecute(async () => {
    const f = openedFiles[activeFileId];
    if (!f) return;
    f.fileHandle = null;
    await saveActiveFile();
})};

runBtn.onclick = (e) => {
    e.stopPropagation();
    const editor = getActiveEditor();
    if (editor && pyodideReady) {
        logTerminal("正在运行脚本...");
        pyodideWorker.postMessage({ type: 'run', code: editor.getValue() });
    } else if (!pyodideReady) {
        logTerminal("请等待 Python 环境就绪...");
    }
};

async function renderProjectTree(handle, parentElement, path) {
    parentElement.innerHTML = '';
    const entries = [];
    for await (const entry of handle.values()) entries.push(entry);
    entries.sort((a, b) => (a.kind === 'directory' ? -1 : 1) || a.name.localeCompare(b.name));

    for (const entry of entries) {
        const fullPath = path + '/' + entry.name;
        fileHandlesCache[fullPath] = entry;
        const li = document.createElement('li');
        li.setAttribute('data-path', fullPath);
        if (entry.kind === 'file') {
            li.className = 'icon-file';
            li.textContent = entry.name;
            li.onclick = async (e) => {
                e.stopPropagation();
                const file = await entry.getFile();
                const content = await file.text();
                openFileInTab(file.name, content, entry);
            };
        } else {
            li.className = 'icon-folder';
            li.innerHTML = `<div class="folder-title"><span class="folder-toggle"></span>${entry.name}</div><ul class="folder-content"></ul>`;
            li.onclick = async (e) => {
                e.stopPropagation();
                const isOpen = li.classList.toggle('folder-open');
                const ul = li.querySelector('.folder-content');
                if (isOpen && ul.children.length === 0) await renderProjectTree(entry, ul, fullPath);
            };
        }
        parentElement.appendChild(li);
    }
}

document.getElementById('import-folder-btn').onclick = (e) => { e.stopPropagation(); closeMenuAndExecute(async () => {
    if (window.showDirectoryPicker) {
        try {
            currentDirectoryHandle = await window.showDirectoryPicker();
            fileHandlesCache = { [currentDirectoryHandle.name]: currentDirectoryHandle };
            await renderProjectTree(currentDirectoryHandle, projectTree, currentDirectoryHandle.name);
        } catch (err) {}
    } else {
        folderInput.onchange = async (ev) => {
            const files = Array.from(ev.target.files);
            if (files.length === 0) return;
            projectTree.innerHTML = '';
            const rootLi = document.createElement('li');
            rootLi.className = 'icon-folder folder-open';
            rootLi.innerHTML = `<div class="folder-title"><span class="folder-toggle"></span>已导入文件 (${files.length})</div><ul class="folder-content" style="display:block"></ul>`;
            const ul = rootLi.querySelector('.folder-content');
            files.forEach(file => {
                const li = document.createElement('li');
                li.className = 'icon-file';
                li.textContent = file.name;
                li.onclick = async (event) => {
                    event.stopPropagation();
                    const content = await file.text();
                    openFileInTab(file.name, content);
                };
                ul.appendChild(li);
            });
            projectTree.appendChild(rootLi);
        };
        folderInput.click();
    }
})};

const handleMenuClick = (e, current, other) => {
    e.stopPropagation();
    other.classList.remove('menu-open');
    if (e.target.tagName === 'SPAN' || e.target === current) {
        current.classList.toggle('menu-open');
    }
};

fileMenuItem.onclick = (e) => handleMenuClick(e, fileMenuItem, editMenuItem);
editMenuItem.onclick = (e) => handleMenuClick(e, editMenuItem, fileMenuItem);

document.querySelectorAll('.submenu').forEach(sub => {
    sub.onclick = (e) => e.stopPropagation();
});

const globalClose = (e) => {
    if (!fileMenuItem.contains(e.target) && !editMenuItem.contains(e.target)) {
        closeMenu();
    }
};
document.addEventListener('click', globalClose);
document.addEventListener('touchstart', globalClose, { passive: true });
bodyElement.ondragover = (e) => {
    e.preventDefault(); 
};

bodyElement.ondrop = async (e) => {
    e.preventDefault();
    e.stopPropagation(); 
    const items = e.dataTransfer.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
            const file = items[i].getAsFile();
            if (file) {
                const content = await file.text();
                openFileInTab(file.name, content);
            }
        }
    }
};

document.onkeydown = (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveActiveFile();
    }
};

initWorker();
openWelcomeFile();
