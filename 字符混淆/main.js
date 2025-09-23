function stringToBinary(input_string) {
    return Array.from(input_string).map(char => char.charCodeAt(0).toString(2)).join(' ');
}
function binaryToString(binary_string) {
    return binary_string.split(' ').map(bin => String.fromCharCode(parseInt(bin, 2))).join('');
}
function encryptText() {
    const inputText = document.getElementById("inputText").value;
    // 检查文本输入框是否为空
    if (!inputText.trim()) {
        alert("文本输入框不能为空！");
        return;
    }
    const binaryString = stringToBinary(inputText);
    const zeroWidth1 = '\u2060';
    const zeroWidth0 = '\u200C';
    const encryptedText = binaryString.replace(/1/g, zeroWidth1).replace(/0/g, zeroWidth0);
    document.getElementById("outputText").value = encryptedText;
    // 在页面上打印提示信息
    const copyMessageElement = document.getElementById("copyMessage");
    copyMessageElement.textContent = "已执行！可复制隐藏文本";
}
function decryptText() {
    const encryptedText = document.getElementById("inputText").value;
    // 检查文本输入框是否为空
    if (!encryptedText.trim()) {
        alert("文本输入框不能为空！");
        return;
    }
    const zeroWidth1 = '\u2060';
    const zeroWidth0 = '\u200C';
    const binaryString = encryptedText.replace(new RegExp(zeroWidth1, 'g'), '1').replace(new RegExp(zeroWidth0, 'g'), '0');
    const decryptedText = binaryToString(binaryString);
    document.getElementById("outputText").value = decryptedText;
}
function clearInput() {
    document.getElementById("inputText").value = "";
}
function copyToClipboard() {
    const outputText = document.getElementById("outputText");
    // 检查输出文本框是否为空
    if (!outputText.value.trim()) {
        alert("未执行！请点击加密或解密");
        return;
    }
    outputText.select();
    document.execCommand("copy");
    // 显示复制成功的提示消息
    const copyMessageElement = document.getElementById("copyMessage");
    copyMessageElement.textContent = "已复制到剪贴板！";
}