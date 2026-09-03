import {Constants} from "../constants";
import {confirmDialog} from "../dialog/confirmDialog";
import {showMessage} from "../dialog/message";
import {hideUpdateCheckEntry, showUpdateCheckEntry} from "./updateCheckEntry";
/// #if !BROWSER
import {ipcRenderer} from "electron";
/// #endif

let pillHidden = false;

const pillId = "updateReadyPill";

export const hideUpdateReadyPill = () => {
    const pill = document.getElementById(pillId);
    pill?.remove();
    // pill 关闭后恢复左下角常驻的“检查更新”入口
    showUpdateCheckEntry();
};

export const showUpdateReadyPill = () => {
    if (pillHidden || document.getElementById(pillId)) {
        return;
    }
    if (document.querySelector("html").classList.contains("fn__none")) {
        return;
    }
    // pill 弹出时隐藏左下角常驻的“检查更新”入口，避免重叠
    hideUpdateCheckEntry();
    const container = document.createElement("div");
    container.id = pillId;
    container.style.cssText =
        "position:fixed;left:16px;bottom:20px;z-index:200;display:flex;align-items:center;gap:8px;" +
        "background:var(--b3-theme-surface, #ffffff);color:var(--b3-theme-on-surface, rgba(0,0,0,0.85));" +
        "border:1px solid var(--b3-theme-primary-lightest, rgba(0,0,0,0.1));" +
        "border-radius:8px;box-shadow:0 2px 8px rgb(0 0 0 / 0.12);padding:8px 10px;font-size:13px;line-height:1;";
    container.innerHTML = `
        <svg style="width:14px;height:14px;color:var(--b3-theme-primary,#1890ff);"><use xlink:href="#iconUp"></use></svg>
        <span>新版本安装包已就绪</span>
        <button class="b3-button b3-button--outline" data-install style="padding:2px 10px;font-size:12px;height:24px;line-height:20px;">立即安装</button>
        <button class="b3-button b3-button--text" data-dismiss style="padding:2px;font-size:12px;height:24px;line-height:20px;" aria-label="稍后再说">稍后</button>`;
    document.body.appendChild(container);

    container.querySelector("[data-install]")?.addEventListener("click", () => {
        confirmDialog(window.siyuan.languages.updateVersion || "更新", "是否退出并立即安装新版本？", () => {
            installUpdate();
        });
    });
    container.querySelector("[data-dismiss]")?.addEventListener("click", () => {
        hideUpdateReadyPill();
    });
};

const installUpdate = () => {
    /// #if !BROWSER
    ipcRenderer.invoke(Constants.SIYUAN_INSTALL_UPDATE, {
        port: location.port,
        setCurrentWorkspace: true,
    }).then((accepted: boolean) => {
        if (!accepted) {
            showMessage(window.siyuan.languages._kernel[104] || "更新失败，请稍后重试", 7000, "error");
        }
    }).catch(() => {
        showMessage(window.siyuan.languages._kernel[104] || "更新失败，请稍后重试", 7000, "error");
    });
    /// #else
    showMessage("当前环境不支持自动安装，请手动安装新版本", 7000, "info");
    /// #endif
};

export const setUpdatePillDismissed = () => {
    pillHidden = true;
};
