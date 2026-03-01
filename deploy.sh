#!/bin/bash
# WindoorDesigner 一键部署脚本
# 用法: ./deploy.sh
# 功能: 打包前端 -> 上传到服务器 -> 部署到Nginx

set -e

# ========== 配置区域 ==========
SERVER_IP="8.140.238.44"
SERVER_USER="root"
SERVER_PASS="#Liuda123456"
DEPLOY_PATH="/var/www/html/windows"
TEMP_ARCHIVE="/tmp/windoor-deploy.tar.gz"
# ==============================

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  WindoorDesigner 一键部署脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 请在项目根目录下运行此脚本${NC}"
    exit 1
fi

# 检查sshpass是否安装
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}正在安装 sshpass...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get install -y sshpass > /dev/null 2>&1
    elif command -v yum &> /dev/null; then
        sudo yum install -y sshpass > /dev/null 2>&1
    else
        echo -e "${RED}错误: 无法安装 sshpass，请手动安装${NC}"
        exit 1
    fi
fi

# Step 1: 打包构建
echo -e "${YELLOW}[1/4] 正在打包构建...${NC}"
pnpm build 2>&1 | tail -5
if [ ! -d "dist/public" ]; then
    echo -e "${RED}错误: 构建失败，dist/public 目录不存在${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ 构建完成${NC}"

# Step 2: 压缩构建产物
echo -e "${YELLOW}[2/4] 正在压缩构建产物...${NC}"
cd dist/public
tar -czf "$TEMP_ARCHIVE" .
cd ../..
ARCHIVE_SIZE=$(du -h "$TEMP_ARCHIVE" | cut -f1)
echo -e "${GREEN}  ✓ 压缩完成 (${ARCHIVE_SIZE})${NC}"

# Step 3: 上传到服务器
echo -e "${YELLOW}[3/4] 正在上传到服务器 ${SERVER_IP}...${NC}"
sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
    "$TEMP_ARCHIVE" "${SERVER_USER}@${SERVER_IP}:/tmp/windoor-deploy.tar.gz"
echo -e "${GREEN}  ✓ 上传完成${NC}"

# Step 4: 在服务器上部署
echo -e "${YELLOW}[4/4] 正在部署到服务器...${NC}"
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
    "${SERVER_USER}@${SERVER_IP}" << 'DEPLOY_COMMANDS'
    # 备份旧版本（保留最近3个备份）
    if [ -d "/var/www/html/windows" ]; then
        BACKUP_DIR="/var/www/html/windows_backup_$(date +%Y%m%d_%H%M%S)"
        cp -r /var/www/html/windows "$BACKUP_DIR"
        # 清理旧备份，只保留最近3个
        ls -dt /var/www/html/windows_backup_* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
    fi
    
    # 清空部署目录并解压新版本
    rm -rf /var/www/html/windows/*
    mkdir -p /var/www/html/windows
    tar -xzf /tmp/windoor-deploy.tar.gz -C /var/www/html/windows/
    
    # 清理临时文件
    rm -f /tmp/windoor-deploy.tar.gz
    
    # 重载Nginx
    nginx -t && nginx -s reload
    
    echo "DEPLOY_SUCCESS"
DEPLOY_COMMANDS

# 清理本地临时文件
rm -f "$TEMP_ARCHIVE"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署成功！${NC}"
echo -e "${GREEN}  访问地址: http://${SERVER_IP}/windows/${NC}"
echo -e "${GREEN}========================================${NC}"
