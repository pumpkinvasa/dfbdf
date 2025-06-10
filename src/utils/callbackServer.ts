// Файл очищен от функциональности callback/webhook

// Экспортируем пустой класс для совместимости
export class CallbackServer {
  private static instance: CallbackServer;
  private callbacks: Map<string, (data: any) => void> = new Map();
  private server: any = null;

  static getInstance(): CallbackServer {
    if (!CallbackServer.instance) {
      CallbackServer.instance = new CallbackServer();
    }
    return CallbackServer.instance;
  }

  // Регистрируем глобальный обработчик callback'ов
  registerGlobalHandler(handler: (data: any) => void) {
    // Создаем эндпоинт для приема callback'ов
    this.setupCallbackEndpoint(handler);
  }

  private setupCallbackEndpoint(handler: (data: any) => void) {
    // Поскольку мы работаем в браузере, создаем имитацию сервера
    // через глобальный объект window
    (window as any).handleAnalysisCallbackFromBackend = (data: any) => {
      console.log('Received callback from backend:', data);
      handler(data);
    };    // Также можно создать fetch interceptor для обработки POST запросов
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : 
                  input instanceof Request ? input.url : 
                  input instanceof URL ? input.href : 
                  String(input);
      
      // Перехватываем запросы к нашему callback endpoint
      if (url.includes('/api/analysis-callback') && init?.method === 'POST') {
        try {
          const data = JSON.parse(init.body as string);
          setTimeout(() => handler(data), 0); // Асинхронная обработка
          return new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Error handling callback:', error);
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Для всех остальных запросов используем оригинальный fetch
      return originalFetch(input, init);
    };
  }

  // Альтернативный способ - через Service Worker
  setupServiceWorkerCallback(handler: (data: any) => void) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/callback-worker.js')
        .then((registration) => {
          console.log('Callback service worker registered:', registration);
          
          // Отправляем обработчик в Service Worker
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'CALLBACK_RECEIVED') {
              handler(event.data.payload);
            }
          });
        })
        .catch((error) => {
          console.error('Service worker registration failed:', error);
          // Fallback к fetch interceptor
          this.setupCallbackEndpoint(handler);
        });
    } else {
      // Fallback если Service Worker не поддерживается
      this.setupCallbackEndpoint(handler);
    }
  }
}

// Экспортируем singleton instance
export const callbackServer = CallbackServer.getInstance();
