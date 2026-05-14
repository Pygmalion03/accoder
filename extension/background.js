const SIDE_PANEL_PATH = "sidebar.html";
const LEETCODE_CN_ORIGIN = "https://leetcode.cn";
const LOCAL_BASE = "http://127.0.0.1:43117";
const OPENED_TABS_KEY = "acmcoder.openedSidePanelTabs";
const openedTabs = new Set();

const QUESTION_QUERY = `query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId
    title
    translatedTitle
    difficulty
    content
    translatedContent
    topicTags {
      name
      translatedName
      slug
    }
  }
}`;

function isLeetCodeProblemUrl(url = "") {
  return /^https:\/\/leetcode\.(cn|com)\/problems\/[^/]+/.test(url);
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

async function syncOpenedTabsFromStorage() {
  const values = await storageGet([OPENED_TABS_KEY]);
  const tabIds = Array.isArray(values[OPENED_TABS_KEY]) ? values[OPENED_TABS_KEY] : [];
  openedTabs.clear();
  tabIds.forEach((tabId) => openedTabs.add(tabId));
}

async function persistOpenedTabs() {
  await storageSet({ [OPENED_TABS_KEY]: [...openedTabs] });
}

async function rememberOpenedTab(tabId) {
  openedTabs.add(tabId);
  await persistOpenedTabs();
}

async function forgetOpenedTab(tabId) {
  openedTabs.delete(tabId);
  await persistOpenedTabs();
}

async function setDefaultSidePanelClosed() {
  if (!chrome.sidePanel?.setOptions) {
    return;
  }

  await chrome.sidePanel
    .setOptions({
      path: SIDE_PANEL_PATH,
      enabled: false,
    })
    .catch(() => {});
}

async function updateSidePanelForTab(tabId, url = "") {
  if (!chrome.sidePanel?.setOptions) {
    return false;
  }

  const shouldOpen = isLeetCodeProblemUrl(url) && openedTabs.has(tabId);
  await chrome.sidePanel
    .setOptions({
      tabId,
      path: SIDE_PANEL_PATH,
      enabled: shouldOpen,
    })
    .catch(() => {});
  return shouldOpen;
}

async function restoreSidePanelForTab(tabId, url = "") {
  await syncOpenedTabsFromStorage();
  await updateSidePanelForTab(tabId, url);
}

async function openLocalAcmcoderTab() {
  await chrome.tabs.create({ url: LOCAL_BASE }).catch(() => {});
}

async function openAcmcoderForTab(tab) {
  if (!tab?.id || !isLeetCodeProblemUrl(tab.url || "")) {
    await openLocalAcmcoderTab();
    return;
  }

  await rememberOpenedTab(tab.id);
  await updateSidePanelForTab(tab.id, tab.url);

  if (chrome.sidePanel?.open) {
    await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }
}

async function fetchQuestionDataFrom(origin, slug) {
  const response = await fetch(`${origin}/graphql/`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      operationName: "questionData",
      variables: { titleSlug: slug },
      query: QUESTION_QUERY,
    }),
  });

  if (!response.ok) {
    throw new Error(`LeetCode GraphQL returned ${response.status}`);
  }

  const body = await response.json();
  return body?.data?.question || null;
}

async function fetchCanonicalQuestionData(slug, pageOrigin) {
  const origins = [LEETCODE_CN_ORIGIN, pageOrigin].filter((origin, index, list) => {
    return origin && /^https:\/\/leetcode\.(cn|com)$/.test(origin) && list.indexOf(origin) === index;
  });

  for (const origin of origins) {
    try {
      const question = await fetchQuestionDataFrom(origin, slug);
      if (question) {
        return question;
      }
    } catch {
      // Try the next origin. LeetCode can vary by region and login state.
    }
  }

  return null;
}

async function configureSidePanelDefaults() {
  await setDefaultSidePanelClosed();
}

chrome.runtime.onInstalled.addListener(() => {
  configureSidePanelDefaults();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") {
    return;
  }

  const url = changeInfo.url || tab.url;
  restoreSidePanelForTab(tabId, url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab) {
    await restoreSidePanelForTab(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  forgetOpenedTab(tabId);
});

chrome.action.onClicked.addListener((tab) => {
  openAcmcoderForTab(tab);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ACMCODER_PANEL_OPENED") {
    Promise.resolve()
      .then(async () => {
        if (!message.tabId || !isLeetCodeProblemUrl(message.url)) {
          return;
        }
        await rememberOpenedTab(message.tabId);
        await updateSidePanelForTab(message.tabId, message.url);
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type !== "ACMCODER_FETCH_QUESTION_DATA") {
    return false;
  }

  fetchCanonicalQuestionData(message.slug, message.origin)
    .then((question) => sendResponse({ ok: true, question }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
