import MParser from "../main/mdict/mdict-parser.js";
import MRenderer from "../main/mdict/mdict-renderer";
import jquery from "../main/mdict/jquery.js";
import { ipcRenderer } from "electron";

const TRANSLATE_ICON_CLS = '__translate_icon__'

let isControllerInit = false;
class Queue {
  queue = [];

  add(data) {
    this.queue.push(data);
  }

  pop() {
    return this.queue.shift();
  }
}

export const queue = new Queue();

function initJquery() {
  if (window.__jquery) {
    window.$ = window.__jquery;
    return;
  }
  // if (window.__jquery) return;
  window.$ = window.jquery = window.__jquery = jquery(window);
}

// Create subtitle line
export default function () {
  console.log("Controller.js ============> ");
  let videoEl = null;
  let subtitleData = []; // 字幕数据

  let inited = false;
  let timer;
  let curSubtitleStartIndex = 0; // 当前字幕的起始区间索引
  let pageSize = 10; // 每页显示的字幕数
  let pageTotal = 0; // 字幕总页数
  let curRenderIdx = []; // 当前渲染的字幕索引区间
  let curSubtitleDataIndex = 0; // 当前正在播放的字幕索引
  let isSubtitleChange = true; // 字幕是否发生变动
  let contentDom = null; // 字幕内容 dom
  // how is repeat status : When a sentence endwith symbol '.', means its the sentence end, otherwise not.
  let isRepeat = false; // 是否是重复播放状态
  let repeatSentenceStartIndex = -1;
  let isDisplayWholeSubtitle = false; // whether display whole subtitles
  let videoChanged = true;
  let mdict; // dict data

  function msToSecondOffset(ms) {
    return Math.max(ms - 100, 0) / 1000;
  }

  function genSubtitleBlock(text, startTimeMs) {
    const el = document.createElement("div");
    el.className = "__subtitle_block";
    el.innerHTML = text;
    el.onclick = () => {
      // console.log('startTimeMs: ', startTimeMs);
      videoEl.currentTime = msToSecondOffset(startTimeMs);
      videoEl.play();
    };
    return el;
  }

  function getContentDom() {
    return document.querySelector(".__subtitles_content");
  }

  function genRepeatIcon() {
    const img = document.createElement("img");
    img.src = "https://s1.ax1x.com/2022/12/04/zsMHW8.png";
    img.alt = "Repeat sentence";
    return img;
  }

  function findIndexMatchVideoTime(timeMs) {
    // console.log('timeMs: ', timeMs);
    let len = subtitleData.length;
    let result = -1;
    let slideIndex = [0, len - 1];
    // 如果滑动窗口的起始值已经是数据最后一个, 说明视频已处于末尾最后
    // TODO: 是否要判断 最后的时间 已经没有了字幕
    while (len && slideIndex[0] < len - 1 && slideIndex[0] < slideIndex[1]) {
      const first = slideIndex[0];
      const last = slideIndex[1];
      const diff = last - first;
      const half = Math.ceil(diff / 2);
      const { tStartMs, dDurationMs } = subtitleData[first + half];
      if (timeMs >= tStartMs && timeMs <= tStartMs + dDurationMs) {
        // 匹配到字幕
        const matchIndex = first + half;
        result = matchIndex;
        break;
      }
      if (timeMs > tStartMs && timeMs > tStartMs + dDurationMs) {
        slideIndex = [first + half, slideIndex[1]];
      }
      if (timeMs < tStartMs) {
        slideIndex = [slideIndex[0], first + half - 1];
      }
    }

    // console.log('slideIndex: ', slideIndex);
    /* 
      还有一种情况: 当前时间在中间, 但是有一段时间是没有字幕的, 此时上面的循环匹配不到
      这时候 slideIndex 窗口应该是相等的两个数
     */
    //
    if (slideIndex[0] === slideIndex[1]) {
      const { tStartMs, dDurationMs } = subtitleData[slideIndex[0]];
      if (timeMs >= tStartMs && timeMs <= tStartMs + dDurationMs) {
        return slideIndex[0];
      }
      if (timeMs > tStartMs) {
        return Math.min(slideIndex[0] + 1, len - 1);
      }
      if (timeMs < tStartMs) {
        return Math.max(slideIndex[0] - 1, 0);
      }
    }
    return result;
  }

  function renderSubtitle(startIndex) {
    // console.log('startIndex: ', startIndex);
    const arr = [];
    for (
      let i = startIndex;
      i < startIndex + pageSize && i <= subtitleData.length - 1;
      i++
    ) {
      const { segs = [], tStartMs } = subtitleData[i];
      arr.push(genSubtitleBlock(segs[0].utf8 || "", tStartMs));
    }
    const subtitleContentEl = getContentDom();
    subtitleContentEl.innerHTML = "";
    subtitleContentEl.append(...arr);
    curRenderIdx = [startIndex, startIndex + pageSize - 1];
  }

  // 更新正在播放的的字幕样式
  function toggleActiveSubtitleStyle() {
    if (!isSubtitleChange) return;
    const index = curSubtitleDataIndex % pageSize;
    const subtitleContentEls = document.querySelectorAll(".__subtitle_block");
    [...subtitleContentEls].forEach((el, idx) => {
      if (idx === index) {
        el.classList.add("__subtitle_block-active");
      } else {
        el.classList.remove("__subtitle_block-active");
      }
    });
  }

  // if isRepeat is true, means the sentence needs to be repeat.
  let prevSentenceStr = ""; // Record end string to decide repeatSentenceStartIndex is right, no need to recalc if its right
  let repeatCurTimeMs = 0;
  function backToSentenceStartIfNeedRepeat() {
    if (!isRepeat) return;

    // record repeat index
    const curSubtitle = subtitleData[curSubtitleDataIndex] || {};
    const { segs = [] } = curSubtitle;
    const subtitleUtf8 = segs[0] && segs[0].utf8;
    if (
      prevSentenceStr &&
      prevSentenceStr.endsWith(".") &&
      subtitleUtf8 !== prevSentenceStr
    ) {
      // Means its next sentence now, back to last sentence
    }
    if (!subtitleUtf8 || !subtitleUtf8.endsWith(".")) return;

    repeatCurTimeMs = Date.now();
    if (subtitleUtf8 && subtitleUtf8.endsWith(".")) {
      // Means its last, back to start when its finish
      repeatSentenceEndStr = subtitleUtf8;
    }
  }

  function videoListenerFn(e) {
    handleWholeSubtitlesStyle()
    const currentTimeMs = videoEl.currentTime * 1000;
    const matchSubtitleIndex = findIndexMatchVideoTime(currentTimeMs);
    if (curSubtitleDataIndex !== matchSubtitleIndex) {
      // console.log('matchSubtitleIndex: ', matchSubtitleIndex);
      isSubtitleChange = true;
      curSubtitleDataIndex = matchSubtitleIndex;
    }
    if (matchSubtitleIndex >= subtitleData.length) {
      // 说明在视频末尾了, 且后续没有字幕了, 那么显示最后一页字幕
      curSubtitleStartIndex = (pageTotal - 1) * pageSize;
    } else {
      curSubtitleStartIndex =
        Math.floor(matchSubtitleIndex / pageSize) * pageSize;
    }

    // console.log('curSubtitleStartIndex: ', curSubtitleStartIndex);
    // 如果索引还处在已渲染的区间内, 则不做任何渲染操作
    if (
      curRenderIdx.length &&
      curSubtitleStartIndex >= curRenderIdx[0] &&
      curSubtitleStartIndex <= curRenderIdx[1]
    ) {
      toggleActiveSubtitleStyle();
      // backToSentenceStartIfNeedRepeat();
      return;
    }
    // 渲染字幕
    renderSubtitle(curSubtitleStartIndex);
    toggleActiveSubtitleStyle();
    // backToSentenceStartIfNeedRepeat();
  }

  function videoListener() {
    const video = document.querySelector("video");
    // console.log('videoEl === video: ', videoEl === video);
    if (videoEl === video) return;
    videoEl = video;
    videoEl.removeEventListener("timeupdate", videoListenerFn);
    videoEl.addEventListener("timeupdate", videoListenerFn);
  }

  function navigateSentence(newDataIndex) {
    const subtitle = subtitleData[Math.max(newDataIndex, 0)];
    if (subtitle) {
      const { tStartMs } = subtitle;
      videoEl.currentTime = msToSecondOffset(tStartMs);
    }
  }

  function repeatSentence(el) {
    isRepeat = !isRepeat;
    if (isRepeat) {
      el.style.backgroundColor = "rgba(240,240,240, 0.5)";
    } else {
      el.style.backgroundColor = "";
    }
  }

  function handleWholeSubtitlesStyle() {
    const wholeSubtitleEl = document.querySelector(".__whole_subtitles");
    if (wholeSubtitleEl) {
      const subtitleDoms = wholeSubtitleEl.querySelectorAll('.__subtitle_sentence__')
      
      const currentTimeMs = videoEl.currentTime * 1000;
      let targetDom = null;
      let targetIdx = 0;
      Array.from(subtitleDoms).some((item, index) => {
        const domMs = item.getAttribute('startms')
        if (domMs <= currentTimeMs) {
          targetDom = item;
          targetIdx = index
        }
        return domMs && parseInt(domMs) > currentTimeMs
      })
      // 删除上次新增的 class
      const activeDom = document.querySelector('.__subtitle_sentence__active__')
      activeDom && activeDom.classList.remove('__subtitle_sentence__active__')
      if (targetDom) {
        targetDom.classList.add('__subtitle_sentence__active__')
        // Display current/prev/next whole sentence in control panel
        // Why display three sentence: Current highlight sentence may not exactly correct
        const idxs = [targetIdx - 1, targetIdx, targetIdx + 1].filter(d => d >= 0);
        const finalHtml = idxs.reduce((html, idx) => {
          let dom = subtitleDoms[idx]
          const isActiveDom = dom === targetDom
          const sentenceCls = isActiveDom ? '__active_whole_current_sentence__' : ''
          if (dom) {
            html += `<div class="__whole_current_sentence__ ${sentenceCls}"><img class="${TRANSLATE_ICON_CLS}" src="https://s1.ax1x.com/2023/08/07/pPEZqd1.png" />${dom.innerHTML.replace(/<span.+\/span>/, '')}</div>`
          }
          return html
        }, '')
        document.querySelector('#__current_subtitle__').innerHTML = finalHtml;
      }
    }
  }

  function displayWholeSubtitleIndividual() {
    isDisplayWholeSubtitle = !isDisplayWholeSubtitle;
    setTimeout(() => {
      handleWholeSubtitlesStyle()
    }, 100);
    parseSubtitlesIntoSentence((wholeSubtitleEl) => {
      wholeSubtitleEl.style.display = isDisplayWholeSubtitle ? "block" : "none";
    })
  }

  function parseSubtitlesIntoSentence(fn) {
    const wholeSubtitleEl = document.querySelector(".__whole_subtitles");
    if (wholeSubtitleEl) {
      fn && fn(wholeSubtitleEl)
      
      if (!wholeSubtitleEl.innerHTML || videoChanged) {
        // insert subtitles to el
        let isSentenceProcessing = false;
        let isQuote = false;
        let num = 0;
        let total = 0;
        const DIV_PREFIX =
          "<div class='__subtitle_sentence__' startms=${ms}><span class='__sentence_count__'>${num}/${total}</span>";
        const len = subtitleData.length;
        let wholeSubtitleText = subtitleData
          .map((item, index) => {
            const { segs = [] } = item;
            let t = segs[0] && segs[0].utf8;
            const matchWordReg = /([a-zA-Z\-]+)/gi;
            t = t.replace(matchWordReg, `<word>$1</word>`);
            // let prefix = ''
            // let suffix = ' '
            // if (!isSentenceProcessing) {
            //   num += 1;
            //   // prefix = `<div><span>${num}/\${total}</span>`
            //   isSentenceProcessing = true;
            // }
            // if (isQuote && /[”"]/.test(t)) {
            //   isQuote = false;
            // } else if (/[“"]/.test(t) && !/”/.test(t) && (t.match(/[“"]/g).length % 2) > 0) {
            //   isQuote = true;
            // }
            const isLast = index === len -1;
            let prefix = '';
            if (!isLast) {
              const { tStartMs } = subtitleData[index + 1];
              prefix = DIV_PREFIX.replace('${ms}', tStartMs + '')
            }
            let sentenceEndReg =
              /(\w(?<!Mr))(<\/word>)?(\.{1,}|\!|\?)("?)([^\d\<]?)/gi;
            const r = t.replace(
              sentenceEndReg,
              `$1$2$3$4$5</div>${!isLast ? prefix : ''}`
            );
            // const isLastSentence = /\w\.?(\.|\!|\?|”|")$/i.test(t);
            // if (isLastSentence && !isQuote) {
            //   // suffix = '</div>'
            //   isSentenceProcessing = false;
            //   total += 1
            // }
            // return prefix + t + suffix;
            return r;
          })
          .join(" ");
        if (wholeSubtitleText) {
          wholeSubtitleText = DIV_PREFIX.replace('${ms}', '0') + wholeSubtitleText;
        }
        const m = wholeSubtitleText.match(/\${num}/g);
        if (m) {
          for (let i = 0; i < m.length; i++) {
            wholeSubtitleText = wholeSubtitleText
              .replace("${num}", i + 1)
              .replace("${total}", m.length);
          }
        }
        let isEnd;

        wholeSubtitleEl.innerHTML = wholeSubtitleText;
        videoChanged = false;
      }
    }
  }

  function controllListener() {
    /**
     * img1: Prev
     * img2: Next
     * img3: Repeat
     * img4: Display whole subtitles in individual content
     *  */
    const icons = document.querySelectorAll(".__subtitles_head img");
    const prev = icons[0];
    const next = icons[1];
    const repeat = icons[2];
    const displayWholeSubtitleIcon = icons[3];
    prev.onclick = () => {
      navigateSentence(curSubtitleDataIndex - 1);
    };
    next.onclick = () => {
      navigateSentence(curSubtitleDataIndex + 1);
    };
    repeat.onclick = () => repeatSentence(repeat);
    displayWholeSubtitleIcon.onclick = displayWholeSubtitleIndividual;
    parseSubtitlesIntoSentence()
  }

  function initDictData(fileList) {
    if (fileList.length > 0) {
      MParser(fileList).then(function (resources) {
        console.log("<--------- dict parse success --------->");
        // console.log('resources: ', resources);
        mdict = MRenderer(resources);
        // setMdict(mdict)
      });
    }
  }

  function lookup(word) {
    if (!word) return;
    mdict.lookup(word).then(($content) => {
      window.__jquery("#__definition__").empty().append($content.contents());
      console.log("Dict render done!!!");
    });
  }

  function initContainerStyle() {
    const youtubeContainer = document.querySelector("#container");
    const el = document.querySelector(".__video_subitles");
    el.style["min-height"] = youtubeContainer.getBoundingClientRect().height;
  }

  function translateByGoogle(str) {
    str = str.replace(';', ',')
    fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&dj=1&q=${str}`
    ).then(async (res) => {
      const data = await res.json();
      if (data && data.sentences) {
        const transSentence = data.sentences[0];
        const trans = transSentence && transSentence.trans;
        renderTransSentence(str, trans);
      }
    });
  }

  function renderTransSentence(originStr, transStr) {
    const originDiv = document.createElement("div");
    const transDiv = document.createElement("div");
    originDiv.innerHTML = originStr;
    transDiv.innerHTML = transStr;
    originDiv.style =
      "font-size: 14px; font-style: italic; margin-bottom: 8px;";
    transDiv.style = "font-size: 16px; font-weight: bold;";
    window.__jquery("#__definition__").empty().append([originDiv, transDiv]);
  }

  function handleWordClick() {
    window.document.onclick = (e) => {
      if (e.target.tagName === "WORD" || e.target.tagName === "word") {
        lookup(e.target.textContent);
      }
      if (e.target.className === TRANSLATE_ICON_CLS) {
        const parentEl = e.target.parentElement;
        if (!parentEl || !parentEl.className.includes("__whole_current_sentence__ ")) return;
        const s = Array.from(parentEl.childNodes)
          .slice(1)
          .map((node) =>
            node.nodeName === "#text" ? node.textContent : node.innerText
          )
          .join("");
        translateByGoogle(s);
      }
    };
  }

  async function main() {
    // console.log("dict json::: ", ipcRenderer.invoke('get-dict-files'))
    initJquery();
    handleWordClick();
    // handleDictInputListener();
    const dictFiles = await ipcRenderer.invoke("get-dict-files");
    initDictData(dictFiles);
    // if (inited) return;
    let cachedSubtitleData = window.localStorage.getItem("__subtitles_data__");
    if (!cachedSubtitleData) return;
    cachedSubtitleData = JSON.parse(cachedSubtitleData);
    subtitleData = cachedSubtitleData.events || [];
    const subtitleContentEl = getContentDom();
    if (subtitleContentEl) {
      pageTotal = Math.ceil(subtitleData.length / pageSize);
      // video 时间监听
      videoListener();
      controllListener();
      // setTimeout(() => {
      //   initContainerStyle()
      // }, 1000);
      // inited = true;
    } else {
      // timer = setTimeout(main, 1500)
    }
  }

  function toggleContent() {
    // if (!inited) return;
    const el = document.querySelector(".__video_subitles");
    const hiddenCls = "__video_subitles--hidden";
    if (el.classList.contains(hiddenCls)) {
      el.classList.remove(hiddenCls);
    } else {
      el.classList.add(hiddenCls);
    }
  }

  function init() {
    const iconEl = document.querySelector(".__extension_icon");
    iconEl.onclick = () => {
      main();
      toggleContent();
    };
    // const subtitleContentEl = document.querySelector(".__subtitles_content");
    main();
  }

  init();
  if (isControllerInit) return;
  isControllerInit = true;
  window.addEventListener("message", (e) => {
    const { event, data } = e.data;
    if (event === "__subtitles_data_cached__") {
      subtitleData = [];
      curSubtitleStartIndex = 0;
      curRenderIdx = [];
      curSubtitleDataIndex = 0;
      isSubtitleChange = true;
      repeatSentenceStartIndex = -1;
      videoChanged = true;
      main();
    }
  });
}
