import { Network } from '@capacitor/network';

export async function isOnHomeWiFi(): Promise<boolean> {
  try {
    // 1. Check if device has internet at all
    const status = await Network.getStatus();
    if (!status.connected) return false;

    // 2. Ping the HTTPS GraphQL endpoint to avoid Mixed Content errors
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const response = await fetch('https://192.168.0.151:8501/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok; // If it responds, we are at home!
  } catch (error) {
    return false; // Timeout or network error means we are outside
  }
}

export async function hasInternet(): Promise<boolean> {
  const status = await Network.getStatus();
  return status.connected;
}

// import { Network } from '@capacitor/network';


// export async function isOnHomeWiFi(): Promise<boolean> {
//  try {
//    // 1. Check if device has internet at all
//    const status = await Network.getStatus();
//    if (!status.connected) return false;


//    // 2. Ping the Mini PC directly (1.5s timeout)
//    const controller = new AbortController();
//    const timeoutId = setTimeout(() => controller.abort(), 1500);


//    const response = await fetch('http://192.168.0.151:5019/api/sync', {
//      method: 'POST',
//      headers: { 'Content-Type': 'application/json' },
//      body: JSON.stringify({ since: '1970-01-01T00:00:00.000Z' }),
//      signal: controller.signal
//    });
  
//    clearTimeout(timeoutId);
//    return response.ok; // If it responds, we are at home!
//  } catch (error) {
//    return false; // If it times out or fails, we are outside
//  }
// }


// export async function hasInternet(): Promise<boolean> {
//  const status = await Network.getStatus();
//  return status.connected;
// }
