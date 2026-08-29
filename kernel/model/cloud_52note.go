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
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/88250/gulu"
	"github.com/klauspost/compress/zstd"
	"github.com/siyuan-note/dejavu/cloud"
	"github.com/siyuan-note/dejavu/entity"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const noteCloudPageSize = 32

var noteCloudPushEnabled = false

var noteCloudRefreshLock sync.Mutex

var noteCloudHTTPClient = &http.Client{Timeout: 5 * time.Minute}

type noteCloud struct {
	*cloud.BaseCloud
	workspaceID string
}

type noteCloudPathObject struct {
	Path      string    `json:"path"`
	Hash      string    `json:"hash"`
	SizeBytes int64     `json:"size_bytes"`
	UpdatedAt time.Time `json:"updated_at"`
}

type noteCloudPathList struct {
	Objects []noteCloudPathObject `json:"objects"`
}

type noteCloudLinkResult struct {
	Object  noteCloudPathObject `json:"object"`
	Changed bool                `json:"changed"`
}

func new52NoteCloud(base *cloud.BaseCloud, workspaceID string) cloud.Cloud {
	return &noteCloud{BaseCloud: base, workspaceID: workspaceID}
}

func (n *noteCloud) CreateRepo(string) error { return nil }

func (n *noteCloud) RemoveRepo(string) error { return cloud.ErrUnsupported }

func (n *noteCloud) GetRepos() ([]*cloud.Repo, int64, error) {
	stat, err := n.GetStat()
	if err != nil {
		return nil, 0, err
	}
	return []*cloud.Repo{{Name: n.Conf.Dir, Size: stat.Sync.Size, Updated: stat.Sync.Updated}}, stat.Sync.Size, nil
}

func (n *noteCloud) UploadObject(filePath string, overwrite bool) (int64, error) {
	data, err := os.ReadFile(filepath.Join(n.Conf.RepoPath, filepath.FromSlash(filePath)))
	if err != nil {
		return 0, err
	}
	return n.UploadBytes(filePath, data, overwrite)
}

func (n *noteCloud) UploadBytes(filePath string, data []byte, overwrite bool) (int64, error) {
	digest := sha256.Sum256(data)
	hash := hex.EncodeToString(digest[:])
	objectEndpoint := fmt.Sprintf("/api/v1/workspaces/%s/objects/%s?kind=chunk", url.PathEscape(n.workspaceID), hash)
	if _, _, err := n.request(http.MethodPut, objectEndpoint, data, "application/octet-stream"); err != nil {
		return 0, err
	}
	payload, _ := json.Marshal(map[string]any{"path": filePath, "hash": hash, "overwrite": overwrite})
	response, _, err := n.request(http.MethodPut, fmt.Sprintf("/api/v1/workspaces/%s/dejavu/path", url.PathEscape(n.workspaceID)), payload, "application/json")
	if err != nil {
		return 0, err
	}
	var result noteCloudLinkResult
	if err = json.Unmarshal(response, &result); err != nil {
		return 0, err
	}
	if !result.Changed {
		return 0, nil
	}
	return int64(len(data)), nil
}

func (n *noteCloud) DownloadObject(filePath string) ([]byte, error) {
	metadata, err := n.pathObject(filePath)
	if err != nil {
		return nil, err
	}
	endpoint := fmt.Sprintf("/api/v1/workspaces/%s/objects/%s", url.PathEscape(n.workspaceID), metadata.Hash)
	data, _, err := n.request(http.MethodGet, endpoint, nil, "")
	return data, err
}

func (n *noteCloud) RemoveObject(filePath string) error {
	endpoint := fmt.Sprintf("/api/v1/workspaces/%s/dejavu/path?path=%s", url.PathEscape(n.workspaceID), url.QueryEscape(filePath))
	_, status, err := n.request(http.MethodDelete, endpoint, nil, "")
	if err != nil && status != http.StatusNotFound {
		return err
	}
	return nil
}

func (n *noteCloud) ListObjects(prefix string) (map[string]*entity.ObjectInfo, error) {
	endpoint := fmt.Sprintf("/api/v1/workspaces/%s/dejavu/paths?prefix=%s", url.PathEscape(n.workspaceID), url.QueryEscape(prefix))
	data, _, err := n.request(http.MethodGet, endpoint, nil, "")
	if err != nil {
		return nil, err
	}
	var result noteCloudPathList
	if err = json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	ret := make(map[string]*entity.ObjectInfo, len(result.Objects))
	for _, item := range result.Objects {
		relative := strings.TrimPrefix(item.Path, prefix)
		ret[relative] = &entity.ObjectInfo{Path: relative, Size: item.SizeBytes}
	}
	return ret, nil
}

func (n *noteCloud) GetTags() ([]*cloud.Ref, error) {
	return n.listRefs("tags/")
}

func (n *noteCloud) GetIndexes(pageNumber int) ([]*entity.Index, int, int, error) {
	data, err := n.DownloadObject("indexes-v2.json")
	if errors.Is(err, cloud.ErrCloudObjectNotFound) {
		return []*entity.Index{}, 0, 0, nil
	}
	if err != nil {
		return nil, 0, 0, err
	}
	decoded, err := decode52NoteCloud(data)
	if err != nil {
		return nil, 0, 0, err
	}
	var indexList cloud.Indexes
	if err = gulu.JSON.UnmarshalJSON(decoded, &indexList); err != nil {
		return nil, 0, 0, err
	}
	total := len(indexList.Indexes)
	pages := int(math.Ceil(float64(total) / float64(noteCloudPageSize)))
	start := (pageNumber - 1) * noteCloudPageSize
	if start < 0 || start >= total {
		return []*entity.Index{}, pages, total, nil
	}
	end := start + noteCloudPageSize
	if end > total {
		end = total
	}
	ret := make([]*entity.Index, 0, end-start)
	for _, summary := range indexList.Indexes[start:end] {
		index, getErr := n.GetIndex(summary.ID)
		if getErr != nil {
			continue
		}
		index.Files = nil
		ret = append(ret, index)
	}
	return ret, pages, total, nil
}

func (n *noteCloud) GetRefsFiles() ([]string, []*cloud.Ref, error) {
	refs, err := n.listRefs("")
	if err != nil {
		return nil, nil, err
	}
	files := make([]string, 0)
	for _, ref := range refs {
		index, getErr := n.GetIndex(ref.ID)
		if getErr != nil {
			return nil, nil, getErr
		}
		files = append(files, index.Files...)
	}
	return gulu.Str.RemoveDuplicatedElem(files), refs, nil
}

func (n *noteCloud) GetChunks(checkChunkIDs []string) ([]string, error) {
	objects, err := n.ListObjects("objects/")
	if err != nil {
		return nil, err
	}
	missing := make([]string, 0)
	for _, id := range checkChunkIDs {
		if len(id) < 3 {
			continue
		}
		if _, exists := objects[path.Join(id[:2], id[2:])]; !exists {
			missing = append(missing, id)
		}
	}
	return gulu.Str.RemoveDuplicatedElem(missing), nil
}

func (n *noteCloud) GetStat() (*cloud.Stat, error) {
	objects, err := n.listPathObjects("")
	if err != nil {
		return nil, err
	}
	var size int64
	var updated time.Time
	for _, item := range objects {
		size += item.SizeBytes
		if item.UpdatedAt.After(updated) {
			updated = item.UpdatedAt
		}
	}
	return &cloud.Stat{Sync: &cloud.StatSync{Size: size, FileCount: len(objects), Updated: updated.Local().Format("2006-01-02 15:04:05")}, Backup: &cloud.StatBackup{}}, nil
}

func (n *noteCloud) GetIndex(id string) (*entity.Index, error) {
	data, err := n.DownloadObject(path.Join("indexes", id))
	if err != nil {
		return nil, err
	}
	decoded, err := decode52NoteCloud(data)
	if err != nil {
		return nil, err
	}
	var index entity.Index
	if err = gulu.JSON.UnmarshalJSON(decoded, &index); err != nil {
		return nil, err
	}
	return &index, nil
}

func (n *noteCloud) GetConcurrentReqs() int { return 8 }

func (n *noteCloud) listRefs(subPrefix string) ([]*cloud.Ref, error) {
	objects, err := n.listPathObjects("refs/" + subPrefix)
	if err != nil {
		return nil, err
	}
	refs := make([]*cloud.Ref, 0, len(objects))
	for _, object := range objects {
		data, getErr := n.DownloadObject(object.Path)
		if getErr != nil {
			return nil, getErr
		}
		refs = append(refs, &cloud.Ref{Name: strings.TrimPrefix(object.Path, "refs/"+subPrefix), ID: string(data), Updated: object.UpdatedAt.Local().Format("2006-01-02 15:04:05")})
	}
	sort.Slice(refs, func(i, j int) bool { return refs[i].Name < refs[j].Name })
	return refs, nil
}

func (n *noteCloud) listPathObjects(prefix string) ([]noteCloudPathObject, error) {
	endpoint := fmt.Sprintf("/api/v1/workspaces/%s/dejavu/paths?prefix=%s", url.PathEscape(n.workspaceID), url.QueryEscape(prefix))
	data, _, err := n.request(http.MethodGet, endpoint, nil, "")
	if err != nil {
		return nil, err
	}
	var result noteCloudPathList
	err = json.Unmarshal(data, &result)
	return result.Objects, err
}

func (n *noteCloud) pathObject(filePath string) (noteCloudPathObject, error) {
	endpoint := fmt.Sprintf("/api/v1/workspaces/%s/dejavu/path?path=%s", url.PathEscape(n.workspaceID), url.QueryEscape(filePath))
	data, _, err := n.request(http.MethodGet, endpoint, nil, "")
	if err != nil {
		return noteCloudPathObject{}, err
	}
	var ret noteCloudPathObject
	err = json.Unmarshal(data, &ret)
	return ret, err
}

func (n *noteCloud) request(method, endpoint string, body []byte, contentType string) ([]byte, int, error) {
	for attempt := 0; attempt < 2; attempt++ {
		user := Conf.GetUser()
		if user == nil || user.UserToken == "" {
			return nil, http.StatusUnauthorized, cloud.ErrCloudAuthFailed
		}
		usedToken := user.UserToken
		request, err := http.NewRequest(method, noteAccountServer+endpoint, bytes.NewReader(body))
		if err != nil {
			return nil, 0, err
		}
		request.Header.Set("Accept", "application/json, application/octet-stream")
		request.Header.Set("Authorization", "Bearer "+usedToken)
		request.Header.Set("User-Agent", util.UserAgent)
		if contentType != "" {
			request.Header.Set("Content-Type", contentType)
		}
		response, err := noteCloudHTTPClient.Do(request)
		if err != nil {
			return nil, 0, cloud.ErrCloudServiceUnavailable
		}
		data, readErr := io.ReadAll(response.Body)
		response.Body.Close()
		if readErr != nil {
			return nil, response.StatusCode, readErr
		}
		if response.StatusCode == http.StatusUnauthorized && attempt == 0 {
			noteCloudRefreshLock.Lock()
			current := Conf.GetUser()
			refreshErr := error(nil)
			if current == nil {
				refreshErr = cloud.ErrCloudAuthFailed
			} else if current.UserToken == usedToken {
				refreshErr = Refresh52NoteUser("")
			}
			noteCloudRefreshLock.Unlock()
			if refreshErr == nil {
				continue
			}
		}
		if response.StatusCode >= 200 && response.StatusCode < 300 {
			return data, response.StatusCode, nil
		}
		if response.StatusCode == http.StatusNotFound {
			return nil, response.StatusCode, cloud.ErrCloudObjectNotFound
		}
		if response.StatusCode == http.StatusUnauthorized {
			return nil, response.StatusCode, cloud.ErrCloudAuthFailed
		}
		if response.StatusCode == http.StatusForbidden {
			return nil, response.StatusCode, cloud.ErrCloudForbidden
		}
		if response.StatusCode == http.StatusTooManyRequests {
			return nil, response.StatusCode, cloud.ErrCloudTooManyRequests
		}
		return nil, response.StatusCode, fmt.Errorf("52Note cloud HTTP %d", response.StatusCode)
	}
	return nil, http.StatusUnauthorized, cloud.ErrCloudAuthFailed
}

func decode52NoteCloud(data []byte) ([]byte, error) {
	decoder, err := zstd.NewReader(nil)
	if err != nil {
		return nil, err
	}
	defer decoder.Close()
	return decoder.DecodeAll(data, nil)
}
