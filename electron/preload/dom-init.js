import controller, { queue } from "./controller.js";

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
  const contentHTML = `
  <style>
    .__extension_icon {
      position: fixed;
      right: 20px;
      top: 100px;
      width: 74px;
      height: 36px;
      border-radius: 8px;
      z-index: 2000;
      cursor: pointer;
      transform: scale(0.7);
      transition: all 0.2s;
      transform-origin: center center;
    }

    .__extension_icon:hover {
      transform: scale(1);
    }

    .__video_subitles {
      position: absolute;
      left: 0;
      top: 24px;
      width: 100%;
      // min-height: 700px;
      z-index: 1200;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background-color: #0f0f0f;
    }

    .__video_subitles--hidden {
      display: none;
    }

    .__subtitles_head {
      display: flex;
      align-items: center;
      height: 44px;
      padding: 4px;
    }

    .__subtitles_head p {
      padding: 2px 4px;
      margin-right: 4px;
      font-size: 16px;
      /* font-weight: bold; */
      color: rgba(255, 255, 255, 0.6);
    }

    .__subtitles_head p:hover {
      font-weight: bold;
      color: rgba(255, 255, 255, 0.9);
    }

    .__subtitles_head img {
      width: 30px;
      height: 30px;
      margin-right: 12px;
      /* border-radius: 50%; */
      cursor: pointer;
      transition: all 0.1s linear;
      border-radius: 4px;
    }

    .__subtitles_head img:hover {
      /* width: 34px;
      height: 34px; */
      transform: scale(1.2);
      transform-origin: left center;
    }

    .__subtitle_block {
      /* height: 20px; */
      padding: 4px;
      line-height: 24px;
      color: rgba(255, 255, 255, 0.6);
      font-size: 16px;
      cursor: pointer;
    }

    .__subtitle_block:hover {
      /* transform: scale(1.1); */
      color:rgba(255, 255, 255, 0.9);
      font-weight: bold;
    }

    .__subtitle_block-active {
      /* font-size: 18px; */
      font-weight: bold;
      color: rgb(153, 225, 156) !important;
    }

    .__whole_subtitles {
      position: absolute;
      left: 0;
      top: 0;
      width: 800px;
      height: 700px;
      padding: 12px 24px;
      transform: translateX(-105%);
      font-size: 16px;
      line-height: 24px;
      background-color: #0f0f0f;
      color: rgba(255, 255, 255, 0.6);
      overflow: scroll;
      border: 1px solid rgba(255, 255, 255, 0.6);
      border-radius: 8px;
      display: none;
    }

    .__whole_subtitles div {
      padding: 4px;
    }

    .__whole_subtitles div span{
      margin-right: 8px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
      transform: scale(0.5);
      transform-origin: left center;
    }

    #__definition__ {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      width: 40vw;
      height: 400px;
      padding: 12px;
      border-radius: 4px;
      overflow: scroll;
      font-size: 14px;
      background-color: #fff;
    }
  </style>
  <img src="https://www.webwise.ie/wp-content/uploads/2014/04/Slider8.jpg" class="__extension_icon" />
  <div class="__video_subitles __video_subitles--hidden">
    <div class="__subtitles_head">
      <img src="https://s1.ax1x.com/2022/11/14/zA2N38.png" alt="prev" />
      <img src="https://s1.ax1x.com/2022/11/14/zA20Bj.png" alt="next" />
      <img src="https://s1.ax1x.com/2022/12/04/zsMHW8.png" alt="Repeat sentence">
      <img src="https://s1.ax1x.com/2022/12/12/zhTNwQ.png" alt="Whole paragraph">
    </div>
    <div class="__subtitles_content">

    </div>
    <div class="__whole_subtitles">

    </div>
    <div id="__definition__"></div>
  </div>
      `;
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
