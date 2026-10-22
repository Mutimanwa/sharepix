import React from 'react';
import { Image } from 'react-native';

// Images
const emptyPhoto = require('../../assets/empty/album.png');
const emptyVideo = require('../../assets/empty/video.png');
const emptyFav = require('../../assets/empty/favorite.png');


export function EmptyPhotos({ size = 140 }) {
  return (
    <Image source={emptyPhoto} style={{ width: size, height: size }} />
  );
}

export function EmptyFavs({ size = 140 }) {
  return (
   <Image source={emptyFav} style={{width: size , height: size}} />
  );
}

export function EmptyVideos({ size = 140 }) {
  return (
   <Image source={emptyVideo} style={{width: size , height: size}} />
  );
}
