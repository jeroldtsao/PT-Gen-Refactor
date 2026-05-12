import {DOUBAN_REQUEST_HEADERS_BASE, ANTI_BOT_PATTERNS} from "./constants.js";

/**
 * Checks if the given text matches anti-bot detection patterns.
 * 检查给定文本是否匹配反机器人检测模式。
 *
 * @param {string} text - The text content to check for bot detection (要检查机器人检测的文本内容)
 * @returns {boolean} True if anti-bot pattern is detected, false otherwise (如果检测到反机器人模式则返回 true，否则返回 false)
 */
export const isAntiBot = (text) => text && ANTI_BOT_PATTERNS.test(text);

/**
 * Generates HTTP headers for Douban API requests with optional cookie authentication.
 * 生成带有可选 Cookie 认证的豆瓣 API 请求 HTTP 头。
 *
 * @param {Object} [env={}] - Environment object that may contain DOUBAN_COOKIE (可能包含 DOUBAN_COOKIE 的环境对象)
 * @returns {Object} HTTP headers object with base headers and optional cookie (包含基础头和可选 Cookie 的 HTTP 头对象)
 */
export const getDouBanHeaders = (env = {}) => ({
    ...DOUBAN_REQUEST_HEADERS_BASE,
    ...(env?.DOUBAN_COOKIE && {Cookie: env.DOUBAN_COOKIE}),
});

/**
 * Generates HTTP headers for IMDb API requests with browser-like User-Agent.
 * Uses closure caching to avoid recreating headers on each call.
 * Note: Googlebot UA triggers AWS WAF challenge, using normal browser UA instead.
 * 生成带有浏览器 User-Agent 的 IMDb API 请求 HTTP 头。
 * 使用闭包缓存避免每次调用时重新创建头信息。
 * 注意：Googlebot UA 会触发 AWS WAF 挑战，改用普通浏览器 UA。
 *
 * @returns {Object} HTTP headers object optimized for IMDb scraping (针对 IMDb 爬取优化的 HTTP 头对象)
 */
export const getImdbHeaders = (() => {
    let cachedHeaders = null;
    return () => {
        if (cachedHeaders) return {...cachedHeaders};

        cachedHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
            Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "sec-ch-ua":
                '"Chromium";v="139", "Google Chrome";v="139", "Not_A Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "Cache-Control": "max-age=0",
            Priority: "u=0, i",
        };

        return {...cachedHeaders};
    };
})();