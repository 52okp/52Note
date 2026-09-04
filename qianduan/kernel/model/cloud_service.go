// SiYuan - From thought to insight, with agents
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package model

import (
	"encoding/hex"
	"errors"

	"time"

	"github.com/88250/gulu"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/conf"

	"github.com/siyuan-note/siyuan/kernel/util"
)

var ErrFailedToConnectCloudServer = errors.New("failed to connect cloud server")

func RefreshCheckJob2H() {
	go refreshUser()
}

func RefreshCheckJob6H() {
	go refreshCheckDownloadInstallPkg()
}

func refreshUser() {
	defer logging.Recover()

	if nil != Conf.GetUser() {
		time.Sleep(2 * time.Minute)
		if nil != Conf.GetUser() {
			_ = Refresh52NoteUser(Conf.GetUser().UserToken)
		}
	}
}

func refreshCheckDownloadInstallPkg() {
	defer logging.Recover()

	time.Sleep(3 * time.Minute)
	checkDownloadInstallPkg(true)
}

// 与 52Note 登录态一致：本机静态数据统一用每设备随机密钥加密。

func loadUserFromConf() *conf.User {
	if "" == Conf.UserData {
		return nil
	}

	data := util.UnsealLocal(Conf.UserData)
	data, _ = hex.DecodeString(string(data))
	var source map[string]any
	if err := gulu.JSON.UnmarshalJSON(data, &source); err != nil {
		return nil
	}
	if is52Note, ok := source["is52NoteUser"].(bool); !ok || !is52Note {
		return nil
	}
	user := &conf.User{}
	if err := gulu.JSON.UnmarshalJSON(data, &user); err == nil {
		return user
	}
	return nil
}

func LogoutUser() {
	noteAccountLock.Lock()
	defer noteAccountLock.Unlock()
	hadUser := nil != Conf.GetUser()
	Conf.UserData = ""
	Conf.SetUser(nil)
	Conf.Save()
	if hadUser {
		refreshLANSyncManager()
	}
}
