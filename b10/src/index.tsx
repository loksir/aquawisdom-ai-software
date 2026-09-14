import React from "react";
import ReactDOM from "react-dom";
import { createRoot } from 'react-dom/client';
import "./index.css";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import configureStore from "./store/configureStore";
import ErrorBoundary from "./components/ErrorBoundary";
import ReactModal from "react-modal";
import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink } from "@apollo/client";
import { setContext } from '@apollo/client/link/context';

// ============================================================================
// B10 PRODUCTION API CONFIGURATION
// ============================================================================

// B10 Mini PC Configuration
const API_URL = 'https://192.168.0.151:8502/graphql';
console.log(`🔗 Connecting to B10 API: ${API_URL}`);

// Create HttpLink
const httpLink = createHttpLink({
  uri: API_URL,
  credentials: "include",
});

// Apollo Client Configuration
const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

console.log('🚀 B10 App starting...');
console.log('📡 API URL:', API_URL);

// Test connection on app start
const testConnection = async () => {
  try {
    const healthUrl = 'https://192.168.0.151:8502/health';
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(id);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ B10 Server connection successful:', data);
    } else {
      console.warn('⚠️ B10 Server health check failed:', response.status);
    }
  } catch (err) {
    let msg = 'Network error';
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        msg = 'Timeout: B10 server not responding';
      } else {
        msg = err.message;
      }
    }
    console.error('❌ B10 Server connection failed:', msg);
  }
};

testConnection();

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <Provider store={configureStore()}>
    <BrowserRouter>
      <ApolloProvider client={client}>
        <ErrorBoundary>{[<App key="App" />]}</ErrorBoundary>
      </ApolloProvider>
    </BrowserRouter>
  </Provider>
);

ReactModal.setAppElement("#root");