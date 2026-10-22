import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** État du clavier, utilisé seulement pour ajuster le padding visuel du composer. */
export function useKeyboardStatus() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setIsOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setIsOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return isOpen;
}
