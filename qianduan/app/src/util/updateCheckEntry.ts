import {fetchPost} from "./fetch";

// 客户端左下角常驻的“检查更新”入口：点击后调用内核 /api/system/checkUpdate，
// 有新版本时内核会自动下载并推送 update-pkg-ready（左下角 pill 出现“立即安装”），
// 无新版本时内核推送 update-notify toast 提示。
const entryId = "updateCheckEntry";
let entry: HTMLElement | null = null;
let entryHidden = false;

const createEntry = () => {
    if (entry || entryHidden) {
        return;
    }
    const el = document.createElement("div");
    el.id = entryId;
    el.textContent = window.siyuan.languages?.checkUpdate || "检查更新";
    el.title = "检查 52Note 是否有新版本";
    el.style.cssText =
        "position:fixed;left:16px;bottom:12px;z-index:150;font-size:12px;line-height:1;" +
        "color:var(--b3-theme-primary,#1890ff);cursor:pointer;user-select:none;opacity:0.8;" +
        "transition:opacity .2s;";
    el.addEventListener("mouseenter", () => {
        el.style.opacity = "1";
        el.style.textDecoration = "underline";
    });
    el.addEventListener("mouseleave", () => {
        el.style.opacity = "0.8";
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
            el.style.opacity = "0.8";
            el.style.pointerEvents = "auto";
        };
        // 检查结果由内核通过 update-notify / update-pkg-ready 消息提示，这里只负责恢复点击态
        fetchPost("/api/system/checkUpdate", {showMsg: true}, restore, undefined, restore);
    });
    document.body.appendChild(el);
    entry = el;
};

// UI 初始化完成后调用，常驻显示检查更新入口
export const initUpdateCheckEntry = () => {
    createEntry();
};

// 更新包就绪 pill 弹出时隐藏入口，避免左下角重叠
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
