/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | @nichxbt
 *  ID: n1ch-0las-4e49-4348-786274000000
 * ═══════════════════════════════════════════════════════════════
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "./Providers";
import { PaywallApp } from "./PaywallApp";

// Initialize the app when the window loads
window.addEventListener("load", () => {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("Root element not found");
    return;
  }

  const root = createRoot(rootElement);
  root.render(
    <Providers>
      <PaywallApp />
    </Providers>,
  );
});


/* ucm:n1ch6c9ad476 */