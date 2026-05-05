export interface MediaItem {
    url: string;
    width: number;
    height: number;
}

export interface MemoryLocation {
    latitude: number;
    longitude: number;
}

export interface Memory {
    id: string;
    primary: MediaItem;
    secondary: MediaItem;
    thumbnail: MediaItem;
    memoryDay: string;
    isLate: boolean;
    takenAt?: string;
    location?: MemoryLocation;
}

export interface MemoriesFeedResponse {
    data: Memory[];
    next?: string;
}
