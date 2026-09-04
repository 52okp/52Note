// SiYuan - From thought to insight, with agents
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package model

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/88250/gulu"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const noteAccountServer = "https://docs.52okp.com"

var noteAccountLock sync.Mutex

var noteAccountHTTPClient = &http.Client{Timeout: 30 * time.Second}

type noteAccountUser struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
}

type noteAccountTokens struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type noteAccountResult struct {
	User   noteAccountUser   `json:"user"`
	Tokens noteAccountTokens `json:"tokens"`
}

type noteAccountError struct {
	Code    string `json:"error"`
	Message string `json:"message"`
}

// 服务端（52NoteAdmin）错误消息为英文，这里在客户端本地化为中文展示。
func localize52NoteAccountError(code, message string) string {
	if chinese, ok := map[string]string{
		"invalid_credentials": "邮箱或密码不正确",
		"email_exists":        "该邮箱已被注册",
		"email_not_verified":  "邮箱尚未验证，请先完成邮箱验证",
		"invalid_token":       "登录状态已失效，请重新登录",
		"invalid_request":     "请求参数有误",
		"not_found":           "资源不存在",
		"service_unavailable": "认证服务暂不可用，请稍后再试",
		"internal_error":      "服务器开小差了，请稍后再试",
	}[code]; ok {
		return chinese
	}
	// 校验类错误不带独立 code，按消息内容映射；未知消息保留原文。
	if chinese, ok := map[string]string{
		"password must contain 8 to 128 characters": "密码长度需为 8 到 128 个字符",
		"display name is too long":                  "昵称过长，请缩短后重试",
		"invalid email":                             "邮箱格式不正确",
		"email is already registered":               "该邮箱已被注册",
		"email or password is incorrect":            "邮箱或密码不正确",
		"email has not been verified yet":           "邮箱尚未验证，请先完成邮箱验证",
		"token is invalid or expired":               "登录状态已失效，请重新登录",
		"resource was not found":                    "资源不存在",
		"authentication service is unavailable":     "认证服务暂不可用，请稍后再试",
		"an internal error occurred":                "服务器开小差了，请稍后再试",
	}[message]; ok {
		return chinese
	}
	return message
}

// Register52Note 注册：服务端创建账号并向邮箱发送 6 位验证码；
// 验证前不签发令牌，需再调用 VerifyRegistration52Note 完成验证并登录。
func Register52Note(email, password, displayName string) error {
	payload := account52NotePayload(email, password, displayName)
	return request52Note(http.MethodPost, "/api/v1/auth/register", payload, "", nil)
}

// VerifyRegistration52Note 提交注册邮箱验证码：通过即创建会话并登录。
func VerifyRegistration52Note(email, code string) error {
	noteAccountLock.Lock()
	defer noteAccountLock.Unlock()
	payload := account52NoteCodePayload(email, code)
	var result noteAccountResult
	if err := request52Note(http.MethodPost, "/api/v1/auth/register/verify", payload, "", &result); err != nil {
		return err
	}
	return activate52Note(result)
}

// ResendRegistrationCode52Note 重发注册邮箱验证码。
func ResendRegistrationCode52Note(email string) error {
	return request52Note(http.MethodPost, "/api/v1/auth/register/verify/resend", map[string]string{
		"email": strings.TrimSpace(email),
	}, "", nil)
}

func Login52Note(email, password string) error {
	noteAccountLock.Lock()
	defer noteAccountLock.Unlock()
	payload := account52NotePayload(email, password, "")
	var result noteAccountResult
	if err := request52Note(http.MethodPost, "/api/v1/auth/login", payload, "", &result); err != nil {
		return err
	}
	return activate52Note(result)
}

// RequestLoginCode52Note 请求邮箱登录验证码。
func RequestLoginCode52Note(email string) error {
	payload := account52NoteEmailPayload(email)
	return request52Note(http.MethodPost, "/api/v1/auth/login-code/request", payload, "", nil)
}

// LoginWithCode52Note 用邮箱验证码登录。
func LoginWithCode52Note(email, code string) error {
	noteAccountLock.Lock()
	defer noteAccountLock.Unlock()
	payload := account52NoteCodePayload(email, code)
	var result noteAccountResult
	if err := request52Note(http.MethodPost, "/api/v1/auth/login-code/confirm", payload, "", &result); err != nil {
		return err
	}
	return activate52Note(result)
}

// RequestPasswordReset52Note 请求密码重置验证码。
func RequestPasswordReset52Note(email string) error {
	return request52Note(http.MethodPost, "/api/v1/auth/password-reset/request", map[string]string{
		"email": strings.TrimSpace(email),
	}, "", nil)
}

// ResetPassword52Note 用验证码重置密码。
func ResetPassword52Note(email, code, newPassword string) error {
	return request52Note(http.MethodPost, "/api/v1/auth/password-reset/confirm", map[string]string{
		"email":        strings.TrimSpace(email),
		"code":         strings.TrimSpace(code),
		"new_password": newPassword,
	}, "", nil)
}

// activate52Note 校验令牌并持久化登录态。
func activate52Note(result noteAccountResult) error {
	if result.Tokens.AccessToken == "" || result.Tokens.RefreshToken == "" {
		return errors.New(localize52NoteAccountError("invalid_token", "token is invalid or expired"))
	}
	return store52NoteUser(result.User, result.Tokens)
}

func Refresh52NoteUser(accessToken string) error {
	noteAccountLock.Lock()
	defer noteAccountLock.Unlock()
	current := Conf.GetUser()
	if current == nil || !current.Is52NoteUser {
		return nil
	}
	if err := Conf.SaveChecked(); err != nil {
		return err
	}
	if accessToken != "" && accessToken != current.UserToken {
		return nil
	}
	if accessToken == "" {
		accessToken = current.UserToken
	}
	var user noteAccountUser
	err := request52Note(http.MethodGet, "/api/v1/users/me", nil, accessToken, &user)
	if err == nil {
		return store52NoteUser(user, noteAccountTokens{
			AccessToken:  current.UserToken,
			RefreshToken: current.UserRefreshToken,
			ExpiresAt:    parse52NoteExpiry(current.UserTokenExpireTime),
		})
	}
	var responseError *noteHTTPError
	if !errors.As(err, &responseError) || responseError.Status != http.StatusUnauthorized || current.UserRefreshToken == "" {
		return err
	}
	var tokens noteAccountTokens
	if refreshErr := request52Note(http.MethodPost, "/api/v1/auth/refresh", map[string]string{
		"refresh_token": current.UserRefreshToken,
	}, "", &tokens); refreshErr != nil {
		return refreshErr
	}
	if tokens.AccessToken == "" || tokens.RefreshToken == "" {
		return errors.New("invalid refresh response")
	}
	if err = store52NoteUser(noteAccountUser{ID: current.UserId, Email: current.UserName, DisplayName: current.UserNickname}, tokens); err != nil {
		return err
	}
	if err = request52Note(http.MethodGet, "/api/v1/users/me", nil, tokens.AccessToken, &user); err != nil {
		return err
	}
	return store52NoteUser(user, tokens)
}

func Logout52Note() {
	noteAccountLock.Lock()
	defer noteAccountLock.Unlock()
	user := Conf.GetUser()
	if user != nil && user.Is52NoteUser && user.UserRefreshToken != "" {
		_ = request52Note(http.MethodPost, "/api/v1/auth/logout", map[string]string{
			"refresh_token": user.UserRefreshToken,
		}, "", nil)
	}
	Conf.UserData = ""
	Conf.SetUser(nil)
	Conf.Save()
}

func request52Note(method, endpoint string, payload any, accessToken string, destination any) error {
	var body *bytes.Reader
	if payload == nil {
		body = bytes.NewReader(nil)
	} else {
		data, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(data)
	}
	request, err := http.NewRequest(method, noteAccountServer+endpoint, body)
	if err != nil {
		return err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", util.UserAgent)
	if accessToken != "" {
		request.Header.Set("Authorization", "Bearer "+accessToken)
	}
	response, err := noteAccountHTTPClient.Do(request)
	if err != nil {
		return fmt.Errorf("%s: %w", Conf.Language(18), err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		var apiError noteAccountError
		_ = json.NewDecoder(response.Body).Decode(&apiError)
		if apiError.Message != "" {
			return &noteHTTPError{Status: response.StatusCode, Message: localize52NoteAccountError(apiError.Code, apiError.Message)}
		}
		return &noteHTTPError{Status: response.StatusCode, Message: fmt.Sprintf("%s: HTTP %d", Conf.Language(18), response.StatusCode)}
	}
	if destination == nil || response.StatusCode == http.StatusNoContent {
		return nil
	}
	return json.NewDecoder(response.Body).Decode(destination)
}

func store52NoteUser(user noteAccountUser, tokens noteAccountTokens) error {
	current := &conf.User{
		UserId:              user.ID,
		UserName:            user.Email,
		UserNickname:        user.DisplayName,
		UserCreateTime:      user.CreatedAt.Format(time.RFC3339),
		UserToken:           tokens.AccessToken,
		UserRefreshToken:    tokens.RefreshToken,
		UserTokenExpireTime: strconv.FormatInt(tokens.ExpiresAt.Unix(), 10),
		// 复用当前内核对官方同步提供商的功能开关。52Note 的订阅和配额由自有后端管理，
		// 不读取思源官方账号的订阅字段。
		UserSiYuanProExpireTime:      -1,
		UserSiYuanSubscriptionStatus: 0,
		UserTitles:                   []*conf.UserTitle{},
		Is52NoteUser:                 true,
	}

	data, _ := gulu.JSON.MarshalJSON(current)
	// 登录态只在本机 conf.json 落盘，使用每设备随机密钥加密，
	// 不再使用随源码公开的固定密钥（详见审查报告 S2）。
	sealed := util.SealLocal(string(data))
	if sealed == "" {
		return errors.New("could not encrypt session")
	}
	Conf.SetUser(current)
	Conf.UserData = sealed
	return Conf.SaveChecked()
}

func parse52NoteExpiry(value string) time.Time {
	seconds, _ := strconv.ParseInt(value, 10, 64)
	return time.Unix(seconds, 0)
}

type noteHTTPError struct {
	Status  int
	Message string
}

func (e *noteHTTPError) Error() string { return e.Message }
