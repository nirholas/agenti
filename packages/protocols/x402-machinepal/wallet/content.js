// 1. Create the tooltip element immediately
const tooltip = document.createElement('div');
tooltip.id = 'machinepal-payment-tooltip';
document.body.appendChild(tooltip);

// 2. Variable to track cursor position
let mouseX = 0;
let mouseY = 0;

// 3. Track mouse movement globally to position the tooltip
document.addEventListener('mousemove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;

    // Position tooltip slightly offset from cursor so it doesn't block view
    tooltip.style.left = (mouseX + 15) + 'px';
    tooltip.style.top = (mouseY + 15) + 'px';
});

// Initialize remainingUSDC in storage if it's not there
chrome.storage.local.get(['remainingUSDC'], (result) => {
    if (typeof result.remainingUSDC !== 'number') {
        chrome.storage.local.set({ remainingUSDC: 10.00 });
    }
});

// 4. Use Event Delegation for performance (instead of attaching listeners to every link)
document.addEventListener('mouseover', (event) => {
    // Check if the hovered element (or its parent) is an anchor tag
    const link = event.target.closest('a');

    if (link) {
        chrome.storage.local.get(['remainingUSDC'], (result) => {
            const usdc = result.remainingUSDC || 0;
            tooltip.textContent = `Pay 1 cent USDC to read.\nRemaining: ${usdc.toFixed(2)} USDC`;
            tooltip.classList.remove('paid-status'); // Reset status
            tooltip.style.display = 'block';
        });
    }
});

document.addEventListener('mouseout', (event) => {
    const link = event.target.closest('a');

    if (link) {
        tooltip.style.display = 'none';
    }
});

document.addEventListener('click', (event) => {
    const link = event.target.closest('a');

    if (link) {
        chrome.storage.local.get(['remainingUSDC'], (result) => {
            let usdc = result.remainingUSDC || 0;
            // Decrease remaining USDC by 0.01, minimum 0
            usdc = Math.max(0, usdc - 0.01);
            chrome.storage.local.set({ remainingUSDC: usdc }, () => {
                tooltip.textContent = `Paid. Remaining: ${usdc.toFixed(2)} USDC`;
                tooltip.classList.add('paid-status');

                // Ensure it is visible (in case of edge case timing)
                tooltip.style.display = 'block';
            });
        });

        // Note: We do not preventDefault() here, so the link will still open.
        // If the link opens in the same tab, the "Paid" message appears briefly before unload.
        // If it opens in a new tab/window, the "Paid" message remains on the current page.
    }
});

// Listen for messages from the extension (browser action)
chrome.runtime?.onMessage?.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'SHOW_REMAINING_USDC') {
        chrome.storage.local.get(['remainingUSDC'], (result) => {
            const usdc = result.remainingUSDC || 0;
            tooltip.textContent = `Remaining: ${usdc.toFixed(2)} USDC`;
            tooltip.classList.remove('paid-status');
            tooltip.style.left = (window.innerWidth - 180) + 'px'; // Top-right corner
            tooltip.style.top = '20px';
            tooltip.style.display = 'block';
            setTimeout(() => {
                tooltip.style.display = 'none';
            }, 2000);
        });
    }
});
