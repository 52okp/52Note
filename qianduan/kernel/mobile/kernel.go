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

package mobile

import (
	"encoding/json"
	"fmt"

	"net/url"
	"os"
	"path/filepath"

	"strings"
	"time"

	"github.com/88250/gulu"
	"github.com/88250/lute/ast"
	"github.com/siyuan-note/filelock"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/cache"
	"github.com/siyuan-note/siyuan/kernel/job"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/plugin"
	"github.com/siyuan-note/siyuan/kernel/server"
	"github.com/siyuan-note/siyuan/kernel/sql"
	"github.com/siyuan-note/siyuan/kernel/util"
	_ "golang.org/x/mobile/bind"
)

// AcquireExportFile 获取移动端导出租约，返回 JSON 格式的路径、名称和租约 ID。
func AcquireExportFile(exportPath string) string {
	lease, err := model.AcquireMobileExportLease(exportPath)
	if err != nil {
		logging.LogErrorf("acquire export file [%s] failed: %s", exportPath, err)
		return ""
	}
	data, err := json.Marshal(lease)
	if err != nil {
		model.ReleaseMobileExportLease(lease.ID)
		return ""
	}
	return string(data)
}

// ReleaseExportFile 释放 AcquireExportFile 返回的租约。
func ReleaseExportFile(leaseID string) {
	model.ReleaseMobileExportLease(leaseID)
}

// LANSyncDiscoveryInfo 返回原生 Bonjour 发现需要发布的服务信息。
func LANSyncDiscoveryInfo() string {
	info := model.GetLANSyncDiscoveryInfo()
	if nil == info {
		return ""
	}
	data, err := json.Marshal(info)
	if nil != err {
		return ""
	}
	return string(data)
}

// AddLANSyncPeer 将原生 Bonjour 发现的设备交给内核验证。
func AddLANSyncPeer(instance, address string, port int, txtJSON string) bool {
	txt := map[string]string{}
	if err := json.Unmarshal([]byte(txtJSON), &txt); nil != err {
		return false
	}
	return model.AddLANSyncPeer(instance, address, port, txt)
}

// RemoveLANSyncPeer 将原生 Bonjour 移除的设备从内核中删除。
func RemoveLANSyncPeer(instance string) bool {
	return model.RemoveLANSyncPeer(instance)
}

// LANSyncActive 返回局域网同步服务是否正在运行。
func LANSyncActive() bool {
	return model.LANSyncActive()
}

// UpdateLocalIPs 更新原生容器提供的局域网地址并刷新局域网同步服务。
func UpdateLocalIPs(localIPs string) {
	util.SetLocalIPs(strings.Split(localIPs, ","))
	model.RefreshLANSyncNetwork()
}

// GetExportFileName 返回普通导出的资源名称；加密导出应读取 AcquireExportFile 返回的 Name。
func GetExportFileName(exportPath string) string {
	return model.GetMobileExportName(exportPath)
}

func StartKernelFast(container, appDir, workspaceBaseDir, localIPs string) {
	model.InitJwtKey()
	go server.Serve(true, model.Conf.CookieKey)
}

func StartKernel(container, appDir, workspaceBaseDir, timezoneID, localIPs, lang, osVer string) {
	model.InitJwtKey()
	SetTimezone(container, appDir, timezoneID)
	util.Mode = "prod"
	util.MobileOSVer = osVer
	util.SetLocalIPs(strings.Split(localIPs, ","))
	util.BootMobile(container, appDir, workspaceBaseDir, lang)

	model.InitConf()
	go server.Serve(false, model.Conf.CookieKey)
	go func() {
		model.InitAppearance()
		sql.InitDatabase(false)
		sql.InitHistoryDatabase(false)
		sql.InitAssetContentDatabase(false)
		sql.SetCaseSensitive(model.Conf.Search.CaseSensitive)
		sql.SetIndexAssetPath(model.Conf.Search.IndexAssetPath)

		model.BootSyncData()
		model.InitBoxes()
		model.LoadFlashcards()
		util.LoadAssetsTexts()

		util.SetBooted()
		util.PushClearAllMsg()

		job.StartCron()
		go model.AutoGenerateFileHistory()
		go cache.LoadAssets()
		go plugin.InitManager()
		go model.StartEmbeddingIndexer()
	}()
}

func Language(num int) string {
	return model.Conf.Language(num)
}

func ShowMsg(msg string, timeout int) {
	util.PushMsg(msg, timeout)
}

func IsHttpServing() bool {
	return util.HttpServing
}

func SetHttpServerPort(port int) {
	filelock.AndroidServerPort = port
}

func GetCurrentWorkspacePath() string {
	return util.WorkspaceDir
}

func GetAssetAbsPath(asset string) (ret string) {
	ret, err := model.GetAssetAbsPath(asset)
	if err != nil {
		logging.LogErrorf("get asset [%s] abs path failed: %s", asset, err)
		ret = asset
	}
	return
}

func GetMimeTypeByExt(ext string) string {
	return util.GetMimeTypeByExt(ext)
}

func SetTimezone(container, appDir, timezoneID string) {
	if "ios" == container {
		os.Setenv("ZONEINFO", filepath.Join(appDir, "app", "zoneinfo.zip"))
	}
	z, err := time.LoadLocation(strings.TrimSpace(timezoneID))
	if err != nil {
		fmt.Printf("load location failed: %s\n", err)
		time.Local = time.FixedZone("CST", 8*3600)
		return
	}
	time.Local = z
}

func DisableFeature(feature string) {
	util.DisableFeature(feature)
}

func FilepathBase(path string) string {
	return filepath.Base(path)
}

func FilterUploadFileName(name string) string {
	return util.FilterUploadFileName(name)
}

func AssetName(name string) string {
	return util.AssetName(name, ast.NewNodeID())
}

func HTML2Markdown(html string) string {
	return util.NewLute().HTML2Md(html)
}

func Unzip(zipFilePath, destination string) {
	if err := gulu.Zip.Unzip(zipFilePath, destination); nil != err {
		logging.LogErrorf("unzip [%s] failed: %s", zipFilePath, err)
		panic(err)
	}
}

// GetExportFilePath 解析导出文件绝对路径，绕过 HTTP 层以避免锁屏密码拦截。
// exportPath 格式为 "/export/xxx.zip" 或 "assets/xxx"。
// 返回文件在磁盘上的绝对路径，以便原生端分块拷贝，避免大文件内存溢出。
// 解析失败返回空字符串。
func GetExportFilePath(exportPath string) (ret string) {
	var absPath string
	if after, ok := strings.CutPrefix(exportPath, "/export/"); ok {
		fileName := after
		if decoded, err := url.PathUnescape(fileName); err == nil {
			fileName = decoded
		}
		fileName = filepath.Clean(fileName)
		if strings.HasPrefix(fileName, "..") {
			logging.LogWarnf("get export file path [%s] blocked: path traversal attempt [%s]", exportPath, fileName)
			return
		}
		// 加密导出需要持有覆盖原生复制过程的租约，旧路径解析接口不再返回其明文地址。
		if model.IsManagedEncryptedExportPath(fileName) {
			logging.LogWarnf("get export file path [%s] blocked: use AcquireExportFile for encrypted exports", exportPath)
			return
		}
		absPath = filepath.Join(util.TempDir, "export", fileName)
		exportBaseDir := filepath.Join(util.TempDir, "export")
		if !gulu.File.IsSubPath(exportBaseDir, absPath) {
			logging.LogWarnf("get export file path [%s] blocked: path [%s] is outside export base dir [%s]", exportPath, absPath, exportBaseDir)
			return
		}
	} else if strings.HasPrefix(exportPath, "assets/") {
		var err error
		absPath, err = model.GetAssetAbsPath(exportPath)
		if nil != err {
			logging.LogErrorf("get asset abs path [%s] failed: %s", exportPath, err)
			return
		}
	} else {
		logging.LogWarnf("get export file path [%s] failed: unsupported path prefix", exportPath)
		return
	}

	if "" == absPath {
		logging.LogWarnf("get export file path [%s] failed: resolved to empty abs path", exportPath)
		return
	}
	return absPath
}

func Exit() {
	os.Exit(logging.ExitCodeOk)
}
