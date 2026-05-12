import {VERSION, DEFAULT_TIMEOUT} from "../core/constants.js";
import {ApiError, NotFoundError, RateLimitError, ValidationError} from "../core/errors.js";
import {_withCache} from "./cache.js";
import logger from "../logger.js";

const WMDB_SEARCH_URL = "https://api.wmdb.tv/api/v1/movie/search";
const WMDB_DETAIL_URL = "https://api.wmdb.tv/movie/api";
const AVAILABLE_PARAMS = ["imdbid", "doubanid", "name", "year"];
const DEFAULT_SEARCH_LIMIT = 10;
const BRIDGE_SITE = "media_id_bridge";

const BRIDGE_HEADERS = Object.freeze({
    Accept: "application/json",
    "User-Agent": `PT-Gen-Refactor/${VERSION}`,
});

let providerModulePromise = null;

const getProviders = async () => {
    if (!providerModulePromise) {
        providerModulePromise = import("../api/index.js");
    }
    return providerModulePromise;
};

const isChineseText = (text) =>
    typeof text === "string" && /[\u3400-\u9fff\uf900-\ufaff]/.test(text);

const firstNonEmpty = (...values) => {
    for (const value of values) {
        if (value != null && String(value).trim() !== "") {
            return String(value).trim();
        }
    }
    return "";
};

const normalizeDoubanId = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (!/^\d+$/.test(raw)) return null;
    return raw;
};

const normalizeImdbId = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";

    const normalized = raw.replace(/^tt/i, "");
    if (!/^\d+$/.test(normalized)) {
        return null;
    }

    return `tt${normalized.padStart(7, "0")}`;
};

const normalizeYear = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (!/^\d{4}$/.test(raw)) return null;
    return raw;
};

const toDoubanIdValue = (value) => {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : "";
    }

    const raw = String(value ?? "").trim();
    if (!raw) return "";
    return /^\d+$/.test(raw) ? Number(raw) : raw;
};

const getLocalizedName = (item) => {
    const variants = Array.isArray(item?.data) ? item.data : [];

    for (const lang of ["Cn", "En"]) {
        const matched = variants.find(
            (entry) => entry?.lang === lang && String(entry?.name || "").trim(),
        );
        if (matched) {
            return String(matched.name).trim();
        }
    }

    const first = variants.find((entry) => String(entry?.name || "").trim());
    if (first) {
        return String(first.name).trim();
    }

    return firstNonEmpty(item?.name, item?.originalName);
};

const toBridgeItem = (item) => {
    if (!item || typeof item !== "object") {
        return null;
    }

    const doubanid = normalizeDoubanId(
        firstNonEmpty(item.doubanId, item.doubanid),
    );
    const imdbid = normalizeImdbId(firstNonEmpty(item.imdbId, item.imdbid));
    const year = firstNonEmpty(item.year);
    const name = getLocalizedName(item);

    if (!doubanid || !imdbid) {
        return null;
    }

    return {
        doubanid: toDoubanIdValue(doubanid),
        imdbid,
        name,
        year,
    };
};

const dedupeItems = (items) => {
    const seen = new Set();
    return items.filter((item) => {
        const key = `${item?.doubanid ?? ""}:${item?.imdbid ?? ""}`;
        if (!item || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
};

const fetchTextWithTimeout = async (url, options = {}, timeout = DEFAULT_TIMEOUT) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
};

const fetchWmdbJson = async (url, timeout = DEFAULT_TIMEOUT) => {
    const response = await fetchTextWithTimeout(
        url,
        {headers: BRIDGE_HEADERS},
        timeout,
    );
    const text = await response.text();

    if (
        response.status === 429 ||
        /Too Many Search|only allow one request/i.test(text)
    ) {
        throw new RateLimitError(
            "WMDB search rate limited. Please try again later.",
        );
    }

    if (/关闭此接口/.test(text)) {
        throw new ApiError("WMDB endpoint is unavailable.", 503);
    }

    if (!response.ok) {
        throw new ApiError(
            `WMDB request failed with status ${response.status}.`,
            response.status,
        );
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new ApiError("WMDB returned invalid JSON.", 502, {
            detail: error.message,
        });
    }
};

const buildSearchUrl = (name, year, lang) => {
    const url = new URL(WMDB_SEARCH_URL);
    url.searchParams.set("q", name);
    url.searchParams.set("limit", String(DEFAULT_SEARCH_LIMIT));
    url.searchParams.set("skip", "0");
    url.searchParams.set("lang", lang);
    if (year) {
        url.searchParams.set("year", year);
    }
    return url.toString();
};

const searchWmdbByName = async (name, year) => {
    const lang = isChineseText(name) ? "Cn" : "En";
    const payload = await fetchWmdbJson(buildSearchUrl(name, year, lang), 12000);
    const items = Array.isArray(payload?.data) ? payload.data : [];
    return dedupeItems(items.map(toBridgeItem).filter(Boolean));
};

const fetchWmdbByDoubanId = async (doubanid) => {
    const url = new URL(WMDB_DETAIL_URL);
    url.searchParams.set("id", doubanid);
    return toBridgeItem(await fetchWmdbJson(url.toString(), 12000));
};

const buildNameCandidates = (imdbData) => {
    const candidates = [
        imdbData?.original_title,
        imdbData?.name,
        imdbData?.title,
    ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);

    const seen = new Set();
    return candidates.filter((value) => {
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withSearchRetry = async (searchFn) => {
    try {
        return await searchFn();
    } catch (error) {
        if (!(error instanceof RateLimitError)) {
            throw error;
        }

        logger.warn("WMDB search hit rate limit, retrying once", {
            retry_after_ms: 10500,
        });
        await delay(10500);
        return await searchFn();
    }
};

const resolveByDoubanId = async (doubanid, env) =>
    _withCache(
        `douban_${doubanid}`,
        async () => {
            logger.info("Media ID Bridge: resolve by Douban ID", {doubanid});

            try {
                const item = await fetchWmdbByDoubanId(doubanid);
                if (item) {
                    return {
                        success: true,
                        site: BRIDGE_SITE,
                        query_type: "doubanid",
                        data: [item],
                    };
                }
            } catch (error) {
                logger.warn("WMDB Douban detail lookup failed", {
                    doubanid,
                    error: error.message,
                });
            }

            const {gen_douban} = await getProviders();
            const doubanData = await gen_douban(doubanid, env);
            const fallbackImdbId = normalizeImdbId(doubanData?.imdb_id);

            if (doubanData?.success && fallbackImdbId) {
                return {
                    success: true,
                    site: BRIDGE_SITE,
                    query_type: "doubanid",
                    data: [
                        {
                            doubanid: toDoubanIdValue(doubanid),
                            imdbid: fallbackImdbId,
                            name: firstNonEmpty(
                                doubanData?.chinese_title,
                                doubanData?.foreign_title,
                            ),
                            year: firstNonEmpty(doubanData?.year),
                        },
                    ],
                };
            }

            throw new NotFoundError("Not Found");
        },
        env,
        BRIDGE_SITE,
    );

const resolveByName = async (name, year, env) =>
    _withCache(
        `name_${name}_${year || "any"}`,
        async () => {
            logger.info("Media ID Bridge: resolve by name", {name, year});
            const data = await withSearchRetry(() => searchWmdbByName(name, year));

            if (data.length === 0) {
                throw new NotFoundError("Not Found");
            }

            return {
                success: true,
                site: BRIDGE_SITE,
                query_type: "name",
                data,
            };
        },
        env,
        BRIDGE_SITE,
    );

const resolveByImdbId = async (imdbid, env) =>
    _withCache(
        `imdb_${imdbid}`,
        async () => {
            logger.info("Media ID Bridge: resolve by IMDb ID", {imdbid});
            const {gen_imdb} = await getProviders();
            const imdbData = await gen_imdb(imdbid, env);

            if (!imdbData?.success) {
                throw new NotFoundError("Not Found");
            }

            const year = normalizeYear(imdbData?.year) || "";
            const candidates = buildNameCandidates(imdbData);

            for (const candidate of candidates) {
                const results = await withSearchRetry(() => searchWmdbByName(candidate, year));
                const exact = results.find((item) => item.imdbid === imdbid);
                if (exact) {
                    return {
                        success: true,
                        site: BRIDGE_SITE,
                        query_type: "imdbid",
                        data: [exact],
                    };
                }
            }

            throw new NotFoundError("Not Found");
        },
        env,
        BRIDGE_SITE,
    );

const extractRequestBody = async (request) => {
    if (request.method !== "POST") {
        return {};
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        return {};
    }

    try {
        const text = await request.clone().text();
        if (!text.trim()) {
            return {};
        }
        return JSON.parse(text);
    } catch (error) {
        throw new ValidationError(`Invalid JSON body: ${error.message}`);
    }
};

export const queryMediaIdBridge = async (request, env, url) => {
    if (!["GET", "POST"].includes(request.method)) {
        throw new ApiError("Method Not Allowed", 405);
    }

    const body = await extractRequestBody(request);
    const rawImdbId = firstNonEmpty(
        body.imdbid,
        body.imdbId,
        url.searchParams.get("imdbid"),
        url.searchParams.get("imdbId"),
    );
    const rawDoubanId = firstNonEmpty(
        body.doubanid,
        body.doubanId,
        url.searchParams.get("doubanid"),
        url.searchParams.get("doubanId"),
    );
    const rawName = firstNonEmpty(body.name, url.searchParams.get("name"));
    const rawYear = firstNonEmpty(body.year, url.searchParams.get("year"));

    if (!rawImdbId && !rawDoubanId && !rawName) {
        throw new ApiError("A valid query parameter is required.", 400, {
            available_params: AVAILABLE_PARAMS,
        });
    }

    const imdbid = normalizeImdbId(rawImdbId);
    if (rawImdbId && !imdbid) {
        throw new ValidationError("Invalid imdbid parameter.");
    }

    const doubanid = normalizeDoubanId(rawDoubanId);
    if (rawDoubanId && !doubanid) {
        throw new ValidationError("Invalid doubanid parameter.");
    }

    const year = normalizeYear(rawYear);
    if (rawYear && !year) {
        throw new ValidationError("Invalid year parameter. Expected YYYY.");
    }

    if (imdbid) {
        return {
            status: 200,
            body: await resolveByImdbId(imdbid, env),
        };
    }

    if (doubanid) {
        return {
            status: 200,
            body: await resolveByDoubanId(doubanid, env),
        };
    }

    if (!rawName) {
        throw new ApiError("A valid query parameter is required.", 400, {
            available_params: AVAILABLE_PARAMS,
        });
    }

    return {
        status: 200,
        body: await resolveByName(rawName, year, env),
    };
};
