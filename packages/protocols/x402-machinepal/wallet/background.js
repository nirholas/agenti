chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_REMAINING_USDC' });
});

