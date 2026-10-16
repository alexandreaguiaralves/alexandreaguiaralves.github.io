/**
 * Cloudflare Worker — troca code por token e proxy Display API (secret só no Worker).
 * Deploy: wrangler secret put TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET
 */

var ALLOWED_ORIGIN = "https://alexandreaguiaralves.github.io";
var TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
var USER_INFO_URL =
  "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count";
var VIDEO_LIST_URL =
  "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,create_time,cover_image_url,duration";

function corsHeaders(request) {
  var origin = request.headers.get("Origin") || "";
  var allowOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(request, status, body) {
  var headers = corsHeaders(request);
  headers["Content-Type"] = "application/json; charset=utf-8";
  return new Response(JSON.stringify(body), { status: status, headers: headers });
}

function formBody(params) {
  return Object.keys(params)
    .map(function (key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
    })
    .join("&");
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
}

async function exchangeToken(env, code, redirectUri) {
  var response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      client_key: env.TIKTOK_CLIENT_KEY,
      client_secret: env.TIKTOK_CLIENT_SECRET,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  var text = await response.text();
  var data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    var message =
      (data.error && data.error.message) || data.message || "token_exchange_failed";
    throw new Error(message);
  }
  return data;
}

async function forwardGet(url, accessToken) {
  var response = await fetch(url, {
    headers: { Authorization: "Bearer " + accessToken },
  });
  var text = await response.text();
  var data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    var message =
      (data.error && data.error.message) || data.message || "api_request_failed";
    throw new Error(message);
  }
  return data;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
      return jsonResponse(request, 500, {
        error: { message: "Configure TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET no Worker." },
      });
    }

    var url = new URL(request.url);

    try {
      if (url.pathname === "/v1/token" && request.method === "POST") {
        var body = await readJson(request);
        if (!body || !body.code || !body.redirect_uri) {
          return jsonResponse(request, 400, {
            error: { message: "code e redirect_uri são obrigatórios." },
          });
        }
        var tokenData = await exchangeToken(env, body.code, body.redirect_uri);
        return jsonResponse(request, 200, tokenData);
      }

      if (url.pathname === "/v1/user/info" && request.method === "GET") {
        var auth = request.headers.get("Authorization") || "";
        if (!auth.startsWith("Bearer ")) {
          return jsonResponse(request, 401, { error: { message: "Bearer token required." } });
        }
        var profile = await forwardGet(USER_INFO_URL, auth.slice(7));
        return jsonResponse(request, 200, profile);
      }

      if (url.pathname === "/v1/video/list" && request.method === "POST") {
        var authVideo = request.headers.get("Authorization") || "";
        if (!authVideo.startsWith("Bearer ")) {
          return jsonResponse(request, 401, { error: { message: "Bearer token required." } });
        }
        var videoResponse = await fetch(VIDEO_LIST_URL, {
          method: "POST",
          headers: {
            Authorization: authVideo,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ max_count: 20 }),
        });
        var videoText = await videoResponse.text();
        var videoData = videoText ? JSON.parse(videoText) : {};
        if (!videoResponse.ok) {
          var videoMessage =
            (videoData.error && videoData.error.message) ||
            videoData.message ||
            "video_list_failed";
          throw new Error(videoMessage);
        }
        return jsonResponse(request, 200, videoData);
      }

      return jsonResponse(request, 404, { error: { message: "Not found." } });
    } catch (err) {
      return jsonResponse(request, 502, {
        error: { message: err.message || "upstream_error" },
      });
    }
  },
};
