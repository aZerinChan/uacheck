var TIMEOUT = 5000;

// ===== 当前协议自适应：HTTPS 页面用 https://，HTTP 页面用 http:// =====
var PROTO = location.protocol === 'https:' ? 'https:' : 'http:';

// ===== 服务器端 UA 获取源（多个，竞速取最快）=====
var SERVER_API_LIST = [
    { url: PROTO + '//httpbin.io/user-agent',          name: 'httpbin.io',          type: 'httpbin' },
    { url: PROTO + '//httpbin.org/user-agent',         name: 'httpbin.org',         type: 'httpbin' },
    { url: PROTO + '//eu.httpbin.org/user-agent',      name: 'eu.httpbin.org',      type: 'httpbin' },
    { url: PROTO + '//echo.free.beeceptor.com/',      name: 'echo.free.beeceptor', type: 'beeceptor' },
    { url: PROTO + '//postman-echo.com/get',           name: 'postman-echo.com',   type: 'postman' }
];

// ===== 工具函数 =====
// HTML 转义，防止 XSS
function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

// Promise.any polyfill（兼容旧浏览器）
if (typeof Promise.any !== 'function') {
    Promise.any = function (promises) {
        return new Promise(function (resolve, reject) {
            var reasons = [];
            var count = 0;
            if (promises.length === 0) { reject(new AggregateError([], 'All promises rejected')); return; }
            promises.forEach(function (p, i) {
                Promise.resolve(p).then(resolve, function (r) {
                    reasons[i] = r;
                    count++;
                    if (count === promises.length) reject(new AggregateError(reasons));
                });
            });
        });
    };
}

function fetchWithTimeout(url) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT);
    return fetch(url, { signal: ctrl.signal, cache: 'no-store', redirect: 'follow' })
        .then(function (r) {
            clearTimeout(timer);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .catch(function (e) {
            clearTimeout(timer);
            throw e;
        });
}

// ===== 服务器端响应解析：兼容多种 JSON 字段格式 =====
function parseServerUA(data, type) {
    if (!data) return '';
    // 1) 直接字段（httpbin.org/user-agent 标准格式）
    var ua = data['user-agent'] || data['user_agent'] || data['User-Agent'] || data.userAgent || data.ua;
    // 2) headers 嵌套字段（postman-echo.com/get 与多数 echo 服务）
    if (!ua && data.headers) {
        var h = data.headers;
        ua = h['user-agent'] || h['user_agent'] || h['User-Agent'] || h.userAgent || h['x-user-agent'];
    }
    // 3) 字符串形式（极少数服务直接返回字符串）
    if (!ua && typeof data === 'string') {
        try { var j = JSON.parse(data); return parseServerUA(j, type); } catch (e) { return data; }
    }
    return ua || '';
}

// 多源竞速：所有源同时发起，第一个成功即返回
function fetchServerUA() {
    return Promise.any(SERVER_API_LIST.map(function (api) {
        return fetchWithTimeout(api.url).then(function (data) {
            var ua = parseServerUA(data, api.type);
            if (!ua || ua.length < 3) throw new Error('no ua in response');
            return { ua: ua, source: api.name, rawType: api.type };
        });
    }));
}

// ===== 客户端 UA 解析（轻量级，无外部依赖）=====
function parseUA(ua) {
    var empty = { browser: 'Unknown', browserVersion: '', engine: 'Unknown', engineVersion: '', os: 'Unknown', osVersion: '', device: 'Desktop' };
    if (!ua) return empty;

    // 引擎
    var engine = 'Unknown', engineVersion = '';
    var wkMatch = /AppleWebKit\/([\d.]+)/.exec(ua);
    if (wkMatch) {
        engine = /Chrome|CriOS/.test(ua) ? 'Blink' : 'WebKit';
        engineVersion = wkMatch[1];
    } else if (/Gecko\/[\d.]+/.test(ua) && !/like Gecko|Trident/.test(ua)) {
        engine = 'Gecko';
        var gMatch = /rv:([\d.]+)/.exec(ua);
        engineVersion = gMatch ? gMatch[1] : '';
    } else {
        var tMatch = /Trident\/([\d.]+)/.exec(ua);
        if (tMatch) { engine = 'Trident'; engineVersion = tMatch[1]; }
    }

    // 浏览器（顺序敏感，特殊壳浏览器优先）
    var browser = 'Unknown', browserVersion = '';
    var browserPatterns = [
        [/Edg(?:e|A|iOS)?\/([\d.]+)/, 'Edge'],
        [/OPR\/([\d.]+)/, 'Opera'],
        [/Opera\/([\d.]+)/, 'Opera'],
        [/Vivaldi\/([\d.]+)/, 'Vivaldi'],
        [/YaBrowser\/([\d.]+)/, 'Yandex'],
        [/UCBrowser\/([\d.]+)/, 'UC'],
        [/SamsungBrowser\/([\d.]+)/, 'Samsung'],
        [/MiuiBrowser\/([\d.]+)/, 'MIUI'],
        [/MQQBrowser\/([\d.]+)/, 'QQ'],
        [/QQBrowser\/([\d.]+)/, 'QQ'],
        [/MicroMessenger\/([\d.]+)/, 'WeChat'],
        [/Maxthon\/([\d.]+)/, 'Maxthon'],
        [/FxiOS\/([\d.]+)/, 'Firefox'],
        [/Firefox\/([\d.]+)/, 'Firefox'],
        [/CriOS\/([\d.]+)/, 'Chrome'],
        [/Chrome\/([\d.]+)/, 'Chrome'],
        [/Version\/([\d.]+).*Safari/, 'Safari'],
        [/Safari\/([\d.]+)/, 'Safari'],
        [/MSIE ([\d.]+)/, 'IE'],
        [/Trident.*rv:([\d.]+)/, 'IE']
    ];
    for (var i = 0; i < browserPatterns.length; i++) {
        var m = browserPatterns[i][0].exec(ua);
        if (m) {
            browser = browserPatterns[i][1];
            browserVersion = m[1];
            break;
        }
    }

    // 操作系统
    var os = 'Unknown', osVersion = '';
    var osPatterns = [
        [/iPhone OS ([\d_]+)/, function (v) { return ['iOS', v.replace(/_/g, '.')]; }],
        [/iPad.*OS ([\d_]+)/, function (v) { return ['iPadOS', v.replace(/_/g, '.')]; }],
        [/iPod.*OS ([\d_]+)/, function (v) { return ['iOS', v.replace(/_/g, '.')]; }],
        [/Mac OS X ([\d_]+)/, function (v) { return ['macOS', v.replace(/_/g, '.')]; }],
        [/Android ([\d.]+)/, function (v) { return ['Android', v]; }],
        [/Android/, function () { return ['Android', '']; }],
        [/Windows NT ([\d.]+)/, function (v) {
            var map = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista', '5.1': 'XP', '5.0': '2000' };
            return ['Windows', map[v] || v];
        }],
        [/Windows Phone(?: OS)? ([\d.]+)/, function (v) { return ['Windows Phone', v]; }],
        [/CrOS/, function () { return ['ChromeOS', '']; }],
        [/Linux/, function () { return ['Linux', '']; }],
        [/FreeBSD/, function () { return ['FreeBSD', '']; }],
        [/OpenBSD/, function () { return ['OpenBSD', '']; }]
    ];
    for (var j = 0; j < osPatterns.length; j++) {
        var mm = osPatterns[j][0].exec(ua);
        if (mm) {
            var r = osPatterns[j][1](mm[1] || '');
            os = r[0]; osVersion = r[1];
            break;
        }
    }

    // 设备类型
    var device = 'Desktop';
    if (/iPad|Tablet|PlayBook/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua) && !/Silk/.test(ua))) {
        device = 'Tablet';
    } else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Opera Mini|IEMobile|Silk/i.test(ua)) {
        device = 'Mobile';
    } else if (/Smart-TV|SmartTV|GoogleTV|HbbTV|TV\b/i.test(ua)) {
        device = 'TV';
    } else if (/Bot|Crawler|Spider|Slurp|Bingpreview|facebookexternalhit|Twitterbot|LinkedInBot/i.test(ua)) {
        device = 'Bot';
    }

    return { browser: browser, browserVersion: browserVersion, engine: engine, engineVersion: engineVersion, os: os, osVersion: osVersion, device: device };
}

// ===== 渲染函数 =====
function infoRow(label, value, cls, isUa) {
    if (isUa) {
        return '<div class="info-row ua-row"><span class="info-label">' + label + '</span>' +
            '<span class="info-value ' + cls + ' ua-value" id="ua-' + label.replace(/[^\w]/g, '') + '">' +
            esc(value) +
            '<button class="copy-btn" data-ua="' + esc(value) + '" type="button">复制</button>' +
            '</span></div>';
    }
    var display = value || '-';
    return '<div class="info-row"><span class="info-label">' + label + '</span>' +
        '<span class="info-value ' + cls + '">' + display + '</span></div>';
}

function versionStr(name, ver) {
    if (!name) return '-';
    return ver ? (name + ' ' + ver) : name;
}

function osStr(parsed) {
    if (!parsed.os || parsed.os === 'Unknown') return '-';
    return parsed.osVersion ? (parsed.os + ' ' + parsed.osVersion) : parsed.os;
}

function browserCard(d, parsed, protoTag) {
    var uaId = 'server-ua';
    return '<div class="card" id="card-server"><div class="card-header">' +
        '<span class="badge badge-server">服务器</span>' +
        (protoTag || '') +
        '<span class="status-dot status-ok"></span></div>' +
        infoRow('User-Agent', d.ua, 'server-color', true) +
        infoRow('浏览器', versionStr(parsed.browser, parsed.browserVersion), 'server-color') +
        infoRow('操作系统', osStr(parsed), 'server-color') +
        infoRow('设备类型', parsed.device, 'server-color') +
        infoRow('获取来源', d.source) +
        '</div>';
}

function clientCard(ua, parsed) {
    return '<div class="card" id="card-client"><div class="card-header">' +
        '<span class="badge badge-client">客户端</span>' +
        '<span class="status-dot status-ok"></span></div>' +
        infoRow('User-Agent', ua, 'client-color', true) +
        infoRow('浏览器', versionStr(parsed.browser, parsed.browserVersion), 'client-color') +
        infoRow('操作系统', osStr(parsed), 'client-color') +
        infoRow('设备类型', parsed.device, 'client-color') +
        infoRow('渲染引擎', versionStr(parsed.engine, parsed.engineVersion), 'client-color') +
        '</div>';
}

function failCard(side, reason) {
    var cls = side === 'server' ? 'server' : 'client';
    var label = side === 'server' ? '服务器' : '客户端';
    return '<div class="card" id="card-' + side + '"><div class="card-header">' +
        '<span class="badge badge-' + cls + '">' + label + '</span>' +
        '<span class="status-dot status-fail"></span></div>' +
        '<div class="fail-msg">' +
        label + ' UA 获取失败' + (reason ? '<br><span class="fail-reason">' + esc(reason) + '</span>' : '') +
        '</div></div>';
}

function detectingCard(side) {
    var cls = side === 'server' ? 'server' : 'client';
    var label = side === 'server' ? '服务器' : '客户端';
    return '<div class="card" id="card-' + side + '"><div class="card-header">' +
        '<span class="badge badge-' + cls + '">' + label + '</span>' +
        '<span class="status-dot status-load"></span></div>' +
        '<div class="detecting">' +
        '<div class="detecting-icon"></div>' +
        '<div class="detecting-text">正在获取 ' + label + ' UA ...</div>' +
        '<div class="detecting-sub">' + (side === 'server' ? '正在多源竞速' : '正在读取本地信息') + '</div>' +
        '</div></div>';
}

// 复制按钮交互
function bindCopyButtons() {
    var btns = document.querySelectorAll('.copy-btn');
    btns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var text = btn.getAttribute('data-ua') || '';
            if (!text) return;
            var done = function () {
                var orig = btn.textContent;
                btn.textContent = '已复制';
                btn.classList.add('copied');
                setTimeout(function () { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
            } else {
                fallbackCopy(text, done);
            }
        });
    });
}

function fallbackCopy(text, cb) {
    try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        if (cb) cb();
    } catch (e) { /* ignore */ }
}

// 对比提示
function diffNote(serverUA, clientUA) {
    var note = document.getElementById('note');
    if (!serverUA || !clientUA) return;
    if (serverUA === clientUA) {
        note.innerHTML = '<strong>对比：</strong>服务器端获取的 UA 与客户端真实 UA <span style="color:#22c55e;font-weight:600">完全一致</span>，未发现伪装或代理改写。';
    } else {
        note.innerHTML = '<strong>对比：</strong>服务器端获取的 UA 与客户端真实 UA <span style="color:#eab308;font-weight:600">不一致</span>，可能存在代理改写、UA 切换插件或隐私保护机制。';
    }
    note.className = 'note show';
}

// ===== 主逻辑 =====
function startDetection() {
    var box = document.getElementById('cards');
    var note = document.getElementById('note');
    var protoTag = '<span class="proto-tag">' + (PROTO === 'https:' ? 'HTTPS' : 'HTTP') + '</span>';

    box.innerHTML = detectingCard('server') + detectingCard('client');
    note.className = 'note';
    document.getElementById('skeleton').style.display = 'none';

    function updateCard(side, html) {
        var el = document.getElementById('card-' + side);
        if (el) {
            var temp = document.createElement('div');
            temp.innerHTML = html;
            el.replaceWith(temp.firstElementChild);
        }
    }

    // ===== 客户端 UA（同步获取，几乎瞬时）=====
    var clientUA = '';
    try {
        clientUA = navigator.userAgent || '';
    } catch (e) {
        clientUA = '';
    }
    var clientParsed = parseUA(clientUA);
    updateCard('client', clientCard(clientUA, clientParsed));

    // ===== 服务器端 UA（多源竞速）=====
    fetchServerUA().then(function (result) {
        var parsed = parseUA(result.ua);
        updateCard('server', browserCard(result, parsed, protoTag));
        diffNote(result.ua, clientUA);
    }).catch(function (err) {
        updateCard('server', failCard('server', '所有 UA 获取源均请求失败（' + (PROTO === 'https:' ? 'HTTPS' : 'HTTP') + '）'));
        if (err && err.errors) {
            var reasons = err.errors.slice(0, 3).map(function (e) { return (e && e.message) ? e.message : String(e); });
            note.innerHTML = '<strong>诊断：</strong>尝试的源：' + SERVER_API_LIST.map(function (a) { return a.name; }).join('、') + '<br>最近错误：' + esc(reasons.join('；'));
            note.className = 'note show';
        }
    }).then(function () {
        bindCopyButtons();
    });

    // 客户端卡片也需要绑定复制按钮
    setTimeout(bindCopyButtons, 50);
}

startDetection();
