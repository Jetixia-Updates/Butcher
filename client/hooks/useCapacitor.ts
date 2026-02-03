import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';

/**
 * Hook to initialize Capacitor plugins for native mobile apps
 * This should be called once at the app root level
 */
export function useCapacitorInit() {
  useEffect(() => {
    const initCapacitor = async () => {
      // Only run on native platforms (iOS/Android)
      if (!Capacitor.isNativePlatform()) {
        return;
      }

      try {
        // Configure status bar - Default to light style (dark text) for Day Mode
        await StatusBar.setStyle({ style: Style.Light });
        
        if (Capacitor.getPlatform() === 'android') {
          // White background for the status bar on Android
          await StatusBar.setBackgroundColor({ color: '#ffffff' });
        }

        // Hide splash screen after app is ready
        await SplashScreen.hide();

        // Handle keyboard events on iOS
        if (Capacitor.getPlatform() === 'ios') {
          Keyboard.addListener('keyboardWillShow', () => {
            document.body.classList.add('keyboard-open');
          });
          
          Keyboard.addListener('keyboardWillHide', () => {
            document.body.classList.remove('keyboard-open');
          });
        }

        // Handle Android back button
        App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            // Ask user if they want to exit the app
            App.exitApp();
          }
        });

        // Handle app state changes (foreground/background)
        App.addListener('appStateChange', ({ isActive }) => {
          console.log('App state changed. Is active:', isActive);
        });

      } catch (error) {
        console.error('Error initializing Capacitor:', error);
      }
    };

    initCapacitor();

    // Cleanup listeners on unmount
    return () => {
      if (Capacitor.isNativePlatform()) {
        App.removeAllListeners();
        Keyboard.removeAllListeners();
      }
    };
  }, []);
}

/**
 * Check if running as a native mobile app
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Get the current platform
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}
