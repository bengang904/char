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
const WELCOME_CONTENT = `在线代码编辑器 v1.0\n\n1. Python 环境在后台 Worker 中加载，不卡顿界面。\n2. 使用“编辑”菜单进行 查找/替换/全选 等操作。\n3. 直接将本地文件拖入此处即可打开编辑。\n4. 支持 Ctrl+S 快速保存。`;
const WELCOME_FILE_ID = 'welcome_readme_doc';

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
        indentUnit: 4,
        tabSize: 4,
        matchBrackets: true,
        autoCloseBrackets: true,
        styleActiveLine: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        extraKeys: {
            "Ctrl-Space": "autocomplete",
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
        if (!confirm(`文件 ${openedFiles[fileId].name} 尚未保存，确定要关闭吗？`)) {
            return;
        }
    }

    openedFiles[fileId].tab.remove();
    const div = document.getElementById(`editor-${fileId}`);
    if (div) div.remove();

    delete openedFiles[fileId];

    if (activeFileId === fileId) {
        activeFileId = null;
        const keys = Object.keys(openedFiles);
        if (keys.length > 0) {
            switchTab(keys[keys.length - 1]);
        }
    }
}

document.getElementById('undo-btn').onclick = () => closeMenuAndExecute(() => getActiveEditor()?.undo());
document.getElementById('redo-btn').onclick = () => closeMenuAndExecute(() => getActiveEditor()?.redo());
document.getElementById('select-all-btn').onclick = () => closeMenuAndExecute(() => getActiveEditor()?.execCommand("selectAll"));
document.getElementById('copy-btn').onclick = () => closeMenuAndExecute(() => {
    const selected = getActiveEditor()?.getSelection();
    if (selected) {
        appClipboard = selected;
        navigator.clipboard.writeText(selected).catch(() => {});
    }
});
document.getElementById('cut-btn').onclick = () => closeMenuAndExecute(() => {
    const ed = getActiveEditor();
    if (ed) {
        appClipboard = ed.getSelection();
        ed.replaceSelection("");
        navigator.clipboard.writeText(appClipboard).catch(() => {});
    }
});
document.getElementById('paste-btn').onclick = () => closeMenuAndExecute(async () => {
    const ed = getActiveEditor();
    if (ed) {
        try {
            const text = await navigator.clipboard.readText();
            ed.replaceSelection(text || appClipboard);
        } catch (e) {
            ed.replaceSelection(appClipboard);
        }
    }
});
document.getElementById('find-btn').onclick = () => closeMenuAndExecute(() => getActiveEditor()?.execCommand("findPersistent"));
document.getElementById('replace-btn').onclick = () => closeMenuAndExecute(() => getActiveEditor()?.execCommand("replace"));

document.getElementById('new-file-btn').onclick = () => closeMenuAndExecute(() => {
    let name = prompt("请输入文件名（例如 script.py）:", "新建脚本.py");
    if (name && name.trim() !== "") {
        const template = name.endsWith('.py') ? PYTHON_TEMPLATE : DEFAULT_TEMPLATE;
        openFileInTab(name.trim(), template);
    }
});

document.getElementById('open-file-btn').onclick = () => closeMenuAndExecute(async () => {
    try {
        const [handle] = await window.showOpenFilePicker();
        const file = await handle.getFile();
        const content = await file.text();
        openFileInTab(file.name, content, handle);
    } catch (e) {}
});

async function saveActiveFile() {
    const f = openedFiles[activeFileId];
    if (!f) return;

    try {
        if (f.fileHandle) {
            const writable = await f.fileHandle.createWritable();
            await writable.write(f.editor.getValue());
            await writable.close();
            f.isSaved = true;
            f.tab.classList.remove("unsaved");
            logTerminal(`已保存: ${f.name}`);
        } else {
            const handle = await window.showSaveFilePicker({
                suggestedName: f.name
            });
            const writable = await handle.createWritable();
            await writable.write(f.editor.getValue());
            await writable.close();
            f.fileHandle = handle;
            f.name = handle.name;
            f.tab.querySelector('span').textContent = handle.name;
            f.isSaved = true;
            f.tab.classList.remove("unsaved");
            logTerminal(`已保存至: ${f.name}`);
        }
    } catch (e) {
        logTerminal("保存失败: " + e.message);
    }
}

document.getElementById('save-file-btn').onclick = () => closeMenuAndExecute(saveActiveFile);
document.getElementById('save-as-btn').onclick = () => closeMenuAndExecute(async () => {
    const f = openedFiles[activeFileId];
    if (!f) return;
    f.fileHandle = null;
    await saveActiveFile();
});

runBtn.onclick = () => {
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
    for await (const entry of handle.values()) {
        entries.push(entry);
    }
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
                if (isOpen && ul.children.length === 0) {
                    await renderProjectTree(entry, ul, fullPath);
                }
            };
        }
        parentElement.appendChild(li);
    }
}

document.getElementById('import-folder-btn').onclick = () => closeMenuAndExecute(async () => {
    try {
        currentDirectoryHandle = await window.showDirectoryPicker();
        fileHandlesCache = { [currentDirectoryHandle.name]: currentDirectoryHandle };
        await renderProjectTree(currentDirectoryHandle, projectTree, currentDirectoryHandle.name);
    } catch (e) {}
});

fileMenuItem.onclick = (e) => {
    e.stopPropagation();
    editMenuItem.classList.remove('menu-open');
    if (e.target.tagName === 'SPAN' || e.target === fileMenuItem) {
        fileMenuItem.classList.toggle('menu-open');
    }
};

editMenuItem.onclick = (e) => {
    e.stopPropagation();
    fileMenuItem.classList.remove('menu-open');
    if (e.target.tagName === 'SPAN' || e.target === editMenuItem) {
        editMenuItem.classList.toggle('menu-open');
    }
};

document.addEventListener('click', closeMenu);

bodyElement.ondragover = (e) => {
    e.preventDefault();
    bodyElement.classList.add('drag-over');
};

bodyElement.ondragleave = (e) => {
    if (e.target === bodyElement) bodyElement.classList.remove('drag-over');
};

bodyElement.ondrop = async (e) => {
    e.preventDefault();
    bodyElement.classList.remove('drag-over');
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

const sidebarResizer = document.getElementById('sidebar-resizer');
sidebarResizer.onmousedown = (e) => {
    const startX = e.clientX;
    const startWidth = sidebarWrapper.offsetWidth;
    const move = (ev) => {
        const delta = ev.clientX - startX;
        sidebarWrapper.style.width = Math.max(150, startWidth + delta) + 'px';
        getActiveEditor()?.refresh();
    };
    const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.body.classList.remove('no-select');
    };
    document.body.classList.add('no-select');
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
};

const terminalResizer = document.getElementById('terminal-resizer');
terminalResizer.onmousedown = (e) => {
    const startY = e.clientY;
    const startHeight = terminalWrapper.offsetHeight;
    const move = (ev) => {
        const delta = ev.clientY - startY;
        terminalWrapper.style.height = Math.max(100, startHeight - delta) + 'px';
        getActiveEditor()?.refresh();
    };
    const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.body.classList.remove('no-select');
    };
    document.body.classList.add('no-select');
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
};

window.onresize = () => {
    getActiveEditor()?.refresh();
};

initWorker();
openWelcomeFile();

function heartbeat() {
    if (activeFileId && openedFiles[activeFileId]) {
        openedFiles[activeFileId].editor.refresh();
    }
}
setInterval(heartbeat, 5000);

for(let i=0; i<120; i++) {
    const dummy = i * 1;
}

logTerminal("就绪");