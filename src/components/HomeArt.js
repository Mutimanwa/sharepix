import React from 'react';
import { Image } from 'react-native';
import Svg, { Circle, Rect, Path, Ellipse } from 'react-native-svg';

export function IconVacances({ size = 80 }) {
  return (
    <Image source={require('../../assets/idee/vacance.png')}
       style={{ width: size, height: size }}
    />
  );
}

export function IconFamille({ size = 80 }) {
  return (
       <Image source={require('../../assets/idee/famille.png')}
       style={{ width: size, height: size }}
    />
  );
}

export function IconBebe({ size = 80 }) {
  return (
       <Image source={require('../../assets/idee/moment.png')}
       style={{ width: size, height: size }}
    />
  );
}

export function IconSpecial({ size = 80 }) {
  return (
       <Image source={require('../../assets/idee/smile.png')}
       style={{ width: size, height: size }}
    />
  );
}

export function TabHome({ color, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 11 L12 4 L20 11 V20 H15 V14 H9 V20 H4 Z" fill={color} />
    </Svg>
  );
}

export function TabBell({ color, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 16 V11 A6 6 0 0 1 18 11 V16 L20 18 H4 Z" fill={color} />
      <Path d="M10 19 A2 2 0 0 0 14 19" stroke={color} strokeWidth="2" fill="none" />
    </Svg>
  );
}

export function TabUser({ color, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="8" r="4" fill={color} />
      <Path d="M5 20 C6 15 18 15 19 20 Z" fill={color} />
    </Svg>
  );
}
