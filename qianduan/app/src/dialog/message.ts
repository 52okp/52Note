import {genUUID} from "../util/genID";
import {Constants} from "../constants";

export const initMessage = () => {
    const messageElement = document.getElementById("message");
    messageElement.innerHTML = '<div class="fn__flex-1"></div>';
    messageElement.addEventListener("click", (event) => {
        let target = event.target as HTMLElement;
        while (target && !target.isEqualNode(messageElement)) {
            if (target.classList.contains("b3-snackbar__close")) {
                hideMessage(target.parentElement.getAttribute("data-id"));
                event.preventDefault();
                break;
            } else if (target.tagName === "A" || target.tagName === "BUTTON") {
                break;
            } else if (target.classList.contains("b3-snackbar")) {
                if (getSelection().rangeCount === 0 || !getSelection().getRangeAt(0).toString()) {
                    hideMessage(target.getAttribute("data-id"));
                }
                event.preventDefault();
                event.stopPropagation();
                break;
            }
            target = target.parentElement;
        }
    });

    document.querySelectorAll("#tempMessage > div").forEach((item) => {
        showMessage(item.innerHTML, parseInt(item.getAttribute("data-timeout")), item.getAttribute("data-type"), item.getAttribute("data-message-id"));
        item.remove();
    });
};

// type: info/error; timeout: 0 手动关闭；-1 永不关闭
export const showMessage = (message: string, timeout = 6000, type = "info", messageId?: string) => {
    if (!message) {
        return;
    }

    const messagesElement = document.getElementById("message").firstElementChild;
    if (!messagesElement) {
        let tempMessages = document.getElementById("tempMessage");
        if (!tempMessages) {
            document.body.insertAdjacentHTML("beforeend", `<div style="font-size: 14px;top: 22px;position: fixed;z-index: 100;right: 30px;line-height: 20px;word-break: break-word;display: flex;flex-direction: column;align-items: flex-end;"
id="tempMessage"></div>`);
            tempMessages = document.getElementById("tempMessage");
        }
        tempMessages.insertAdjacentHTML("beforeend", `<div style="background:#fff;color:#1f2328;border:1px solid #e5e6eb;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.08);padding:10px 14px;margin-bottom: 12px;display:flex;align-items:center;"
data-timeout="${timeout}"
data-type="${type}"
data-message-id="${messageId || ""}">${snackbarIconHTML(type)}<span>${message}</span></div>`);
        return;
    }
    const id = messageId || genUUID();
    const existElement = messagesElement.querySelector(`.b3-snackbar[data-id="${id}"]`);
    const messageVersion = message;
    if (existElement) {
        window.clearTimeout(parseInt(existElement.getAttribute("data-timeoutid")));
        existElement.innerHTML = `<div data-type="textMenu" class="b3-snackbar__content${timeout === 0 ? " b3-snackbar__content--close" : ""}" style="display:flex;align-items:center;background:#fff;color:#1f2328;">${snackbarIconHTML(type)}<span>${messageVersion}</span></div>${timeout === 0 ? '<svg class="b3-snackbar__close"><use xlink:href="#iconCloseRound"></use></svg>' : ""}`;
        if (type === "error") {
            existElement.classList.add("b3-snackbar--error");
        } else {
            existElement.classList.remove("b3-snackbar--error");
        }
        if (timeout > 0) {
            const timeoutId = window.setTimeout(() => {
                hideMessage(id);
            }, timeout);
            existElement.setAttribute("data-timeoutid", timeoutId.toString());
        }
        return;
    }
    let messageHTML = `<div data-id="${id}" class="b3-snackbar--hide b3-snackbar" style="background:#fff;color:#1f2328;border:1px solid #e5e6eb;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.10);"><div data-type="textMenu" class="b3-snackbar__content${timeout === 0 ? " b3-snackbar__content--close" : ""}" style="display:flex;align-items:center;">${snackbarIconHTML(type)}<span>${messageVersion}</span></div>`;
    if (timeout === 0) {
        messageHTML += '<svg class="b3-snackbar__close"><use xlink:href="#iconCloseRound"></use></svg>';
    } else if (timeout !== -1) { // -1 时需等待请求完成后手动关闭
        const timeoutId = window.setTimeout(() => {
            hideMessage(id);
        }, timeout);
        messageHTML = messageHTML.replace("<div data-id", `<div data-timeoutid="${timeoutId}" data-id`);
    }
    messagesElement.parentElement.classList.add("b3-snackbars--show");
    messagesElement.parentElement.style.zIndex = (++window.siyuan.zIndex).toString();
    messagesElement.insertAdjacentHTML("afterbegin", messageHTML + "</div>");
    setTimeout(() => {
        messagesElement.querySelectorAll(".b3-snackbar--hide").forEach(item => {
            item.classList.remove("b3-snackbar--hide");
        });
    });
    if (messagesElement.firstElementChild.nextElementSibling &&
        messagesElement.firstElementChild.nextElementSibling.innerHTML === messagesElement.firstElementChild.innerHTML) {
        messagesElement.firstElementChild.nextElementSibling.remove();
    }
    messagesElement.scrollTo({
        top: 0,
        behavior: "smooth"
    });
    return id;
};

// 圆形感叹号图标：错误用红、信息用蓝
const snackbarIconHTML = (type: string) => {
    if (type === "error") {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" style="width:16px;height:16px;flex-shrink:0;margin-right:8px;vertical-align:-2px"><circle cx="8" cy="8" r="7.5" fill="#ff4d4f"/><rect x="7.3" y="3.8" width="1.4" height="5.2" rx="0.7" fill="#fff"/><circle cx="8" cy="11.2" r="0.85" fill="#fff"/></svg>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" style="width:16px;height:16px;flex-shrink:0;margin-right:8px;vertical-align:-2px"><circle cx="8" cy="8" r="7.5" fill="#1677ff"/><rect x="7.3" y="7" width="1.4" height="4.6" rx="0.7" fill="#fff"/><circle cx="8" cy="4.3" r="0.85" fill="#fff"/></svg>';
};

export const hideMessage = (id?: string) => {
    const messagesElement = document.getElementById("message").firstElementChild;
    if (!messagesElement) {
        return;
    }
    if (id) {
        const messageElement = messagesElement.querySelector(`[data-id="${id}"]`);
        if (messageElement) {
            messageElement.classList.add("b3-snackbar--hide");
            window.clearTimeout(parseInt(messageElement.getAttribute("data-timeoutid")));
            setTimeout(() => {
                messageElement.remove();
                if (messagesElement.childElementCount === 0) {
                    messagesElement.parentElement.classList.remove("b3-snackbars--show");
                    messagesElement.innerHTML = "";
                }
            }, Constants.TIMEOUT_INPUT);
        }
        let hasShowItem = false;
        Array.from(messagesElement.children).find(item => {
            if (!item.classList.contains("b3-snackbar--hide")) {
                hasShowItem = true;
                return true;
            }
        });
        if (hasShowItem) {
            messagesElement.parentElement.classList.add("b3-snackbars--show");
        } else {
            messagesElement.parentElement.classList.remove("b3-snackbars--show");
        }
    } else {
        messagesElement.parentElement.classList.remove("b3-snackbars--show");
        setTimeout(() => {
            messagesElement.innerHTML = "";
        }, Constants.TIMEOUT_INPUT);
    }
};
