import React from 'react';
import Svg, { Circle, Rect, Path, G, Ellipse } from 'react-native-svg';
import { colors } from '../theme';
import { Image } from 'react-native';
const image1 = require('../../assets/ilustration/01.png');
const image2 = require('../../assets/ilustration/02.png');
const image3 = require('../../assets/ilustration/03.png');



export function ArtShare({ size = 260 }) {
  return (
    <Image source={image1} style={{ width: size, height: size }} />
  );
}

export function ArtPrivate({ size = 260 }) {
  return (
   <Image source={image2} style={{ width: size, height: size }} />
  );
}

export function ArtQuality({ size = 260 }) {
  return (
    <Image source={image3} style={{ width: size, height: size }} />
  );
}
