export interface AnnotationMetadata {
  chartId: string;
  metricId: string;
  startDate: string;
  endDate: string;
  segment: string;
  stateVersion: number;
}

export interface HostDocument extends Document {
  oai?: {
    annotation?: {
      request(
        target: HTMLElement,
        options?: { metadata: AnnotationMetadata },
      ): { accepted: boolean };
    };
  };
}
