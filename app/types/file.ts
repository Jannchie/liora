export type FileKind = 'PAINTING' | 'PHOTOGRAPHY';

export interface FileMetadata {
  fanworkTitle: string;
  characters: string[];
  location: string;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  cameraModel: string;
  aperture: string;
  focalLength: string;
  iso: string;
  shutterSpeed: string;
  captureTime: string;
  notes: string;
}

export interface FilePayload {
  kind: FileKind;
  width: number;
  height: number;
  title?: string;
  description?: string;
  fanworkTitle?: string;
  characters?: string[];
  location?: string;
  locationName?: string;
  latitude?: number | null;
  longitude?: number | null;
  cameraModel?: string;
  aperture?: string;
  focalLength?: string;
  iso?: string;
  shutterSpeed?: string;
  captureTime?: string;
  notes?: string;
}

export interface FileResponse {
  id: number;
  kind: FileKind;
  title: string;
  description: string;
  imageUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  metadata: FileMetadata;
  fanworkTitle: string;
  location: string;
  cameraModel: string;
  characters: string[];
  createdAt: string;
}
