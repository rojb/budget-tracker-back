import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  PHOTO_SUGGESTION_IDS,
  type PhotoSuggestionId,
} from '../photo-suggestions.js';

export class PhotoSuggestionDto {
  @ApiProperty({ enum: PHOTO_SUGGESTION_IDS, enumName: 'PhotoSuggestionId' })
  id!: PhotoSuggestionId;

  @ApiProperty({ example: 'Vacaciones' })
  name!: string;

  @ApiProperty({
    description: "Path, relative to the API, of the suggestion's image.",
    example: '/envelope-photo-suggestions/vacaciones/image',
  })
  imageUrl!: string;
}

export class SuggestedPhotoRequestDto {
  @ApiProperty({ enum: PHOTO_SUGGESTION_IDS, enumName: 'PhotoSuggestionId' })
  @IsIn(PHOTO_SUGGESTION_IDS)
  suggestionId!: PhotoSuggestionId;
}
