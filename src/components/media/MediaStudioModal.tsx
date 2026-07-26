/**
 * [ZEN] MediaStudioModal Bridge
 * This file now serves as a thin bridge to the modularized Media Studio suite.
 */

import React from 'react';
import { MediaStudio } from './studio/MediaStudio';
import { MediaStudioProps } from './studio/types';

export const MediaStudioModal: React.FC<MediaStudioProps> = (props) => {
    return <MediaStudio {...props} />;
};

export type { UniversalMedia } from './studio/types';
