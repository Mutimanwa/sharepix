import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform } from 'react-native';

/**
 * Suit la hauteur réelle du clavier.
 *
 * Pourquoi : Expo SDK 57 (RN 0.86) tourne en edge-to-edge sur Android. Dans ce
 * mode, `adjustResize` n'est plus appliqué et `KeyboardAvoidingView` avec
 * `behavior="height"` ne remonte plus correctement les champs — d'où les
 * « l'input ne s'ouvre pas / le clavier cache la barre de saisie ».
 *
 * `space` est une `Animated.Value` à appliquer en marge (ou padding) basse :
 *  - `space`   = hauteur du clavier, 0 quand il est fermé ;
 *  - `isOpen`  = booléen pratique pour ajuster les marges de sécurité.
 *
 * `maxOffset` permet de plafonner la marge (ex. un sheet limité à 85 % de
 * l'écran) : passer la hauteur utile du conteneur.
 */
export function useKeyboardSpace({ maxOffset } = {}) {
  const space = useRef(new Animated.Value(0)).current;
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e) => {
      setIsOpen(true);
      const raw = e?.endCoordinates?.height ?? 0;
      const target = maxOffset ? Math.min(raw, maxOffset) : raw;
      Animated.timing(space, {
        toValue: target,
        duration: Platform.OS === 'ios' ? e?.duration || 250 : 0,
        useNativeDriver: false,
      }).start();
    };

    const onHide = (e) => {
      setIsOpen(false);
      Animated.timing(space, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e?.duration || 200 : 0,
        useNativeDriver: false,
      }).start();
    };

    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [space, maxOffset]);

  return { space, isOpen };
}
