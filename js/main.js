// 页面主体解析完成后立即结束载入动画，不等待天气、壁纸等外部资源。
// 使用原生 DOM API，确保 jQuery 或其他第三方依赖加载失败时页面仍然可见。
function finishLoading() {
    var loadingBox = document.getElementById('loading-box');
    var bg = document.getElementById('bg');
    var section = document.getElementById('section');
    var cover = document.querySelector('.cover');

    if (loadingBox) loadingBox.classList.add('loaded');
    if (bg) bg.style.cssText = 'transform: scale(1);filter: blur(0px);transition: ease 1.5s;';
    if (section) section.style.cssText = 'opacity: 1;transition: ease 1.5s;';
    if (cover) cover.style.cssText = 'opacity: 1;transition: ease 1.5s;';
}

function initPage() {
    finishLoading();

    //用户欢迎
    if (window.iziToast) {
        iziToast.settings({
            timeout: 3000,
            backgroundColor: '#ffffff40',
            titleColor: '#efefef',
            messageColor: '#efefef',
            progressBar: false,
            close: false,
            closeOnEscape: true,
            position: 'topCenter',
            transitionIn: 'bounceInDown',
            transitionOut: 'flipOutX',
            displayMode: 'replace',
            layout: '1'
        });
        setTimeout(function () {
            iziToast.show({
                title: hello,
                message: '欢迎来到 Snavigation'
            });
        }, 800);
    }

    //中文字体缓加载-此处写入字体源文件
    //先行加载简体中文子集，后续补全字集
    //由于压缩过后的中文字体仍旧过大，可转移至对象存储或 CDN 加载
    if ('FontFace' in window && document.fonts) {
        const font = new FontFace(
            "MiSans",
            "url(" + "./font/MiSans-Regular.woff2" + ")"
        );
        document.fonts.add(font);
    }

}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage, { once: true });
} else {
    initPage();
}

// 最后一层兜底：即使其他脚本异常，也不会让遮罩永久停留。
setTimeout(finishLoading, 4000);

//进入问候
now = new Date(), hour = now.getHours()
if (hour < 6) {
    var hello = "凌晨好";
} else if (hour < 9) {
    var hello = "早上好";
} else if (hour < 12) {
    var hello = "上午好";
} else if (hour < 14) {
    var hello = "中午好";
} else if (hour < 17) {
    var hello = "下午好";
} else if (hour < 19) {
    var hello = "傍晚好";
} else if (hour < 22) {
    var hello = "晚上好";
} else {
    var hello = "夜深了";
}

//获取时间
var t = null;
t = setTimeout(time, 1000);

function time() {
    clearTimeout(t);
    dt = new Date();
    var mm = dt.getMonth() + 1;
    var d = dt.getDate();
    var weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    var day = dt.getDay();
    var h = dt.getHours();
    var m = dt.getMinutes();
    if (h < 10) {
        h = "0" + h;
    }
    if (m < 10) {
        m = "0" + m;
    }
    $("#time_text").html(h + '<span id="point">:</span>' + m);
    $("#day").html(mm + "&nbsp;月&nbsp;" + d + "&nbsp;日&nbsp;" + weekday[day]);
    t = setTimeout(time, 1000);
}

// 自动定位并获取天气：先用 IP 粗略定位快速显示，允许浏览器定位后再更新精确天气。
function getWeatherLabel(code) {
    if (code === 0) return '晴';
    if (code === 1 || code === 2) return '晴间多云';
    if (code === 3) return '阴';
    if (code === 45 || code === 48) return '雾';
    if (code >= 51 && code <= 55) return '毛毛雨';
    if (code === 56 || code === 57 || code === 66 || code === 67) return '冻雨';
    if (code >= 61 && code <= 65) return '雨';
    if (code >= 71 && code <= 75) return '雪';
    if (code === 77) return '雪粒';
    if (code >= 80 && code <= 82) return '阵雨';
    if (code === 85 || code === 86) return '阵雪';
    if (code === 95) return '雷雨';
    if (code === 96 || code === 99) return '雷雨伴冰雹';
    return '天气未知';
}

function fetchJson(url, timeout) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () {
        controller.abort();
    }, timeout) : null;

    return fetch(url, {
        cache: 'no-store',
        signal: controller ? controller.signal : undefined
    }).then(function (response) {
        if (!response.ok) throw new Error('请求失败：' + response.status);
        return response.json();
    }).finally(function () {
        if (timer) clearTimeout(timer);
    });
}

function getBrowserLocation() {
    return new Promise(function (resolve, reject) {
        if (!navigator.geolocation) {
            reject(new Error('浏览器不支持定位'));
            return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 10 * 60 * 1000
        });
    });
}

function getIpLocation() {
    return fetchJson(
        'https://ipwho.is/?fields=success,city,region,country,latitude,longitude',
        5000
    ).then(function (data) {
        if (!data.success || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
            throw new Error(data.message || 'IP 定位失败');
        }
        return data;
    });
}

function renderWeather(latitude, longitude, locationName) {
    var url = 'https://api.open-meteo.com/v1/forecast' +
        '?latitude=' + encodeURIComponent(latitude) +
        '&longitude=' + encodeURIComponent(longitude) +
        '&current=temperature_2m,weather_code' +
        '&daily=temperature_2m_max,temperature_2m_min' +
        '&timezone=auto&forecast_days=1';

    return fetchJson(url, 8000).then(function (data) {
        if (!data.current || !data.daily || !data.daily.temperature_2m_max || !data.daily.temperature_2m_min) {
            throw new Error('天气数据格式错误');
        }

        document.getElementById('location_text').textContent = locationName || '当前位置';
        document.getElementById('wea_text').textContent = getWeatherLabel(data.current.weather_code);
        document.getElementById('current_temp').textContent = Math.round(data.current.temperature_2m);
        document.getElementById('tem1').textContent = Math.round(data.daily.temperature_2m_max[0]);
        document.getElementById('tem2').textContent = Math.round(data.daily.temperature_2m_min[0]);
    });
}

function showWeatherError() {
    document.getElementById('location_text').textContent = '定位失败';
    document.getElementById('wea_text').textContent = '天气暂不可用';
}

async function loadWeather() {
    var preciseLocationPromise = getBrowserLocation().then(function (position) {
        return { position: position };
    }).catch(function (error) {
        return { error: error };
    });
    var ipLocation = null;
    var weatherLoaded = false;

    try {
        ipLocation = await getIpLocation();
        await renderWeather(
            ipLocation.latitude,
            ipLocation.longitude,
            ipLocation.city || ipLocation.region || ipLocation.country || '当前位置'
        );
        weatherLoaded = true;
    } catch (error) {
        console.warn('IP 定位天气加载失败', error);
    }

    try {
        var preciseLocation = await preciseLocationPromise;
        if (preciseLocation.error) throw preciseLocation.error;
        var position = preciseLocation.position;
        await renderWeather(
            position.coords.latitude,
            position.coords.longitude,
            ipLocation && ipLocation.city ? ipLocation.city : '当前位置'
        );
        weatherLoaded = true;
    } catch (error) {
        console.info('未使用精确定位，保留 IP 定位天气', error);
    }

    if (!weatherLoaded) showWeatherError();
}

loadWeather();
    
//Tab书签页
$(function () {
    $(".mark .tab .tab-item").click(function () {
        $(this).addClass("active").siblings().removeClass("active");
        $(".products .mainCont").eq($(this).index()).css("display", "flex").siblings().css("display", "none");
    })
})

//设置
$(function () {
    $(".set .tabs .tab-items").click(function () {
        $(this).addClass("actives").siblings().removeClass("actives");
        $(".productss .mainConts").eq($(this).index()).css("display", "flex").siblings().css("display", "none");
    })
})

//输入框为空时阻止跳转
$(window).keydown(function (e) {
    var key = window.event ? e.keyCode : e.which;
    if (key.toString() == "13") {
        if ($(".wd").val() == "") {
            return false;
        }
    }
});

//点击搜索按钮
$(".sou-button").click(function () {
    if ($("body").attr("class") === "onsearch") {
        if ($(".wd").val() != "") {
            $("#search-submit").click();
        }
    }
});

//鼠标中键点击事件
$(window).mousedown(function (event) {
    if (event.button == 1) {
        $("#time_text").click();
    }
});

//控制台输出
var styleTitle1 = `
font-size: 20px;
font-weight: 600;
color: rgb(244,167,89);
`
var styleTitle2 = `
font-size:12px;
color: rgb(244,167,89);
`
var styleContent = `
color: rgb(30,152,255);
`
var title1 = 'Snavigation'
var title2 = `
 _____ __  __  _______     ____     __
|_   _|  \\/  |/ ____\\ \\   / /\\ \\   / /
  | | | \\  / | (___  \\ \\_/ /  \\ \\_/ / 
  | | | |\\/| |\\___ \\  \\   /    \\   /  
 _| |_| |  | |____) |  | |      | |   
|_____|_|  |_|_____/   |_|      |_|                                                     
`
var content = `
版 本 号：1.1
更新日期：2022-07-12

Github:  https://github.com/imsyy/Snavigation
`
console.log(`%c${title1} %c${title2}
%c${content}`, styleTitle1, styleTitle2, styleContent)
