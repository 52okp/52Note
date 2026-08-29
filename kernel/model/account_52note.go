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
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/88250/gulu"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const noteAccountServer = "https://docs.52okp.com"

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

type noteWorkspace struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type noteWorkspaceList struct {
	Workspaces []noteWorkspace `json:"workspaces"`
}

type noteAccountError struct {
	Message string `json:"message"`
}

func Register52Note(email, password, displayName string) error {
	return authenticate52Note("/api/v1/auth/register", email, password, displayName)
}

func Login52Note(email, password string) error {
	return authenticate52Note("/api/v1/auth/login", email, password, "")
}

func authenticate52Note(endpoint, email, password, displayName string) error {
	hostname, _ := os.Hostname()
	if strings.TrimSpace(hostname) == "" {
		hostname = "52Note"
	}
	payload := map[string]string{
		"email":        strings.TrimSpace(email),
		"password":     password,
		"display_name": strings.TrimSpace(displayName),
		"device_name":  hostname,
		"platform":     account52NotePlatform(),
	}
	var result noteAccountResult
	if err := request52Note(http.MethodPost, endpoint, payload, "", &result); err != nil {
		return err
	}
	workspaceID, err := ensure52NoteWorkspace(result.Tokens.AccessToken)
	if err != nil {
		_ = request52Note(http.MethodPost, "/api/v1/auth/logout", map[string]string{
			"refresh_token": result.Tokens.RefreshToken,
		}, "", nil)
		return err
	}
	store52NoteUser(result.User, result.Tokens, workspaceID)
	return nil
}

func account52NotePlatform() string {
	switch runtime.GOOS {
	case "darwin":
		return "macos"
	case "windows", "android", "ios", "linux":
		return runtime.GOOS
	default:
		return "other"
	}
}

func Refresh52NoteUser(accessToken string) error {
	current := Conf.GetUser()
	if current == nil {
		return nil
	}
	if accessToken == "" {
		accessToken = current.UserToken
	}
	var user noteAccountUser
	err := request52Note(http.MethodGet, "/api/v1/users/me", nil, accessToken, &user)
	if err == nil {
		workspaceID := current.UserWorkspaceID
		if workspaceID == "" {
			workspaceID, err = ensure52NoteWorkspace(accessToken)
			if err != nil {
				return err
			}
		}
		store52NoteUser(user, noteAccountTokens{
			AccessToken:  current.UserToken,
			RefreshToken: current.UserRefreshToken,
			ExpiresAt:    parse52NoteExpiry(current.UserTokenExpireTime),
		}, workspaceID)
		return nil
	}
	if current.UserRefreshToken == "" {
		return err
	}
	var tokens noteAccountTokens
	if refreshErr := request52Note(http.MethodPost, "/api/v1/auth/refresh", map[string]string{
		"refresh_token": current.UserRefreshToken,
	}, "", &tokens); refreshErr != nil {
		return refreshErr
	}
	if err = request52Note(http.MethodGet, "/api/v1/users/me", nil, tokens.AccessToken, &user); err != nil {
		return err
	}
	workspaceID := current.UserWorkspaceID
	if workspaceID == "" {
		workspaceID, err = ensure52NoteWorkspace(tokens.AccessToken)
		if err != nil {
			return err
		}
	}
	store52NoteUser(user, tokens, workspaceID)
	return nil
}

func Logout52Note() {
	user := Conf.GetUser()
	if user != nil && user.UserRefreshToken != "" {
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
			return errors.New(apiError.Message)
		}
		return fmt.Errorf("%s: HTTP %d", Conf.Language(18), response.StatusCode)
	}
	if destination == nil || response.StatusCode == http.StatusNoContent {
		return nil
	}
	return json.NewDecoder(response.Body).Decode(destination)
}

func ensure52NoteWorkspace(accessToken string) (string, error) {
	var list noteWorkspaceList
	if err := request52Note(http.MethodGet, "/api/v1/workspaces", nil, accessToken, &list); err != nil {
		return "", err
	}
	if len(list.Workspaces) > 0 {
		return list.Workspaces[0].ID, nil
	}
	var workspace noteWorkspace
	if err := request52Note(http.MethodPost, "/api/v1/workspaces", map[string]string{"name": "main"}, accessToken, &workspace); err != nil {
		return "", err
	}
	return workspace.ID, nil
}

func store52NoteUser(user noteAccountUser, tokens noteAccountTokens, workspaceID string) {
	current := &conf.User{
		UserId:              user.ID,
		UserName:            user.Email,
		UserNickname:        user.DisplayName,
		UserCreateTime:      user.CreatedAt.Format(time.RFC3339),
		UserToken:           tokens.AccessToken,
		UserRefreshToken:    tokens.RefreshToken,
		UserWorkspaceID:     workspaceID,
		UserTokenExpireTime: strconv.FormatInt(tokens.ExpiresAt.Unix(), 10),
		// 复用当前内核对官方同步提供商的功能开关。52Note 的订阅和配额由自有后端管理，
		// 不读取思源官方账号的订阅字段。
		UserSiYuanProExpireTime:      -1,
		UserSiYuanSubscriptionStatus: 0,
		UserTitles:                   []*conf.UserTitle{},
	}
	Conf.SetUser(current)
	data, _ := gulu.JSON.MarshalJSON(current)
	Conf.UserData = util.AESEncrypt(string(data))
	Conf.Save()
}

func parse52NoteExpiry(value string) time.Time {
	seconds, _ := strconv.ParseInt(value, 10, 64)
	return time.Unix(seconds, 0)
}
