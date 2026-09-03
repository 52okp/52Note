import "../assets/scss/component/account-dialog.scss";

import {fetchPost} from "../util/fetch";
import {showMessage} from "./message";
import {onSetaccount} from "../config/tabs/accountUi";

type Mode = "login" | "register-send" | "register-verify" | "reset-send" | "reset-verify";

let overlay: HTMLElement | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;
let activeMode: Mode = "login";
let sentEmail = "";          // 最近一次发码的目标邮箱（注册/重置都共用展示）
let loginStash = "";        // 切到忘记密码时保留已填的邮箱
let countdownTimer: number | null = null;

const stopCountdown = () => {
    if (countdownTimer !== null) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
};

export const openAccountDialog = (initialMode: Mode = "login") => {
    if (overlay) {
        if (initialMode !== activeMode) {
            stopCountdown();
            switchMode(initialMode);
        }
        return;
    }
    overlay = document.createElement("div");
    overlay.id = "account-dialog-overlay";
    overlay.className = "account-dialog-overlay";
    overlay.addEventListener("mousedown", (event) => {
        if (event.target === overlay) {
            closeAccountDialog();
        }
    });
    document.body.append(overlay);
    activeMode = initialMode;
    renderInto();
    escHandler = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            closeAccountDialog();
        }
    };
    document.addEventListener("keydown", escHandler);
};

export const closeAccountDialog = () => {
    stopCountdown();
    if (overlay) {
        overlay.remove();
        overlay = null;
    }
    if (escHandler) {
        document.removeEventListener("keydown", escHandler);
        escHandler = null;
    }
    activeMode = "login";
    sentEmail = "";
    loginStash = "";
};

const switchMode = (nextMode: Mode, carry: Record<string, string> = {}) => {
    if (!overlay) return;
    activeMode = nextMode;
    if (typeof carry.email === "string") {
        sentEmail = carry.email;
    }
    if (typeof carry.saveLoginEmail === "string") {
        loginStash = carry.saveLoginEmail;
    }
    renderInto();
};

const fieldValue = (name: string): string => {
    const el = overlay?.querySelector<HTMLInputElement>(`[data-field="${name}"]`);
    return (el?.value ?? "").trim();
};

const setFieldValue = (name: string, value: string) => {
    const el = overlay?.querySelector<HTMLInputElement>(`[data-field="${name}"]`);
    if (el) {
        el.value = value;
    }
};

const disableSubmit = (action: string, disabled: boolean) => {
    overlay?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)
        ?.toggleAttribute("disabled", disabled);
};

const renderInto = () => {
    if (!overlay) return;
    overlay.innerHTML = renderByMode();
    bindEvents();
    const first = overlay.querySelector<HTMLInputElement>("[data-field]");
    first?.focus({preventScroll: true});
};

const escapeHtml = (raw: string): string =>
    raw.replace(/[&<>"']/g, (ch) => {
        switch (ch) {
            case "&": return "&amp;";
            case "<": return "&lt;";
            case ">": return "&gt;";
            case '"': return "&quot;";
            default: return "&#39;";
        }
    });

const renderByMode = (): string => {
    switch (activeMode) {
        case "register-send":
            return dialogFrame("创建账号", "使用邮箱注册免费账号", registerSendMarkup());
        case "register-verify":
            return dialogFrame("验证邮箱", `验证码已发送至 ${escapeHtml(sentEmail)}，60 分钟内有效`, registerVerifyMarkup(), true);
        case "reset-send":
            return dialogFrame("找回密码", "输入你的账号邮箱，我们会发送验证码", resetSendMarkup());
        case "reset-verify":
            return dialogFrame("重置密码", "请设置新密码", resetVerifyMarkup(), true);
        default:
            return dialogFrame("欢迎回来", "登录你的墨站站会员账号", loginMarkup());
    }
};

const dialogFrame = (title: string, subtitle: string, body: string, skipDivider = false) => `
  <div class="account-dialog-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
    <button class="account-dialog-close" type="button" data-action="close" aria-label="关闭">×</button>
    <div class="account-dialog-brand">52okp</div>
    <h1 class="account-dialog-title">${escapeHtml(title)}</h1>
    <p class="account-dialog-subtitle">${escapeHtml(subtitle)}</p>
    ${skipDivider ? "" : "<div class=\"account-dialog-divider\"><span>其他登录方式</span></div>"}
    ${body}
    ${actionRow()}
  </div>
`;

const actionRow = () => {
    switch (activeMode) {
        case "register-send":
            return "<div class=\"account-dialog-footer\">已经有账号？<a data-action=\"go-login\">返回登录</a></div>";
        case "register-verify":
            return "<div class=\"account-dialog-footer\">收不到邮件？<a data-action=\"resend\">重新发送</a> · <a data-action=\"go-login\">返回登录</a></div>";
        case "reset-send":
            return "<div class=\"account-dialog-footer\">想起来了？<a data-action=\"go-login\">返回登录</a></div>";
        case "reset-verify":
            return "<div class=\"account-dialog-footer\">没有收到验证码？<a data-action=\"resend\">重新发送</a> · <a data-action=\"go-login\">返回登录</a></div>";
        default:
            return `
              <div class="account-dialog-helper">
                <a data-action="forgot-password">忘记密码？</a>
              </div>
              <div class="account-dialog-footer">还没有账号？<a data-action="go-register">免费注册</a></div>`;
    }
};

const loginMarkup = () => `
  <form class="account-dialog-form" autocomplete="on">
    <label>
      <span>用户名或邮箱</span>
      <input type="text" data-field="login-email" placeholder="请输入用户名或邮箱" autocomplete="username" required />
    </label>
    <label>
      <span>密码</span>
      <input type="password" data-field="login-password" placeholder="至少 6 位" autocomplete="current-password" required />
    </label>
    <button type="submit" class="account-dialog-primary" data-action="login-submit">登录</button>
  </form>
`;

const registerSendMarkup = () => `
  <form class="account-dialog-form" autocomplete="on">
    <label>
      <span>邮箱</span>
      <input type="email" data-field="reg-email" placeholder="用于接收验证码" autocomplete="email" required />
    </label>
    <label>
      <span>昵称（选填）</span>
      <input type="text" data-field="reg-name" placeholder="留空则用邮箱前缀" autocomplete="nickname" />
    </label>
    <label>
      <span>密码</span>
      <input type="password" data-field="reg-password" placeholder="8-128 位字符" autocomplete="new-password" required />
    </label>
    <button type="submit" class="account-dialog-primary" data-action="register-submit">下一步</button>
  </form>
`;

const registerVerifyMarkup = () => `
  <form class="account-dialog-form" autocomplete="off">
    <label>
      <span>邮箱验证码</span>
      <input type="text" inputmode="numeric" pattern="\\d{6}" data-field="verify-code" placeholder="请输入 6 位数字" maxlength="6" required />
    </label>
    <button type="submit" class="account-dialog-primary" data-action="verify-register">验证并登录</button>
  </form>
`;

const resetSendMarkup = () => `
  <form class="account-dialog-form" autocomplete="on">
    <label>
      <span>账号邮箱</span>
      <input type="email" data-field="reset-email" placeholder="你注册时使用的邮箱" autocomplete="email" required />
    </label>
    <button type="submit" class="account-dialog-primary" data-action="reset-submit">发送验证码</button>
  </form>
`;

const resetVerifyMarkup = () => `
  <form class="account-dialog-form" autocomplete="off">
    <label>
      <span>邮箱验证码</span>
      <input type="text" inputmode="numeric" pattern="\\d{6}" data-field="reset-code" placeholder="请输入 6 位数字" maxlength="6" required />
    </label>
    <label>
      <span>新密码</span>
      <input type="password" data-field="reset-new-password" placeholder="8-128 位字符" autocomplete="new-password" required />
    </label>
    <button type="submit" class="account-dialog-primary" data-action="reset-confirm">重置密码</button>
  </form>
`;

const submitByEnter = (event: KeyboardEvent, action: string) => {
    if (event.key !== "Enter" || event.isComposing) {
        return;
    }
    event.preventDefault();
    triggerSubmit(action);
};

const triggerSubmit = (action: string) => {
    switch (action) {
        case "login-submit": return submitLogin();
        case "register-submit": return submitRegister();
        case "verify-register": return submitVerifyRegister();
        case "reset-submit": return submitReset();
        case "reset-confirm": return submitResetConfirm();
    }
};

const startResendCountdown = (button: HTMLButtonElement) => {
    let remaining = 60;
    button.disabled = true;
    button.textContent = `${remaining}s 后重新发送`;
    countdownTimer = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
            stopCountdown();
            button.disabled = false;
            button.textContent = "重新发送验证码";
            return;
        }
        button.textContent = `${remaining}s 后重新发送`;
    }, 1000);
};

const bindEvents = () => {
    if (!overlay) return;
    overlay.querySelector<HTMLFormElement>(".account-dialog-form")
        ?.addEventListener("submit", (event) => event.preventDefault());

    overlay.querySelector<HTMLElement>("[data-action=close]")
        ?.addEventListener("click", closeAccountDialog);

    overlay.querySelector<HTMLInputElement>("[data-field=login-password]")
        ?.addEventListener("keydown", (e) => submitByEnter(e, "login-submit"));
    overlay.querySelector<HTMLInputElement>("[data-field=reg-password]")
        ?.addEventListener("keydown", (e) => submitByEnter(e, "register-submit"));
    overlay.querySelector<HTMLInputElement>("[data-field=verify-code]")
        ?.addEventListener("keydown", (e) => submitByEnter(e, "verify-register"));
    overlay.querySelector<HTMLInputElement>("[data-field=reset-code]")
        ?.addEventListener("keydown", (e) => submitByEnter(e, "reset-confirm"));
    overlay.querySelector<HTMLInputElement>("[data-field=reset-new-password]")
        ?.addEventListener("keydown", (e) => submitByEnter(e, "reset-confirm"));
    overlay.querySelector<HTMLInputElement>("[data-field=login-email]")
        ?.addEventListener("input", (e) => {
            // 仅本地缓存，前端不参与登录
            loginStash = (e.target as HTMLInputElement).value.trim();
        });

    overlay.querySelector<HTMLElement>("[data-action=login-submit]")
        ?.addEventListener("click", () => submitLogin());
    overlay.querySelector<HTMLElement>("[data-action=register-submit]")
        ?.addEventListener("click", () => submitRegister());
    overlay.querySelector<HTMLElement>("[data-action=verify-register]")
        ?.addEventListener("click", () => submitVerifyRegister());
    overlay.querySelector<HTMLElement>("[data-action=reset-submit]")
        ?.addEventListener("click", () => submitReset());
    overlay.querySelector<HTMLElement>("[data-action=reset-confirm]")
        ?.addEventListener("click", () => submitResetConfirm());

    overlay.querySelector<HTMLElement>("[data-action=go-register]")
        ?.addEventListener("click", () => switchMode("register-send"));
    overlay.querySelector<HTMLElement>("[data-action=go-login]")
        ?.addEventListener("click", () => switchMode("login", {email: loginStash}));
    overlay.querySelector<HTMLElement>("[data-action=forgot-password]")
        ?.addEventListener("click", () => {
            const currentEmail = fieldValue("login-email");
            switchMode("reset-send", {email: currentEmail});
        });
    overlay.querySelector<HTMLElement>("[data-action=resend]")
        ?.addEventListener("click", (event) => {
            const button = event.currentTarget as HTMLButtonElement;
            if (button.disabled) return;
            const path = activeMode === "reset-verify" ? "reset-send" : "register-verify";
            switchMode(path as Mode);
            renderInto();
            // 真实重新发送仍以用户重新点 submit 为准，避免重复发码
            showMessage("请重新提交发码请求", 2000);
            // 不自动 startCountdown —— 改为在重新点发送按钮后倒计时
            const newButton = overlay?.querySelector<HTMLButtonElement>(`[data-action="${activeMode === "reset-send" ? "reset-submit" : "register-submit"}"]`);
            if (newButton) startResendCountdown(newButton);
        });

    if (activeMode === "login" && loginStash) {
        setFieldValue("login-email", loginStash);
    }
    if (activeMode === "reset-send" && sentEmail) {
        setFieldValue("reset-email", sentEmail);
    }
    if (activeMode === "register-verify") {
        setFieldValue("reg-email", sentEmail);
    }
    if (activeMode === "reset-verify") {
        setFieldValue("reset-email", sentEmail);
    }
};

const submitLogin = () => {
    const email = fieldValue("login-email");
    const password = (overlay?.querySelector<HTMLInputElement>("[data-field=login-password]")?.value ?? "");
    if (!email || !password) {
        showMessage("请填写邮箱与密码", 2000);
        return;
    }
    disableSubmit("login-submit", true);
    fetchPost("/api/account/login52Note", {email, password}, (response: IWebSocketData) => {
        window.siyuan.user = response.data;
        showMessage("登录成功", 1500);
        closeAccountDialog();
        onSetaccount();
    }, undefined, (response: IWebSocketData) => {
        showMessage(response?.msg ?? "登录失败", 3000);
    }).finally?.(() => {
        disableSubmit("login-submit", false);
    });
};

const submitRegister = () => {
    const email = fieldValue("reg-email");
    const name = fieldValue("reg-name");
    const password = overlay?.querySelector<HTMLInputElement>("[data-field=reg-password]")?.value ?? "";
    if (!email || !password) {
        showMessage("请填写邮箱与密码", 2000);
        return;
    }
    if (password.length < 8 || password.length > 128) {
        showMessage("密码长度需为 8-128 位", 3000);
        return;
    }
    disableSubmit("register-submit", true);
    fetchPost("/api/account/register52Note", {email, password, displayName: name}, () => {
        showMessage("注册请求已发送，请在邮箱查收验证码", 2500);
        switchMode("register-verify", {email});
    }, undefined, (response: IWebSocketData) => {
        showMessage(response?.msg ?? "注册失败", 3000);
    }).finally?.(() => {
        disableSubmit("register-submit", false);
    });
};

const submitVerifyRegister = () => {
    const email = fieldValue("reg-email");
    const code = (overlay?.querySelector<HTMLInputElement>("[data-field=verify-code]")?.value ?? "").trim();
    if (!email || !code) {
        showMessage("请输入 6 位验证码", 2000);
        return;
    }
    disableSubmit("verify-register", true);
    fetchPost("/api/account/verifyRegister52Note", {email, code}, (response: IWebSocketData) => {
        window.siyuan.user = response.data;
        showMessage("账号已激活，正在为你登录", 1500);
        closeAccountDialog();
        onSetaccount();
    }, undefined, (response: IWebSocketData) => {
        showMessage(response?.msg ?? "验证失败", 3000);
    }).finally?.(() => {
        disableSubmit("verify-register", false);
    });
};

const submitReset = () => {
    const email = fieldValue("reset-email");
    if (!email) {
        showMessage("请填写账号邮箱", 2000);
        return;
    }
    disableSubmit("reset-submit", true);
    fetchPost("/api/account/requestReset52Note", {email}, () => {
        showMessage("验证码已发送", 2500);
        switchMode("reset-verify", {email});
    }, undefined, (response: IWebSocketData) => {
        showMessage(response?.msg ?? "发送失败", 3000);
    }).finally?.(() => {
        disableSubmit("reset-submit", false);
    });
};

const submitResetConfirm = () => {
    const email = fieldValue("reset-email");
    const code = (overlay?.querySelector<HTMLInputElement>("[data-field=reset-code]")?.value ?? "").trim();
    const password = overlay?.querySelector<HTMLInputElement>("[data-field=reset-new-password]")?.value ?? "";
    if (!email || !code || !password) {
        showMessage("请填写验证码与新密码", 2000);
        return;
    }
    disableSubmit("reset-confirm", true);
    fetchPost("/api/account/confirmReset52Note", {email, code, newPassword: password}, () => {
        showMessage("密码已重置，请用新密码登录", 2500);
        switchMode("login", {email, saveLoginEmail: email});
    }, undefined, (response: IWebSocketData) => {
        showMessage(response?.msg ?? "重置失败", 3000);
    }).finally?.(() => {
        disableSubmit("reset-confirm", false);
    });
};
