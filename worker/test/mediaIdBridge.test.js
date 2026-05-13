import assert from "node:assert/strict";
import {queryMediaIdBridge} from "../src/utils/mediaIdBridge.js";
import logger from "../src/logger.js";

logger.init({LOG_LEVEL: "none"});

const doubanSearchHtml = `
<html>
  <body>
    <script>
      window.__DATA__ = {
        "items": [{
          "id": 35134291,
          "labels": [{"text": "剧集"}],
          "title": "面包理发店 브레드이발소‎ (2019)",
          "abstract": "韩国 / 动画 / BreadBarbershop / Bread Ibalso / 25分钟"
        }]
      };
      window.__USER__ = {};
    </script>
  </body>
</html>`;

const originalFetch = globalThis.fetch;
const bridgeUrl = new URL("https://example.test/api/media-id-bridge?imdbid=tt12912830");
const requestedUrls = [];

globalThis.fetch = async (url) => {
    const urlString = String(url);
    requestedUrls.push(urlString);

    if (urlString.includes("/find/tt12912830")) {
        return new Response(JSON.stringify({
            movie_results: [],
            tv_results: [{
                id: 129832,
                name: "Bread Barbershop",
                original_name: "Bread Barbershop",
                first_air_date: "2019-01-03",
            }],
        }));
    }

    if (urlString.includes("search.douban.com/movie/subject_search")) {
        return new Response(doubanSearchHtml);
    }

    throw new Error(`Unexpected fetch: ${urlString}`);
};

try {
    const result = await queryMediaIdBridge(
        new Request(bridgeUrl),
        {TMDB_API_KEY: "test_key", ENABLED_CACHE: "true", LOG_LEVEL: "none"},
        bridgeUrl,
    );

    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data, [{
        imdbid: "tt12912830",
        name: "面包理发店 브레드이발소",
        year: "2019",
        tmdbid: 129832,
        tmdbtype: "tv",
        doubanid: 35134291,
    }]);
    assert.ok(requestedUrls.some((url) => url.includes("/find/tt12912830")));
    assert.ok(requestedUrls.some((url) => url.includes("search.douban.com/movie/subject_search")));
    assert.equal(requestedUrls.some((url) => url.includes("www.imdb.com/title/tt12912830")), false);
} finally {
    globalThis.fetch = originalFetch;
}

console.log("Media ID Bridge tests passed");
