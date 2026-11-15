export {};

declare global {
  interface Window {
    oorumGoogleInitializedClientId?: string;
    oorumGoogleSignInCallback?: (credential: string) => void;
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type: 'standard';
              theme: 'outline';
              size: 'large';
              text: 'continue_with';
              shape: 'rectangular';
              width: number;
            },
          ) => void;
        };
      };
    };
  }
}
