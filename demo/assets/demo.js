(function () {
  "use strict";

  var STORAGE_KEY = "tiktok_demo_config_v1";
  var REDIRECT_URI = "https://alexandreaguiaralves.github.io/demo/callback/";
  var AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
  var DEFAULT_SCOPES = "user.info.basic,user.info.profile,video.list";

  function readConfig() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }

  function writeConfig(partial) {
    var next = Object.assign({}, readConfig(), partial);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function randomState() {
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  function encodeQuery(params) {
    return Object.keys(params)
      .map(function (key) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
      })
      .join("&");
  }

  function setStatus(el, type, message) {
    if (!el) {
      return;
    }
    el.className = "demo-status demo-status-" + type;
    el.textContent = message;
    el.classList.remove("demo-hidden");
  }

  function hideStatus(el) {
    if (el) {
      el.classList.add("demo-hidden");
    }
  }

  function getProxyBase(config) {
    var base = (config.proxyUrl || "").trim();
    if (!base) {
      return "";
    }
    return base.replace(/\/+$/, "");
  }

  function buildAuthorizeUrl(clientKey, scopes, state) {
    return (
      AUTH_URL +
      "?" +
      encodeQuery({
        client_key: clientKey,
        response_type: "code",
        scope: scopes,
        redirect_uri: REDIRECT_URI,
        state: state,
      })
    );
  }

  function initSetupPage() {
    var form = document.getElementById("demo-setup-form");
    if (!form) {
      return;
    }

    var config = readConfig();
    var clientKeyInput = document.getElementById("client-key");
    var proxyInput = document.getElementById("proxy-url");
    var scopesInput = document.getElementById("scopes");
    var statusEl = document.getElementById("demo-status");
    var loginBtn = document.getElementById("login-btn");

    if (clientKeyInput) {
      clientKeyInput.value = config.clientKey || "";
    }
    if (proxyInput) {
      proxyInput.value = config.proxyUrl || "";
    }
    if (scopesInput) {
      scopesInput.value = config.scopes || DEFAULT_SCOPES;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var clientKey = (clientKeyInput && clientKeyInput.value.trim()) || "";
      var proxyUrl = (proxyInput && proxyInput.value.trim()) || "";
      var scopes = (scopesInput && scopesInput.value.trim()) || DEFAULT_SCOPES;

      if (!clientKey) {
        setStatus(statusEl, "error", "Informe o Client Key do app (modo Sandbox no portal TikTok).");
        return;
      }
      if (!proxyUrl) {
        setStatus(
          statusEl,
          "error",
          "Informe a URL do proxy OAuth (Cloudflare Worker). Veja demo/README.md."
        );
        return;
      }

      writeConfig({ clientKey: clientKey, proxyUrl: proxyUrl, scopes: scopes });
      setStatus(statusEl, "success", "Configuração salva. Você já pode entrar com TikTok.");
    });

    if (loginBtn) {
      loginBtn.addEventListener("click", function () {
        var cfg = readConfig();
        if (!cfg.clientKey || !cfg.proxyUrl) {
          setStatus(
            statusEl,
            "error",
            "Salve Client Key e URL do proxy antes de entrar com TikTok."
          );
          return;
        }
        var state = randomState();
        sessionStorage.setItem("tiktok_demo_state", state);
        sessionStorage.removeItem("tiktok_demo_result");
        window.location.href = buildAuthorizeUrl(
          cfg.clientKey,
          cfg.scopes || DEFAULT_SCOPES,
          state
        );
      });
    }
  }

  function parseCallbackQuery() {
    var params = new URLSearchParams(window.location.search);
    return {
      code: params.get("code") || "",
      state: params.get("state") || "",
      error: params.get("error") || "",
      errorDescription: params.get("error_description") || "",
    };
  }

  function fetchJson(url, options) {
    return fetch(url, options).then(function (response) {
      return response.text().then(function (text) {
        var data = {};
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            data = { raw: text };
          }
        }
        if (!response.ok) {
          var message =
            (data && data.error && data.error.message) ||
            (data && data.message) ||
            "HTTP " + response.status;
          throw new Error(message);
        }
        return data;
      });
    });
  }

  function renderProfile(profile) {
    var user = (profile && profile.data && profile.data.user) || {};
    var avatar = document.getElementById("profile-avatar");
    var nameEl = document.getElementById("profile-name");
    var userEl = document.getElementById("profile-username");
    var openIdEl = document.getElementById("profile-open-id");
    var statsEl = document.getElementById("profile-stats");

    if (avatar) {
      avatar.src = user.avatar_url || "";
      avatar.alt = user.display_name || "Avatar";
    }
    if (nameEl) {
      nameEl.textContent = user.display_name || "—";
    }
    if (userEl) {
      userEl.textContent = user.username ? "@" + user.username : "—";
    }
    if (openIdEl) {
      openIdEl.textContent = user.open_id ? "open_id: " + user.open_id : "";
    }
    if (statsEl) {
      statsEl.innerHTML = "";
      var items = [
        { label: "Seguidores", value: user.follower_count },
        { label: "Seguindo", value: user.following_count },
        { label: "Curtidas", value: user.likes_count },
        { label: "Vídeos", value: user.video_count },
      ];
      items.forEach(function (item) {
        if (item.value === undefined || item.value === null) {
          return;
        }
        var div = document.createElement("div");
        div.className = "demo-stat";
        div.innerHTML = "<strong>" + item.value + "</strong><span>" + item.label + "</span>";
        statsEl.appendChild(div);
      });
    }
    document.getElementById("profile-panel").classList.remove("demo-hidden");
  }

  function renderVideos(listPayload) {
    var videos =
      (listPayload &&
        listPayload.data &&
        listPayload.data.videos &&
        listPayload.data.videos) ||
      [];
    var tbody = document.getElementById("video-rows");
    var panel = document.getElementById("videos-panel");
    if (!tbody || !panel) {
      return;
    }
    tbody.innerHTML = "";
    if (!videos.length) {
      var row = document.createElement("tr");
      row.innerHTML = "<td colspan=\"3\">Nenhum vídeo retornado (scope video.list).</td>";
      tbody.appendChild(row);
    } else {
      videos.slice(0, 10).forEach(function (video) {
        var tr = document.createElement("tr");
        var title = video.title || video.video_description || "(sem título)";
        var id = video.id || "—";
        var created = video.create_time
          ? new Date(video.create_time * 1000).toLocaleString("pt-BR")
          : "—";
        tr.innerHTML =
          "<td>" +
          escapeHtml(title) +
          "</td><td><code>" +
          escapeHtml(id) +
          "</code></td><td>" +
          escapeHtml(created) +
          "</td>";
        tbody.appendChild(tr);
      });
    }
    panel.classList.remove("demo-hidden");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function exchangeAndLoad() {
    var statusEl = document.getElementById("demo-status");
    var cfg = readConfig();
    var proxy = getProxyBase(cfg);
    var query = parseCallbackQuery();
    var expectedState = sessionStorage.getItem("tiktok_demo_state") || "";

    if (query.error) {
      setStatus(
        statusEl,
        "error",
        "TikTok recusou: " + (query.errorDescription || query.error)
      );
      return;
    }
    if (!query.code) {
      setStatus(statusEl, "error", "Código de autorização ausente na URL.");
      return;
    }
    if (!query.state || query.state !== expectedState) {
      setStatus(statusEl, "error", "State inválido (proteção CSRF). Tente login novamente.");
      return;
    }
    if (!cfg.clientKey || !proxy) {
      setStatus(
        statusEl,
        "error",
        "Configure Client Key e proxy em /demo/ antes de usar o callback."
      );
      return;
    }

    setStatus(statusEl, "info", "Trocando código por access token (Login Kit)…");

    fetchJson(proxy + "/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: query.code,
        redirect_uri: REDIRECT_URI,
      }),
    })
      .then(function (tokenPayload) {
        var accessToken =
          (tokenPayload.data && tokenPayload.data.access_token) || tokenPayload.access_token;
        if (!accessToken) {
          throw new Error("Resposta sem access_token");
        }
        sessionStorage.setItem(
          "tiktok_demo_result",
          JSON.stringify({ accessToken: accessToken, at: Date.now() })
        );
        setStatus(statusEl, "info", "Token obtido. Carregando perfil (Display API)…");
        return fetchJson(proxy + "/v1/user/info", {
          headers: { Authorization: "Bearer " + accessToken },
        });
      })
      .then(function (profile) {
        renderProfile(profile);
        setStatus(statusEl, "info", "Perfil carregado. Listando vídeos (Display API)…");
        var stored = JSON.parse(sessionStorage.getItem("tiktok_demo_result") || "{}");
        return fetchJson(proxy + "/v1/video/list", {
          method: "POST",
          headers: { Authorization: "Bearer " + stored.accessToken },
        });
      })
      .then(function (videos) {
        renderVideos(videos);
        setStatus(
          statusEl,
          "success",
          "Fluxo completo: Login Kit → token → Display API (perfil + vídeos)."
        );
      })
      .catch(function (err) {
        setStatus(statusEl, "error", err.message || "Falha no fluxo OAuth/API.");
      });
  }

  function initCallbackPage() {
    if (!document.body || !document.body.classList.contains("demo-callback")) {
      return;
    }
    exchangeAndLoad();
  }

  initSetupPage();
  initCallbackPage();
})();
