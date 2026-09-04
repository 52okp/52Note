import {fetchPost} from "./fetch";

// 客户端左下角的"检查更新"入口：作为状态栏的成员插入（不与 counter/help 等元素重叠），
// 点击后调用内核 /api/system/checkUpdate：有新版本时内核会自动下载并推送
// update-pkg-ready（状态栏左侧出现 pill"立即安装"），无新版本时内核推送 toast 提示。
const entryId = "updateCheckEntry";
let entry: HTMLElement | null = null;
let entryHidden = false;

const createEntry = () => {
    if (entry || entryHidden) {
        return;
    }
    const statusBar = document.getElementById("status");
    if (!statusBar) {
        return;
    }
    const el = document.createElement("div");
    el.id = entryId;
    el.classList.add("toolbar__item");
    el.textContent = window.siyuan.languages?.checkUpdate || "检查更新";
    el.title = "检查 52Note 是否有新版本";
    el.style.cssText =
        "display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;" +
        "width:auto;min-width:0;height:22px;align-self:center;box-sizing:border-box;" +
        "font-size:12px;line-height:20px;padding:0 4px;white-space:nowrap;cursor:pointer;user-select:none;" +
        "color:inherit;opacity:0.85;transition:opacity .2s;";
    el.addEventListener("mouseenter", () => {
        el.style.opacity = "1";
        el.style.textDecoration = "underline";
    });
    el.addEventListener("mouseleave", () => {
        el.style.opacity = "0.85";
        el.style.textDecoration = "none";
    });
    el.addEventListener("click", () => {
        if (el.dataset.checking) {
            return;
        }
        el.dataset.checking = "1";
        el.style.opacity = "0.4";
        el.style.pointerEvents = "none";
        const restore = () => {
            delete el.dataset.checking;
            el.style.opacity = "0.85";
            el.style.pointerEvents = "auto";
        };
        // 检查结果由内核通过 update-notify / update-pkg-ready 消息提示，这里只负责恢复点击态
        fetchPost("/api/system/checkUpdate", {showMsg: true}, restore, undefined, restore);
    });

    // 插在 dock 切换按钮（#barDock）之后、消息（.status__msg）之后，避开 counter 与帮助按钮
    const barDock = statusBar.querySelector("#barDock");
    if (barDock && barDock.nextElementSibling) {
        statusBar.insertBefore(el, barDock.nextElementSibling);
    } else {
        statusBar.appendChild(el);
    }
    entry = el;
};

// UI 初始化完成后调用，常驻显示检查更新入口
export const initUpdateCheckEntry = () => {
    createEntry();
};

// 更新包就绪 pill 弹出时隐藏入口，避免与 pill 视觉重叠
export const hideUpdateCheckEntry = () => {
    entryHidden = true;
    entry?.remove();
    entry = null;
};

// pill 关闭后恢复入口
export const showUpdateCheckEntry = () => {
    entryHidden = false;
    createEntry();
};
