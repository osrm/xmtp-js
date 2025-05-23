import "@mantine/core/styles.css";
import "./globals.css";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import pkg from "@xmtp/browser-sdk/package.json";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { createConfig, http, WagmiProvider } from "wagmi";
import {
  base,
  baseSepolia,
  mainnet,
  polygon,
  polygonAmoy,
  sepolia,
} from "wagmi/chains";
import {
  coinbaseWallet,
  injected,
  metaMask,
  walletConnect,
} from "wagmi/connectors";
import { App } from "@/components/App/App";
import { XMTPProvider } from "@/contexts/XMTPContext";

const queryClient = new QueryClient();

export const config = createConfig({
  connectors: [
    injected(),
    coinbaseWallet({
      appName: "xmtp.chat",
    }),
    metaMask(),
    walletConnect({ projectId: import.meta.env.VITE_PROJECT_ID }),
  ],
  chains: [mainnet, base, sepolia, baseSepolia, polygon, polygonAmoy],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [polygon.id]: http(),
    [polygonAmoy.id]: http(),
  },
});

createRoot(document.getElementById("root") as HTMLElement).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <MantineProvider defaultColorScheme="auto">
        <XMTPProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </XMTPProvider>
      </MantineProvider>
    </QueryClientProvider>
  </WagmiProvider>,
);

console.log("[xmtp.chat] XMTP Browser SDK version:", pkg.version);
