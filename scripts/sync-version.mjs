#!/usr/bin/env node

/**
 * 版本同步脚本
 * 从根目录 package.json 读取版本号并同步到：
 * - worker/src/core/constants.js (后端)
 * - frontend/package.json (前端)
 * - VERSION.md (文档头部)
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT_DIR = resolve(process.cwd());
const ROOT_PACKAGE_JSON = resolve(ROOT_DIR, 'package.json');
const WORKER_CONSTANTS = resolve(ROOT_DIR, 'worker/src/core/constants.js');
const FRONTEND_PACKAGE_JSON = resolve(ROOT_DIR, 'frontend/package.json');
const VERSION_MD = resolve(ROOT_DIR, 'VERSION.md');

// 读取根目录 package.json
const rootPackage = JSON.parse(readFileSync(ROOT_PACKAGE_JSON, 'utf-8'));
const version = rootPackage.version;

console.log(`📦 当前版本: ${version}`);

// 1. 同步 worker/src/core/constants.js
let constantsContent = readFileSync(WORKER_CONSTANTS, 'utf-8');
const versionRegex = /export const VERSION = "[\d.]+";/;
if (versionRegex.test(constantsContent)) {
    constantsContent = constantsContent.replace(
        versionRegex,
        `export const VERSION = "${version}";`
    );
    writeFileSync(WORKER_CONSTANTS, constantsContent);
    console.log('✅ 已同步 worker/src/core/constants.js');
} else {
    console.log('⚠️  worker/src/core/constants.js 中未找到 VERSION 常量');
}

// 2. 同步 frontend/package.json
const frontendPackage = JSON.parse(readFileSync(FRONTEND_PACKAGE_JSON, 'utf-8'));
frontendPackage.version = version;
writeFileSync(FRONTEND_PACKAGE_JSON, JSON.stringify(frontendPackage, null, 2) + '\n');
console.log('✅ 已同步 frontend/package.json');

// 3. 同步 VERSION.md 头部版本信息
let versionMdContent = readFileSync(VERSION_MD, 'utf-8');
const versionMdRegex = /## v[\d.]+ \(当前版本\)/;
if (versionMdRegex.test(versionMdContent)) {
    versionMdContent = versionMdContent.replace(
        versionMdRegex,
        `## v${version} (当前版本)`
    );
    writeFileSync(VERSION_MD, versionMdContent);
    console.log('✅ 已同步 VERSION.md');
} else {
    console.log('⚠️  VERSION.md 格式不匹配，请手动更新');
}

console.log('\n🎉 版本同步完成！');
console.log(`   版本号: ${version}`);
console.log('   同步位置:');
console.log('   - worker/src/core/constants.js');
console.log('   - frontend/package.json');
console.log('   - VERSION.md');