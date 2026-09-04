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

package util

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
	"strings"
	"sync"

	"github.com/siyuan-note/logging"
)

var SK = []byte("696D897C9AA0611B")

// localSealPrefix 标识由每设备随机密钥（AES-256-GCM）加密的新格式密文。
const localSealPrefix = "v2:"

// localKeyMu 保护每设备密钥的惰性生成与缓存。
var localKeyMu sync.Mutex

// localKeyCache 进程内缓存的每设备密钥，nil 表示尚未加载。
var localKeyCache []byte

// localKeyPath 返回每设备密钥的落盘位置。与内核的用户级配置目录一致，
// 密钥跟随设备而非工作区：同一台设备上的所有工作区共享同一把本地密钥。
func localKeyPath() string {
	return filepath.Join(HomeDir, ".config", "siyuan", "device.key")
}

// loadOrCreateLocalKey 返回 32 字节的每设备随机密钥；不存在则生成并落盘
// （0600 权限，目录 0700）。任何失败（如移动端沙盒禁写）都返回错误，
// 调用方据此降级到旧方案，保证功能可用性不低于现状。
func loadOrCreateLocalKey() ([]byte, error) {
	localKeyMu.Lock()
	defer localKeyMu.Unlock()
	if localKeyCache != nil {
		return localKeyCache, nil
	}
	key, err := readOrCreateDeviceKey(localKeyPath())
	if err != nil {
		return nil, err
	}
	localKeyCache = key
	return key, nil
}

// SealLocal 用每设备随机密钥（AES-256-GCM）加密本机静态数据（登录态、
// API Key、OAuth 凭据等）。与旧方案 AESEncrypt（全网同一硬编码密钥）相比，
// conf.json 泄露后不再能被任何持有源码的人解密。密钥不可用时降级到旧方案，
// 保证功能可用性；解密侧 UnsealLocal 对两种格式都能透明处理。
// 与 AESEncrypt 相同，内部先对明文做一层 hex 打包，调用方无感替换。
func SealLocal(plaintext string) string {
	key, err := loadOrCreateLocalKey()
	if err != nil {
		logging.LogErrorf("load device key failed, fallback to legacy encryption: %s", err)
		return AESEncrypt(plaintext)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return AESEncrypt(plaintext)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return AESEncrypt(plaintext)
	}
	// 与 AESEncrypt 保持一致：先 hex 打包明文，再加密。
	buf := &bytes.Buffer{}
	buf.Grow(4096)
	if _, err = hex.NewEncoder(buf).Write([]byte(plaintext)); err != nil {
		logging.LogErrorf("hex encode plaintext failed, fallback to legacy encryption: %s", err)
		return AESEncrypt(plaintext)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return AESEncrypt(plaintext)
	}
	sealed := gcm.Seal(nil, nonce, buf.Bytes(), nil)
	return localSealPrefix + hex.EncodeToString(append(nonce, sealed...))
}

// UnsealLocal 解密 SealLocal 的密文；对不带前缀的旧格式（固定密钥 AES-CBC）
// 自动走 AESEncrypt/Decrypt 兼容路径，实现存量数据惰性迁移——旧密文仍可读，
// 下一次写回时自然升级为新格式。解密失败返回 nil（与 AESDecrypt 行为一致）。
func UnsealLocal(sealed string) []byte {
	if !strings.HasPrefix(sealed, localSealPrefix) {
		return AESDecrypt(sealed)
	}
	raw, err := hex.DecodeString(strings.TrimPrefix(sealed, localSealPrefix))
	if err != nil {
		logging.LogErrorf("decode local sealed data failed: %s", err)
		return nil
	}
	key, err := readDeviceKey(localKeyPath())
	if err != nil {
		logging.LogErrorf("load device key failed: %s", err)
		return nil
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil
	}
	if len(raw) < gcm.NonceSize() {
		logging.LogErrorf("local sealed data too short")
		return nil
	}
	plain, err := gcm.Open(nil, raw[:gcm.NonceSize()], raw[gcm.NonceSize():], nil)
	if err != nil {
		logging.LogErrorf("open local sealed data failed: %s", err)
		return nil
	}
	return plain
}

func AESEncrypt(str string) string {
	buf := &bytes.Buffer{}
	buf.Grow(4096)
	_, err := hex.NewEncoder(buf).Write([]byte(str))
	if err != nil {
		logging.LogErrorf("encrypt failed: %s", err)
		return ""
	}
	data := buf.Bytes()
	block, err := aes.NewCipher(SK)
	if err != nil {
		logging.LogErrorf("encrypt failed: %s", err)
		return ""
	}
	cbc := cipher.NewCBCEncrypter(block, []byte("RandomInitVector"))
	content := data
	content = pkcs5Padding(content, block.BlockSize())
	crypted := make([]byte, len(content))
	cbc.CryptBlocks(crypted, content)
	return hex.EncodeToString(crypted)
}

func pkcs5Padding(ciphertext []byte, blockSize int) []byte {
	padding := blockSize - len(ciphertext)%blockSize
	padtext := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(ciphertext, padtext...)
}

func AESDecrypt(cryptStr string) []byte {
	crypt, err := hex.DecodeString(cryptStr)
	if err != nil {
		logging.LogErrorf("decrypt failed: %s", err)
		return nil
	}

	block, err := aes.NewCipher(SK)
	if err != nil {
		return nil
	}
	if len(crypt) == 0 || len(crypt)%block.BlockSize() != 0 {
		return nil
	}
	cbc := cipher.NewCBCDecrypter(block, []byte("RandomInitVector"))
	decrypted := make([]byte, len(crypt))
	cbc.CryptBlocks(decrypted, crypt)
	return pkcs5Trimming(decrypted)
}

func pkcs5Trimming(encrypt []byte) []byte {
	if len(encrypt) == 0 {
		return nil
	}
	padding := encrypt[len(encrypt)-1]
	if padding == 0 || int(padding) > aes.BlockSize || int(padding) > len(encrypt) {
		return nil
	}
	for _, b := range encrypt[len(encrypt)-int(padding):] {
		if b != padding {
			return nil
		}
	}
	return encrypt[:len(encrypt)-int(padding)]
}

func SHA256Hash(data []byte) string {
	hash := sha256.New()
	hash.Write(data)
	return hex.EncodeToString(hash.Sum(nil))
}
