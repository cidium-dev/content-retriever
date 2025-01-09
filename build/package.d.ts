type ResourceData = {
    url: string;
    type: ResourceType;
    title?: string;
    content_html?: string;
    content_text: string;
    content_indexed: string;
    lang?: string;
    published_at?: Date;
};

declare const timeToSeconds: (time: string) => number;

declare const indexing: {
    indexContent: (text: string) => string;
    indexXlsxContent: (text: string) => string;
    indexWebVttContent: (text: string) => string;
    indexJsonContent: (text: string) => string;
    getContent: (resource: ResourceData, startIndex: number, endIndex: number) => string;
    getVttTimestamps: (vttContent: string, startIndex: number, endIndex: number) => {
        startTime: string;
        endTime: string;
    };
};

declare enum ResourceType {
    WEB = "WEB",
    JSON = "JSON",
    CSV = "CSV",
    XLSX = "XLSX",
    DOCX = "DOCX",
    PPTX = "PPTX",
    ODT = "ODT",
    ODP = "ODP",
    ODS = "ODS",
    PDF = "PDF",
    YOUTUBE = "YOUTUBE",
    UNKNOWN = "UNKNOWN"
}

export { type ResourceData, ResourceType, indexing, timeToSeconds };
