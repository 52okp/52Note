/**
 * 账号登录/注册/退出 UI 已整体迁移到顶栏独立弹窗（accountDialog），
 * 设置面板不再渲染账号区块。本文件仅保留其它模块仍会调用的状态同步辅助。
 */

export const updateAccountSwitchesVisibility = (root: Element) => {
    void root;
};

/** 顶栏账号按钮：未登录显示"登录"文案，已登录显示同步状态/图标。 */
export const onSetaccount = () => {
    const toolbarVIP = document.getElementById("toolbarVIP");
    if (toolbarVIP) {
        toolbarVIP.innerHTML = "";
    }
    const barSync = document.getElementById("barSync");
    if (!barSync) {
        return;
    }
    const loggedIn = Boolean(window.siyuan.user);
    barSync.classList.toggle("toolbar__item--login", !loggedIn);
    barSync.querySelector("svg")?.classList.toggle("fn__none", !loggedIn);
    barSync.querySelector(".toolbar__login")?.classList.toggle("fn__none", loggedIn);
    barSync.setAttribute("aria-label", loggedIn ?
        (window.siyuan.config.sync.stat || window.siyuan.languages.syncNow) : window.siyuan.languages.login);
};
