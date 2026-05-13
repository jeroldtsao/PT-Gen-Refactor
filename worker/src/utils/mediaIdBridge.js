import {VERSION, DEFAULT_TIMEOUT} from "../core/constants.js";
import {ApiError, NotFoundError, RateLimitError, ValidationError} from "../core/errors.js";
import {_withCache} from "./cache.js";
import {getDouBanHeaders} from "../core/config.js";
import logger from "../logger.js";

const WMDB_SEARCH_URL = "https://api.wmdb.tv/api/v1/movie/search";
const WMDB_DETAIL_URL = "https://api.wmdb.tv/movie/api";
const TMDB_API_URL = "https://api.themoviedb.org/3";
const DOUBAN_SEARCH_URL = "https://search.douban.com/movie/subject_search";
const AVAILABLE_PARAMS = ["imdbid", "doubanid", "name", "year"];
const DEFAULT_SEARCH_LIMIT = 10;
const BRIDGE_SITE = "media_id_bridge";
const BRIDGE_CACHE_VERSION = "v3";

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

const safeParseJson = (text) => {
    if (!text) return null;
    try {
        return JSON.parse(String(text).replace(/[\r\n]/g, "").trim());
    } catch {
        return null;
    }
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

const normalizeTmdbType = (value) => {
    const raw = String(value ?? "").trim().toLowerCase();
    return raw === "movie" || raw === "tv" ? raw : "";
};

const normalizeTmdbId = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    return /^\d+$/.test(raw) ? raw : "";
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

const cleanTitle = (value) =>
    String(value ?? "")
        .replace(/\u200e/g, "")
        .replace(/\s*\(\d{4}\)\s*$/, "")
        .trim();

const getBridgeItemKey = (item) =>
    [
        item?.doubanid ? `douban:${item.doubanid}` : "",
        item?.imdbid ? `imdb:${item.imdbid}` : "",
        item?.tmdbid && item?.tmdbtype ? `tmdb:${item.tmdbtype}:${item.tmdbid}` : "",
    ]
        .filter(Boolean)
        .join("|");

const toBridgeItem = (item) => {
    if (!item || typeof item !== "object") {
        return null;
    }

    const doubanid = normalizeDoubanId(
        firstNonEmpty(item.doubanId, item.doubanid),
    );
    const imdbid = normalizeImdbId(firstNonEmpty(item.imdbId, item.imdbid));
    const tmdbid = normalizeTmdbId(firstNonEmpty(item.tmdbId, item.tmdbid));
    const tmdbtype = normalizeTmdbType(
        firstNonEmpty(item.tmdbType, item.tmdbtype),
    );
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
        ...(tmdbid && tmdbtype ? {tmdbid: toDoubanIdValue(tmdbid), tmdbtype} : {}),
    };
};

const dedupeItems = (items) => {
    const seen = new Set();
    return items.filter((item) => {
        const key = getBridgeItemKey(item);
        if (!item || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
};

const withBridgeCache = (resourceId, fetchFunction, env) =>
    _withCache(
        `${BRIDGE_CACHE_VERSION}_${resourceId}`,
        fetchFunction,
        env,
        BRIDGE_SITE,
    );

const pickPreferredBridgeItem = (items, imdbid) => {
    if (!Array.isArray(items) || items.length === 0) {
        return null;
    }

    if (imdbid) {
        const exact = items.find((item) => item?.imdbid === imdbid);
        if (exact) {
            return exact;
        }
    }

    return items[0] || null;
};

const scoreDoubanSearchItem = (item, candidate) => {
    const title = cleanTitle(item?.title);
    const abstract = String(item?.abstract || "").toLowerCase();
    const candidateTitle = cleanTitle(candidate?.name || candidate?.original_name);
    const originalTitle = cleanTitle(candidate?.original_name);
    const candidateYear = normalizeYear(candidate?.year) || "";

    let score = 0;
    if (candidateYear && String(item?.year || "") === candidateYear) score += 3;
    if (candidateTitle && title.includes(candidateTitle)) score += 5;
    if (originalTitle && title.toLowerCase().includes(originalTitle.toLowerCase())) {
        score += 4;
    }
    if (candidate?.tmdbtype === "tv" && item?.subtype === "tv") score += 2;
    if (candidate?.tmdbtype === "movie" && item?.subtype === "movie") score += 2;
    if (originalTitle && abstract.includes(originalTitle.toLowerCase())) score += 2;

    return score;
};

const buildBridgeItem = ({
    doubanid = "",
    imdbid = "",
    name = "",
    year = "",
    tmdbid = "",
    tmdbtype = "",
}) => {
    const normalizedDoubanId = normalizeDoubanId(doubanid);
    const normalizedImdbId = normalizeImdbId(imdbid);
    const normalizedYear = normalizeYear(year) || firstNonEmpty(year);
    const normalizedTmdbId = normalizeTmdbId(tmdbid);
    const normalizedTmdbType = normalizeTmdbType(tmdbtype);

    if (!normalizedImdbId) {
        return null;
    }

    return {
        ...(normalizedDoubanId ? {doubanid: toDoubanIdValue(normalizedDoubanId)} : {}),
        imdbid: normalizedImdbId,
        name: firstNonEmpty(name),
        year: normalizedYear,
        ...(normalizedTmdbId && normalizedTmdbType
            ? {
                tmdbid: toDoubanIdValue(normalizedTmdbId),
                tmdbtype: normalizedTmdbType,
            }
            : {}),
    };
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

    const parsed = safeParseJson(text);
    if (!parsed) {
        throw new ApiError("WMDB returned invalid JSON.", 502, {
            detail: "Unable to parse response body.",
        });
    }
    return parsed;
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

const fetchTmdbJson = async (url, timeout = DEFAULT_TIMEOUT) => {
    const response = await fetchTextWithTimeout(
        url,
        {
            headers: {
                Accept: "application/json",
                "User-Agent": `PT-Gen-Refactor/${VERSION}`,
            },
        },
        timeout,
    );
    const text = await response.text();

    if (!response.ok) {
        if (response.status === 401) {
            throw new ApiError("TMDB API key invalid.", 401);
        }
        if (response.status === 429) {
            throw new RateLimitError("TMDB API rate limit exceeded.");
        }
        throw new ApiError(
            `TMDB request failed with status ${response.status}.`,
            response.status,
        );
    }

    const parsed = safeParseJson(text);
    if (!parsed) {
        throw new ApiError("TMDB returned invalid JSON.", 502, {
            detail: "Unable to parse response body.",
        });
    }
    return parsed;
};

const pickTmdbMatch = (payload) => {
    const resultSets = [
        {type: "movie", results: payload?.movie_results},
        {type: "tv", results: payload?.tv_results},
    ];

    for (const {type, results} of resultSets) {
        if (Array.isArray(results) && results.length > 0) {
            return {type, data: results[0]};
        }
    }

    return null;
};

const fetchTmdbByImdbId = async (imdbid, env) => {
    const apiKey = env?.TMDB_API_KEY;
    if (!apiKey) {
        return null;
    }

    const url = new URL(`${TMDB_API_URL}/find/${encodeURIComponent(imdbid)}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("external_source", "imdb_id");
    url.searchParams.set("language", "zh-CN");

    const payload = await fetchTmdbJson(url.toString(), 8000);
    const match = pickTmdbMatch(payload);
    if (!match?.data?.id) {
        return null;
    }

    const releaseDate = firstNonEmpty(
        match.data.release_date,
        match.data.first_air_date,
    );
    const item = buildBridgeItem({
        imdbid,
        name: firstNonEmpty(match.data.name, match.data.title, match.data.original_name, match.data.original_title),
        year: releaseDate ? releaseDate.slice(0, 4) : "",
        tmdbid: match.data.id,
        tmdbtype: match.type,
    });

    Object.defineProperty(item, "_searchNames", {
        value: [
            match.data.name,
            match.data.title,
            match.data.original_name,
            match.data.original_title,
        ]
            .map((value) => String(value ?? "").trim())
            .filter(Boolean),
        enumerable: false,
    });

    return item;
};

const parseDoubanSearchTitle = (title) => {
    const normalized = String(title ?? "").replace(/\u200e/g, "").trim();
    const yearMatch = normalized.match(/\((\d{4})\)\s*$/);
    return {
        name: cleanTitle(normalized),
        year: yearMatch ? yearMatch[1] : "",
    };
};

const parseDoubanSearchItem = (item) => {
    if (!item || typeof item !== "object") {
        return null;
    }

    const doubanid = normalizeDoubanId(firstNonEmpty(item.id));
    if (!doubanid) {
        return null;
    }

    const {name, year: titleYear} = parseDoubanSearchTitle(item.title);
    const abstractYear = String(item.abstract || "").match(/(?:^|\D)(\d{4})(?:\D|$)/)?.[1] || "";
    const labels = Array.isArray(item.labels) ? item.labels : [];
    const labelText = labels.map((label) => label?.text || "").join("/");

    return {
        doubanid: toDoubanIdValue(doubanid),
        name,
        year: firstNonEmpty(titleYear, abstractYear),
        subtype: /剧集|电视|TV|tv/.test(labelText) ? "tv" : "movie",
        title: firstNonEmpty(item.title),
        abstract: firstNonEmpty(item.abstract),
    };
};

const parseDoubanSearchPayload = (html) => {
    const match = String(html || "").match(
        /window\.__DATA__\s*=\s*({[\s\S]*?});?\s*(?:window\.__USER__|<\/script>|$)/,
    );
    if (!match) {
        return [];
    }

    const parsed = safeParseJson(match[1]);
    if (!parsed || parsed.error_info === "搜索访问太频繁。") {
        return [];
    }

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return items.map(parseDoubanSearchItem).filter(Boolean);
};

const searchDoubanByName = async (name, env) => {
    const url = new URL(DOUBAN_SEARCH_URL);
    url.searchParams.set("search_text", name);
    url.searchParams.set("cat", "1002");

    const response = await fetchTextWithTimeout(
        url.toString(),
        {headers: getDouBanHeaders(env)},
        12000,
    );
    const html = await response.text();

    if (!response.ok) {
        logger.warn("Douban search request failed", {
            status: response.status,
            name,
        });
        return [];
    }

    return parseDoubanSearchPayload(html);
};

const resolveDoubanIdForCandidate = async (candidate, env) => {
    const names = [
        ...(Array.isArray(candidate?._searchNames) ? candidate._searchNames : []),
        candidate?.name,
        candidate?.original_name,
    ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);
    const seen = new Set();
    const uniqueNames = names.filter((name) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    for (const name of uniqueNames) {
        try {
            const results = await searchDoubanByName(name, env);
            if (results.length === 0) {
                continue;
            }

            const scored = results
                .map((item) => ({item, score: scoreDoubanSearchItem(item, candidate)}))
                .sort((a, b) => b.score - a.score);
            const best = scored[0];
            if (best?.score >= 3) {
                return best.item;
            }
        } catch (error) {
            logger.warn("Douban search fallback failed", {
                name,
                error: error.message,
            });
        }
    }

    return null;
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

const attachDoubanFromSearch = async (item, env) => {
    if (!item || item.doubanid) {
        return item;
    }

    const doubanItem = await resolveDoubanIdForCandidate(item, env);
    if (!doubanItem) {
        return item;
    }

    return {
        ...item,
        doubanid: doubanItem.doubanid,
        name: firstNonEmpty(doubanItem.name, item.name),
        year: firstNonEmpty(doubanItem.year, item.year),
    };
};

const resolveByDoubanId = async (doubanid, env) =>
    withBridgeCache(
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
    );

const localizeBridgeItem = async (item, env) => {
    if (!item?.doubanid || isChineseText(item?.name)) {
        return item;
    }

    try {
        const localized = await resolveByDoubanId(String(item.doubanid), env);
        const localizedItem = pickPreferredBridgeItem(
            localized?.data,
            item.imdbid,
        );

        if (!localizedItem) {
            return item;
        }

        return {
            ...item,
            ...localizedItem,
            doubanid: item.doubanid,
            imdbid: item.imdbid,
            name: firstNonEmpty(localizedItem.name, item.name),
            year: firstNonEmpty(localizedItem.year, item.year),
        };
    } catch (error) {
        logger.warn("Media ID Bridge: failed to localize item by Douban ID", {
            doubanid: item.doubanid,
            imdbid: item.imdbid,
            error: error.message,
        });
        return item;
    }
};

const resolveByName = async (name, year, env) =>
    withBridgeCache(
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
    );

const resolveByImdbId = async (imdbid, env) =>
    withBridgeCache(
        `imdb_${imdbid}`,
        async () => {
            logger.info("Media ID Bridge: resolve by IMDb ID", {imdbid});
            let tmdbItem = null;

            try {
                tmdbItem = await fetchTmdbByImdbId(imdbid, env);
            } catch (error) {
                logger.warn("TMDB IMDb external ID lookup failed", {
                    imdbid,
                    error: error.message,
                });
            }

            if (tmdbItem) {
                const enriched = await attachDoubanFromSearch(tmdbItem, env);
                if (enriched?.doubanid) {
                    return {
                        success: true,
                        site: BRIDGE_SITE,
                        query_type: "imdbid",
                        data: [enriched],
                    };
                }
            }

            const {gen_imdb} = await getProviders();
            const imdbData = await gen_imdb(imdbid, env);

            if (!imdbData?.success && !tmdbItem) {
                throw new NotFoundError("Not Found");
            }

            const tmdbName = tmdbItem?.name;
            const tmdbYear = normalizeYear(tmdbItem?.year) || "";

            const year = normalizeYear(imdbData?.year) || tmdbYear || "";
            const candidates = [
                ...buildNameCandidates(imdbData),
                tmdbName,
            ]
                .map((value) => String(value ?? "").trim())
                .filter(Boolean);
            const seenCandidates = new Set();

            for (const candidate of candidates) {
                const candidateKey = candidate.toLowerCase();
                if (seenCandidates.has(candidateKey)) {
                    continue;
                }
                seenCandidates.add(candidateKey);

                const results = await withSearchRetry(() => searchWmdbByName(candidate, year));
                const exact = results.find((item) => item.imdbid === imdbid);
                if (exact) {
                    const localized = await localizeBridgeItem(exact, env);
                    return {
                        success: true,
                        site: BRIDGE_SITE,
                        query_type: "imdbid",
                        data: [localized],
                    };
                }
            }

            if (tmdbItem) {
                const doubanItem = await resolveDoubanIdForCandidate(tmdbItem, env);
                if (doubanItem) {
                    return {
                        success: true,
                        site: BRIDGE_SITE,
                        query_type: "imdbid",
                        data: [
                            {
                                ...tmdbItem,
                                doubanid: doubanItem.doubanid,
                                name: firstNonEmpty(doubanItem.name, tmdbItem.name),
                                year: firstNonEmpty(doubanItem.year, tmdbItem.year),
                            },
                        ],
                    };
                }
            }

            throw new NotFoundError("Not Found");
        },
        env,
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
