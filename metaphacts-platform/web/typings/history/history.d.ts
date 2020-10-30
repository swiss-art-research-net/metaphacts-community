declare module 'history' {
  interface History {
    location: Location;
    entries: Location[];
    listen(callback: (location: Location, action: any) => void): void;
    push(url: string): void;
    goBack(): void;
    goForward(): void;
  }

  function createMemoryHistory(params: {
    initialEntries: string[];
    initialIndex: number;
  }): History;

  function createBrowserHistory(): History;
}
