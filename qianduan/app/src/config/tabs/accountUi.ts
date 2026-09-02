import {showMessage} from "../../dialog/message";
import {fetchPost} from "../../util/fetch";
import type {SettingTabBuilder} from "../setting/builder";
import {escapeHtml} from "../../util/escape";

export const registerAccountGroup = (tab: SettingTabBuilder) => {
    const group = tab.group("account", window.siyuan.languages.configGroupAccount);
    group.slot({
        key: "accountMain",
        keywords: [
            window.siyuan.languages.account,
            window.siyuan.languages.email,
            window.siyuan.languages.password,
            window.siyuan.languages.login,
            window.siyuan.languages.register,
            window.siyuan.languages.refresh,
            window.siyuan.languages.logout,
        ],
        html: genAccountHTML,
        afterMount: bindAccountEvents,
    });
};

const genLoggedInHTML = () => {
    const user = window.siyuan.user;
    const displayName = escapeHtml(user?.userNickname || user?.userName || "");
    const email = escapeHtml(user?.userName || "");
    return `<div id="configAccountMain" class="b3-label config-item">
    <div class="fn__flex config-wrap">
        <div class="fn__flex-1">
            <div><b>${displayName}</b></div>
            <div class="b3-label__text">${email}</div>
        </div>
        <span class="fn__space"></span>
        <button class="b3-button b3-button--text" data-action="refresh">
            <svg><use xlink:href="#iconRefresh"></use></svg>${window.siyuan.languages.refresh}
        </button>
        <span class="fn__space"></span>
        <button class="b3-button b3-button--cancel" data-action="logout">${window.siyuan.languages.logout}</button>
    </div>
</div>`;
};

const genAccountHTML = () => {
    const user = window.siyuan.user;
    if (user) {
        return genLoggedInHTML();
    }

    return `<div id="configAccountMain" class="b3-label config-item">
    <div class="b3-form__space--small">
        <div class="fn__flex" style="gap: 8px">
            <button class="b3-button b3-button--outline fn__flex-1" data-account-tab="login" data-tab-active>密码登录</button>
            <button class="b3-button fn__flex-1" data-account-tab="code">验证码登录</button>
            <button class="b3-button fn__flex-1" data-account-tab="register">注册</button>
        </div>
        <div class="fn__hr"></div>

        <!-- 密码登录 -->
        <div data-account-panel="login">
            <div class="b3-form__icon">
                <svg class="b3-form__icon-icon"><use xlink:href="#iconAccount"></use></svg>
                <input type="email" data-field="email" autocomplete="username" class="b3-text-field fn__block b3-form__icon-input" placeholder="${window.siyuan.languages.email}">
            </div>
            <div class="fn__hr--b"></div>
            <div class="b3-form__icon">
                <svg class="b3-form__icon-icon"><use xlink:href="#iconLock"></use></svg>
                <input type="password" data-field="password" autocomplete="current-password" class="b3-text-field fn__block b3-form__icon-input" placeholder="${window.siyuan.languages.password}">
            </div>
            <div class="fn__hr--b"></div>
            <button class="b3-button fn__block" data-action="password-login">${window.siyuan.languages.login}</button>
            <button class="b3-button b3-button--text fn__block" data-action="go-reset" style="margin-top:4px">忘记密码？</button>
        </div>

        <!-- 验证码登录 -->
        <div data-account-panel="code" class="fn__none">
            <div class="b3-form__icon">
                <svg class="b3-form__icon-icon"><use xlink:href="#iconAccount"></use></svg>
                <input type="email" data-field="code-email" autocomplete="username" class="b3-text-field fn__block b3-form__icon-input" placeholder="${window.siyuan.languages.email}">
            </div>
            <div class="fn__hr--b"></div>
            <div class="fn__flex">
                <input data-field="code-input" inputmode="numeric" autocomplete="one-time-code" class="b3-text-field fn__flex-1" placeholder="6 位验证码">
                <span class="fn__space"></span>
                <button class="b3-button b3-button--outline" data-action="send-code" data-countdown>获取验证码</button>
            </div>
            <div class="fn__hr--b"></div>
            <button class="b3-button fn__block" data-action="code-login">验证码登录</button>
        </div>

        <!-- 注册：填写资料 -->
        <div data-account-panel="register" class="fn__none">
            <div data-register-form>
                <div class="b3-form__icon">
                    <svg class="b3-form__icon-icon"><use xlink:href="#iconAccount"></use></svg>
                    <input type="email" data-field="reg-email" autocomplete="username" class="b3-text-field fn__block b3-form__icon-input" placeholder="${window.siyuan.languages.email}">
                </div>
                <div class="fn__hr--b"></div>
                <div class="b3-form__icon">
                    <svg class="b3-form__icon-icon"><use xlink:href="#iconAccount"></use></svg>
                    <input data-field="reg-name" maxlength="80" autocomplete="name" class="b3-text-field fn__block b3-form__icon-input" placeholder="${window.siyuan.languages.name}（选填）">
                </div>
                <div class="fn__hr--b"></div>
                <div class="b3-form__icon">
                    <svg class="b3-form__icon-icon"><use xlink:href="#iconLock"></use></svg>
                    <input type="password" data-field="reg-password" minlength="8" maxlength="128" autocomplete="new-password" class="b3-text-field fn__block b3-form__icon-input" placeholder="${window.siyuan.languages.password}（至少 8 位）">
                </div>
                <div class="fn__hr--b"></div>
                <button class="b3-button fn__block" data-action="register">${window.siyuan.languages.register}</button>
            </div>
            <!-- 注册：邮箱验证 -->
            <div data-register-verify class="fn__none">
                <div class="b3-label__text" data-verify-email></div>
                <div class="fn__hr--b"></div>
                <div class="fn__flex">
                    <input data-field="verify-code" inputmode="numeric" autocomplete="one-time-code" class="b3-text-field fn__flex-1" placeholder="邮箱收到的 6 位验证码">
                    <span class="fn__space"></span>
                    <button class="b3-button b3-button--outline" data-action="resend-verify">重新发送</button>
                </div>
                <div class="fn__hr--b"></div>
                <button class="b3-button fn__block" data-action="verify-register">验证并登录</button>
            </div>
        </div>

        <!-- 重置密码 -->
        <div data-account-panel="reset" class="fn__none">
            <div data-reset-request>
                <div class="b3-form__icon">
                    <svg class="b3-form__icon-icon"><use xlink:href="#iconAccount"></use></svg>
                    <input type="email" data-field="reset-email" autocomplete="username" class="b3-text-field fn__block b3-form__icon-input" placeholder="注册邮箱">
                </div>
                <div class="fn__hr--b"></div>
                <button class="b3-button fn__block" data-action="send-reset">发送重置验证码</button>
            </div>
            <div data-reset-confirm class="fn__none">
                <div class="fn__flex">
                    <input data-field="reset-code" inputmode="numeric" autocomplete="one-time-code" class="b3-text-field fn__flex-1" placeholder="6 位验证码">
                    <span class="fn__space"></span>
                    <button class="b3-button b3-button--outline" data-action="send-reset-again">重新发送</button>
                </div>
                <div class="fn__hr--b"></div>
                <div class="b3-form__icon">
                    <svg class="b3-form__icon-icon"><use xlink:href="#iconLock"></use></svg>
                    <input type="password" data-field="reset-new-password" minlength="8" maxlength="128" autocomplete="new-password" class="b3-text-field fn__block b3-form__icon-input" placeholder="新密码（至少 8 位）">
                </div>
                <div class="fn__hr--b"></div>
                <button class="b3-button fn__block" data-action="confirm-reset">重置密码</button>
            </div>
            <button class="b3-button b3-button--text fn__block" data-action="back-login" style="margin-top:4px">返回登录</button>
        </div>
    </div>
</div>`;
};

let countdownTimer: number | null = null;

const clearCountdown = () => {
    if (countdownTimer !== null) {
        window.clearInterval(countdownTimer);
        countdownTimer = null;
    }
};

const startCountdown = (button: HTMLButtonElement, seconds = 60) => {
    const original = button.textContent || button.dataset.original || "获取验证码";
    if (!button.dataset.original) {
        button.dataset.original = original;
    }
    button.disabled = true;
    let left = seconds;
    clearCountdown();
    countdownTimer = window.setInterval(() => {
        left -= 1;
        if (left <= 0) {
            clearCountdown();
            button.disabled = false;
            button.textContent = button.dataset.original || original;
            return;
        }
        button.textContent = `${left}s 后可重发`;
    }, 1000);
};

const switchAccountTab = (account: Element, mode: string, resetRegister = false) => {
    const panels = account.querySelectorAll<HTMLElement>("[data-account-panel]");
    panels.forEach((panel) => {
        const panelMode = panel.getAttribute("data-account-panel");
        panel.classList.toggle("fn__none", panelMode !== mode);
    });
    const tabs = account.querySelectorAll<HTMLElement>("[data-account-tab]");
    tabs.forEach((tab) => {
        const active = tab.getAttribute("data-account-tab") === mode;
        tab.classList.toggle("b3-button--outline", !active);
        tab.setAttribute("data-tab-active", active ? "true" : "");
    });
    if (mode === "register" && resetRegister) {
        account.querySelector("[data-register-form]")?.classList.remove("fn__none");
        account.querySelector("[data-register-verify]")?.classList.add("fn__none");
    }
};

const inputValue = (account: Element, field: string): HTMLInputElement | null =>
    account.querySelector<HTMLInputElement>(`[data-field=${field}]`);

const bindAccountEvents = (root: HTMLElement) => {
    const account = root.querySelector("#configAccountMain");
    if (!account) {
        return;
    }
    clearCountdown();

    account.querySelector<HTMLElement>("[data-action=refresh]")?.addEventListener("click", () => {
        fetchPost("/api/account/refresh52Note", {}, (response) => {
            window.siyuan.user = response.data;
            renderAccount(root);
            showMessage(window.siyuan.languages.refreshUser, 3000);
        });
    });
    account.querySelector<HTMLElement>("[data-action=logout]")?.addEventListener("click", () => {
        fetchPost("/api/account/logout52Note", {}, () => {
            window.siyuan.user = null;
            renderAccount(root);
            onSetaccount();
            showMessage(window.siyuan.languages.logoutSuccess || "已退出登录", 3000);
        });
    });

    account.querySelectorAll<HTMLElement>("[data-account-tab]").forEach((tab) => {
        tab.addEventListener("click", () => {
            const mode = tab.getAttribute("data-account-tab") || "login";
            switchAccountTab(account, mode, true);
            const first = account.querySelector<HTMLInputElement>(`[data-account-panel="${mode}"] [data-field]`);
            first?.focus();
        });
    });

    // 密码登录
    const email = inputValue(account, "email");
    const password = inputValue(account, "password");
    account.querySelector<HTMLElement>("[data-action=password-login]")?.addEventListener("click", () => submitPasswordLogin());
    password?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            submitPasswordLogin();
        }
    });
    account.querySelector<HTMLElement>("[data-action=go-reset]")?.addEventListener("click", () => {
        switchAccountTab(account, "reset", true);
        const emailInput = inputValue(account, "reset-email");
        if (emailInput) {
            emailInput.value = email?.value.trim() || "";
        }
        inputValue(account, "reset-email")?.focus();
    });
    account.querySelector<HTMLElement>("[data-action=back-login]")?.addEventListener("click", () => {
        switchAccountTab(account, "login", true);
    });

    // 验证码登录
    account.querySelector<HTMLElement>("[data-action=send-code]")?.addEventListener("click", (event) => {
        const codeEmail = inputValue(account, "code-email");
        if (!codeEmail?.checkValidity()) {
            codeEmail?.reportValidity();
            return;
        }
        const button = event.currentTarget as HTMLButtonElement;
        fetchPost("/api/account/requestLoginCode52Note", {
            email: codeEmail.value.trim(),
        }, () => {
            startCountdown(button);
            showMessage("验证码已发送到邮箱", 3000);
        });
    });
    account.querySelector<HTMLElement>("[data-action=code-login]")?.addEventListener("click", () => submitCodeLogin());
    inputValue(account, "code-input")?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            submitCodeLogin();
        }
    });

    // 注册
    account.querySelector<HTMLElement>("[data-action=register]")?.addEventListener("click", () => submitRegister());
    inputValue(account, "reg-password")?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            submitRegister();
        }
    });
    account.querySelector<HTMLElement>("[data-action=verify-register]")?.addEventListener("click", () => submitVerifyRegister());
    inputValue(account, "verify-code")?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            submitVerifyRegister();
        }
    });
    account.querySelector<HTMLElement>("[data-action=resend-verify]")?.addEventListener("click", (event) => {
        const regEmail = inputValue(account, "reg-email");
        if (!regEmail) {
            return;
        }
        const button = event.currentTarget as HTMLButtonElement;
        fetchPost("/api/account/resendRegister52Note", {
            email: regEmail.value.trim(),
        }, () => {
            startCountdown(button);
            showMessage("验证码已重新发送", 3000);
        });
    });

    // 重置密码
    account.querySelector<HTMLElement>("[data-action=send-reset]")?.addEventListener("click", (event) => {
        const resetEmail = inputValue(account, "reset-email");
        if (!resetEmail?.value.trim()) {
            resetEmail?.focus();
            return;
        }
        const button = event.currentTarget as HTMLButtonElement;
        fetchPost("/api/account/requestReset52Note", {
            email: resetEmail.value.trim(),
        }, () => {
            startCountdown(button);
            account.querySelector("[data-reset-request]")?.classList.add("fn__none");
            account.querySelector("[data-reset-confirm]")?.classList.remove("fn__none");
            inputValue(account, "reset-code")?.focus();
        });
    });
    account.querySelector<HTMLElement>("[data-action=send-reset-again]")?.addEventListener("click", (event) => {
        const resetEmail = inputValue(account, "reset-email");
        if (!resetEmail) {
            return;
        }
        const button = event.currentTarget as HTMLButtonElement;
        fetchPost("/api/account/requestReset52Note", {
            email: resetEmail.value.trim(),
        }, () => {
            startCountdown(button);
        });
    });
    account.querySelector<HTMLElement>("[data-action=confirm-reset]")?.addEventListener("click", () => submitReset());
    inputValue(account, "reset-new-password")?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            submitReset();
        }
    });

    function submitPasswordLogin() {
        if (!email?.checkValidity() || !password?.value) {
            email?.reportValidity();
            return;
        }
        const button = account.querySelector<HTMLButtonElement>("[data-action=password-login]");
        if (button) {
            button.disabled = true;
        }
        fetchPost("/api/account/login52Note", {
            email: email.value.trim(),
            password: password.value,
        }, (response) => {
            window.siyuan.user = response.data;
            renderAccount(root);
            onSetaccount();
        }).finally(() => {
            if (button?.isConnected) {
                button.disabled = false;
            }
        });
    }

    function submitCodeLogin() {
        const codeEmail = inputValue(account, "code-email");
        const codeInput = inputValue(account, "code-input");
        if (!codeEmail?.checkValidity() || !codeInput?.value.trim()) {
            codeEmail?.reportValidity();
            return;
        }
        const button = account.querySelector<HTMLButtonElement>("[data-action=code-login]");
        if (button) {
            button.disabled = true;
        }
        fetchPost("/api/account/loginCode52Note", {
            email: codeEmail.value.trim(),
            code: codeInput.value.trim(),
        }, (response) => {
            window.siyuan.user = response.data;
            renderAccount(root);
            onSetaccount();
        }).finally(() => {
            if (button?.isConnected) {
                button.disabled = false;
            }
        });
    }

    function submitRegister() {
        const regEmail = inputValue(account, "reg-email");
        const regName = inputValue(account, "reg-name");
        const regPassword = inputValue(account, "reg-password");
        if (!regEmail?.checkValidity()) {
            regEmail?.reportValidity();
            return;
        }
        if (!regPassword || regPassword.value.length < 8) {
            regPassword?.focus();
            showMessage("密码至少需要 8 位", 3000);
            return;
        }
        const button = account.querySelector<HTMLButtonElement>("[data-action=register]");
        if (button) {
            button.disabled = true;
        }
        fetchPost("/api/account/register52Note", {
            email: regEmail.value.trim(),
            password: regPassword.value,
            displayName: regName?.value.trim() || "",
        }, () => {
            account.querySelector("[data-register-form]")?.classList.add("fn__none");
            const verify = account.querySelector<HTMLElement>("[data-register-verify]");
            const verifyEmail = account.querySelector<HTMLElement>("[data-verify-email]");
            if (verifyEmail) {
                verifyEmail.textContent = `验证码已发送至 ${regEmail.value.trim()}，请查收邮件`;
            }
            verify?.classList.remove("fn__none");
            inputValue(account, "verify-code")?.focus();
            showMessage("注册成功，请完成邮箱验证", 3000);
        }).finally(() => {
            if (button?.isConnected) {
                button.disabled = false;
            }
        });
    }

    function submitVerifyRegister() {
        const regEmail = inputValue(account, "reg-email");
        const verifyCode = inputValue(account, "verify-code");
        if (!regEmail || !verifyCode?.value.trim()) {
            verifyCode?.focus();
            return;
        }
        const button = account.querySelector<HTMLButtonElement>("[data-action=verify-register]");
        if (button) {
            button.disabled = true;
        }
        fetchPost("/api/account/verifyRegister52Note", {
            email: regEmail.value.trim(),
            code: verifyCode.value.trim(),
        }, (response) => {
            window.siyuan.user = response.data;
            renderAccount(root);
            onSetaccount();
        }).finally(() => {
            if (button?.isConnected) {
                button.disabled = false;
            }
        });
    }

    function submitReset() {
        const resetEmail = inputValue(account, "reset-email");
        const resetCode = inputValue(account, "reset-code");
        const newPassword = inputValue(account, "reset-new-password");
        if (!resetEmail?.value.trim() || !resetCode?.value.trim() || !newPassword || newPassword.value.length < 8) {
            showMessage("请完整填写邮箱、验证码和新密码（至少 8 位）", 3000);
            return;
        }
        const button = account.querySelector<HTMLButtonElement>("[data-action=confirm-reset]");
        if (button) {
            button.disabled = true;
        }
        fetchPost("/api/account/confirmReset52Note", {
            email: resetEmail.value.trim(),
            code: resetCode.value.trim(),
            newPassword: newPassword.value,
        }, () => {
            switchAccountTab(account, "login", true);
            const loginEmail = inputValue(account, "email");
            if (loginEmail) {
                loginEmail.value = resetEmail!.value.trim();
            }
            showMessage("密码已重置，请使用新密码登录", 3000);
        }).finally(() => {
            if (button?.isConnected) {
                button.disabled = false;
            }
        });
    }
};

const renderAccount = (root: HTMLElement) => {
    const current = root.querySelector("#configAccountMain");
    if (!current) {
        return;
    }
    current.outerHTML = genAccountHTML();
    bindAccountEvents(root);
};

export const updateAccountSwitchesVisibility = (root: Element) => {
    void root;
};

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
