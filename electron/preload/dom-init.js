import controller, { queue } from "./controller.js";
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let injected = false;
let loopBeforePageLoadedTimer;
let MAX_LOOP_COUNT = 100;
/* 
    {
      dDurationMs: number;
      tStartMs: numer;
      segs: [{utf8: string}]
    }
  */

function getSecondaryHtml() {
  return document.querySelector("ytd-watch-flexy #secondary");
}

function getPageEls() {
  return {
    videoContainer: document.querySelector(
      "ytd-watch-flexy .html5-video-container"
    ),
    video: document.querySelector(
      "ytd-watch-flexy .html5-video-container video"
    ),
    bottomCtrl: document.querySelector(
      "ytd-watch-flexy .html5-video-player .ytp-chrome-bottom"
    ),
    secondaryEl: document.querySelector("ytd-watch-flexy #secondary"),
    progressBarParent: document.querySelector("ytd-watch-flexy .ytp-chapter-hover-container")
  };
}

function setStyle(el, content) {
  el.setAttribute("style", content);
}

function resizeVideoStyle() {
  const { videoContainer, video, bottomCtrl, secondaryEl, progressBarParent } = getPageEls();
  if (!videoContainer || !video || !bottomCtrl) return;
  setStyle(videoContainer, "height: 100%");
  setStyle(video, "width: 100%; height: 100%;");
  setStyle(bottomCtrl, "width: calc(100% - 12px); left: 12px;");
  setStyle(secondaryEl, "width: auto;")
  // setStyle(progressBarParent, "width: 100% !important;")
}

function getUrlParameter(sParam) {
  let sPageURL = window.location.search.substring(1);
  let sURLVariables = sPageURL.split("&");
  let sParameterName;
  let i;

  for (i = 0; i < sURLVariables.length; i++) {
    sParameterName = sURLVariables[i].split("=");

    if (sParameterName[0] === sParam) {
      return sParameterName[1] === undefined
        ? true
        : decodeURIComponent(sParameterName[1]);
    }
  }
  return false;
}


function loopBeforePageLoaded() {
  const data2String = queue.pop()
  loopBeforePageLoadedTimer && clearTimeout(loopBeforePageLoadedTimer)
  loopBeforePageLoadedTimer = setTimeout(() => {
    appendSubtitlesContainer(data2String)
  }, 1000)
}

function appendSubtitlesContainer(data2String) {
  if (injected) return;
  const contentFromFile = readFileSync(resolve(__dirname, '../sample/content.html'))
  const contentHTML = contentFromFile.toString()
  //<div id="__definition__"></div>
  const containerId = "#__extension_container__";
  const secondaryEl = getSecondaryHtml();
  loopBeforePageLoadedTimer && clearTimeout(loopBeforePageLoadedTimer);
  if (!secondaryEl) {
    console.log('Page was still loading, data will be cached and dequeue after loaded.')
    queue.add(data2String)
    loopBeforePageLoaded()
    return;
  }
  let container = document.querySelector(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
  } else {
    secondaryEl.removeChild(container);
  }
  container.innerHTML = contentHTML;
  // const addThirdCls = "#__add_third";
  const colsEl = document.querySelector("ytd-watch-flexy #columns");
  const primaryEl = document.querySelector("ytd-watch-flexy #primary");
  if (primaryEl) {
    // const additionalEl = colsEl.querySelector(addThirdCls);
    // if (additionalEl) {
    //   colsEl.removeChild(additionalEl);
    // }
    // Add the third column, the video element will be smaller. Video parent element has flex style set.
    // const addThirdEl = document.createElement("div");
    // addThirdEl.id = "__add_third";
    // setStyle(addThirdEl, "width: 100px;");
    // colsEl.appendChild(addThirdEl);
  }
  secondaryEl.appendChild(container);
  resizeVideoStyle();
  controller();
  injected = true;
}

window.addEventListener(
  "message",
  function (e) {
    const { event, data } = e.data;
    if (event === "__subtitles_capture__") {
      // window.localStorage.set('__subtitles_data__', JSON.stringify(data))
      // window.__subtitles_data__ = data
      // console.log('url v=====> ', getUrlParameter('v'))
      try {
        const data2String = JSON.stringify(data)
        window.localStorage.setItem(`__subtitles_data__`, data2String);
        window.postMessage(
          {
            event: "__subtitles_data_cached__",
            data,
          },
          "*"
        );
        console.log("<========== 字幕文件已获取");
        // console.log('injected: ', injected);
        appendSubtitlesContainer(data2String);
      } catch (err) {
        console.error(err)
      }
    }
  },
  false
);

let resizeTimer;
window.addEventListener("resize", () => {
  resizeTimer && clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resizeVideoStyle();
  }, 1000);
});
