/** Defense in depth: the static demo has no application network API. */
export function installNetworkGuard() {
  const blocked = () => { throw new Error('Comunicação de rede desativada nesta demonstração.'); };
  globalThis.fetch = async () => blocked();
  globalThis.XMLHttpRequest = class { constructor() { blocked(); } } as unknown as typeof XMLHttpRequest;
  globalThis.WebSocket = class { constructor() { blocked(); } } as unknown as typeof WebSocket;
  globalThis.EventSource = class { constructor() { blocked(); } } as unknown as typeof EventSource;
  Object.defineProperty(navigator, 'sendBeacon', { value: () => false, configurable: false });
}
