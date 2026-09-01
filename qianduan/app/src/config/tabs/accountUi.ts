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

const genAccountHTML = () => {
    const user = window.siyuan.user;
    if (user) {
        const displayName = escapeHtml(user.userNickname || user.userName);
        const email = escapeHtml(user.userName);
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
    }

    return `<div id="configAccountMain" class="b3-label config-item">
    <div class="b3-form__space--small">
        <div class="b3-form__icon">
            <svg class="b3-form__icon-icon"><use xlink:href="#iconAccount"></use></svg>
            <input type="email" data-field="email" autocomplete="username" class="b3-text-field fn__block b3-form__icon-input" placeholder="${window.siyuan.languages.email}">
        </div>
        <div class="fn__hr--b"></div>
        <div class="b3-form__icon">
            <svg class="b3-form__icon-icon"><use xlink:href="#iconLock"></use></svg>
            <input type="password" data-field="password" minlength="8" maxlength="128" autocomplete="current-password" class="b3-text-field fn__block b3-form__icon-input" placeholder="${window.siyuan.languages.password}">
        </div>
        <div class="fn__hr--b"></div>
        <div class="b3-form__icon fn__none" data-register-field>
            <svg class="b3-form__icon-icon"><use xlink:href="#iconAccount"></use></svg>
            <input data-field="displayName" maxlength="80" autocomplete="name" class="b3-text-field fn__block b3-form__icon-input" placeholder="${window.siyuan.languages.name}">
        </div>
        <div class="fn__hr--b fn__none" data-register-field></div>
        <div class="fn__flex">
            <button class="b3-button fn__flex-1" data-action="login">${window.siyuan.languages.login}</button>
            <span class="fn__space"></span>
            <button class="b3-button b3-button--outline fn__flex-1" data-action="register">${window.siyuan.languages.register}</button>
        </div>
    </div>
</div>`;
};

const bindAccountEvents = (root: HTMLElement) => {
    const account = root.querySelector("#configAccountMain");
    if (!account) {
        return;
    }
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
        });
    });

    const email = account.querySelector<HTMLInputElement>("[data-field=email]");
    const password = account.querySelector<HTMLInputElement>("[data-field=password]");
    const displayName = account.querySelector<HTMLInputElement>("[data-field=displayName]");
    const loginButton = account.querySelector<HTMLButtonElement>("[data-action=login]");
    const registerButton = account.querySelector<HTMLButtonElement>("[data-action=register]");
    email?.focus();

    const submit = (register: boolean) => {
        if (!email?.checkValidity() || !password?.checkValidity()) {
            email?.reportValidity();
            password?.reportValidity();
            return;
        }
        if (register && !displayName?.value.trim()) {
            account.querySelectorAll("[data-register-field]").forEach((element) => element.classList.remove("fn__none"));
            displayName?.focus();
            return;
        }
        loginButton!.disabled = true;
        registerButton!.disabled = true;
        fetchPost(register ? "/api/account/register52Note" : "/api/account/login52Note", {
            email: email.value.trim(),
            password: password.value,
            displayName: displayName?.value.trim() || "",
        }, (response) => {
            window.siyuan.user = response.data;
            renderAccount(root);
            onSetaccount();
        }).finally(() => {
            if (loginButton?.isConnected) {
                loginButton.disabled = false;
                registerButton!.disabled = false;
            }
        });
    };

    loginButton?.addEventListener("click", () => submit(false));
    registerButton?.addEventListener("click", () => submit(true));
    password?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            submit(false);
        }
    });
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
